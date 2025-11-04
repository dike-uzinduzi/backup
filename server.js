const express = require('express');
const cors = require('cors'); // For allowing frontend requests
const { Pesepay } = require('pesepay');
const { loadEnvFile } = require('node:process');
const fetch = require('node-fetch'); // Make sure you've run "npm install node-fetch@2"
const { URL } = require('url');

// --- 1. NEW: IN-MEMORY DATABASE ---
// This array will act as our simple database
let transactionsDB = [];
// ---------------------------------

// Load environment variables from .env file
try {
    loadEnvFile();
} catch (err) {
    console.warn('Could not load .env file. Make sure it exists.', err.message);
}

// Initialize Express app
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse Pesepay's webhook (x-www-form-urlencoded)
const port = process.env.PORT || 3000;

// Pesepay API Base URL
const PESEPAY_API_URL = 'https://api.pesepay.com/api/payments-engine/v1';

// --- Initialize Pesepay SDK ---
if (!process.env.INTEGRATION_KEY || !process.env.ENCRYPTION_KEY) {
    console.error("Error: INTEGRATION_KEY or ENCRYPTION_KEY not found in .env file.");
    console.log("Please create a .env file with your Pesepay credentials.");
    process.exit(1); 
}

const pesepay = new Pesepay(process.env.INTEGRATION_KEY, process.env.ENCRYPTION_KEY);
// Set the webhook URL from our .env file
pesepay.resultUrl = process.env.RESULT_URL;
pesepay.returnUrl = process.env.RETURN_URL;

console.log("Pesepay SDK initialized.");

// --- 2. NEW: WEBHOOK ENDPOINT ---
// Pesepay sends POST requests here when a payment status changes
app.post('/payment-result', (req, res) => {
    console.log('🔔 WEBHOOK RECEIVED! /payment-result');
    console.log('Webhook Body:', req.body); // Log the raw body

    let transactionData;
    
    try {
        if (req.body.payload) {
            // Case 1: Data is a JSON string in a 'payload' field
            transactionData = JSON.parse(req.body.payload);
        } else if (req.body.referenceNumber) {
            // Case 2: Data is directly in the body (parsed by express.urlencoded)
            transactionData = req.body;
        } else {
            console.error('Webhook payload is in an unknown format.');
            return res.status(400).send('Bad Request: Unknown payload format');
        }

        console.log('Parsed Webhook Data:', transactionData);

        const { referenceNumber, transactionStatus, amount, reasonForPayment } = transactionData;
        
        // Find the transaction in our "database"
        const txIndex = transactionsDB.findIndex(tx => tx.referenceNumber === referenceNumber);

        if (txIndex !== -1) {
            // --- UPDATE EXISTING TRANSACTION ---
            console.log(`Updating transaction ${referenceNumber} to ${transactionStatus}`);
            transactionsDB[txIndex].status = transactionStatus;
            transactionsDB[txIndex].paid = (transactionStatus === 'SETTLEMENT_COMPLETED' || transactionStatus === 'PAID');
            transactionsDB[txIndex].fullWebhookPayload = transactionData; // Store all details
        } else {
            // --- ADD NEW TRANSACTION (if not seen before) ---
            console.log(`Webhook for unseen transaction ${referenceNumber}. Adding to DB.`);
            transactionsDB.push({
                referenceNumber: referenceNumber,
                status: transactionStatus,
                amount: amount,
                reason: reasonForPayment,
                paid: (transactionStatus === 'SETTLEMENT_COMPLETED' || transactionStatus === 'PAID'),
                fullWebhookPayload: transactionData
            });
        }
        
        // IMPORTANT: Respond with 200 OK so Pesepay knows we received it.
        res.status(200).send('OK');

    } catch (error) {
        console.error('Error processing webhook:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// --- 3. NEW: DASHBOARD DATA ENDPOINT ---
app.get('/all-transactions', (req, res) => {
    // Return all transactions, with the newest first
    res.status(200).json([...transactionsDB].reverse());
});

// --- 4. MODIFIED: Payment Creation Endpoints ---

// Create Redirect Payment
app.post('/create-redirect-payment', async (req, res) => {
    try {
        const { amount, currencyCode, paymentReason } = req.body;
        if (!amount || !currencyCode || !paymentReason) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const transaction = pesepay.createTransaction(amount, currencyCode, paymentReason);
        const response = await pesepay.initiateTransaction(transaction);

        if (response.success) {
            // --- ADD TO DB ---
            transactionsDB.push({
                referenceNumber: response.referenceNumber,
                status: 'PENDING',
                amount: amount,
                reason: paymentReason,
                paid: false
            });
            // ---------------
            res.status(200).json(response);
        } else {
            res.status(400).json(response);
        }
    } catch (error) {
        console.error('Error initiating transaction:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});

// Create Seamless Payment
app.post('/create-seamless-payment', async (req, res) => {
    try {
        const { 
            amount, currencyCode, paymentReason, paymentMethodCode, 
            customerEmail, customerPhone, customerName,
            requiredFields = {}
        } = req.body;

        if (!amount || !currencyCode || !paymentReason || !paymentMethodCode || (!customerEmail && !customerPhone)) {
             return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields'
            });
        }
        
        const payment = pesepay.createPayment(currencyCode, paymentMethodCode, customerEmail, customerPhone, customerName);
        const response = await pesepay.makeSeamlessPayment(payment, paymentReason, amount, requiredFields);

        if (response.success) {
            // --- ADD TO DB ---
            transactionsDB.push({
                referenceNumber: response.referenceNumber,
                status: 'PENDING', // Or 'IN_PROGRESS'
                amount: amount,
                reason: paymentReason,
                paid: false
            });
            // ---------------
            res.status(200).json(response);
        } else {
            res.status(400).json(response);
        }
    } catch (error) {
        console.error('Error making seamless payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});

// --- 5. EXISTING: Status Check Endpoints ---

// Check Payment by Reference Number
app.get('/check-payment/:referenceNumber', async (req, res) => {
    try {
        const { referenceNumber } = req.params;
        const response = await pesepay.checkPayment(referenceNumber);
        if (response.success) {
            res.status(200).json(response); 
        } else {
            res.status(400).json(response);
        }
    } catch (error) {
        console.error('Error checking payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});

// Check Payment by Poll URL
app.post('/poll-payment', async (req, res) => {
    try {
        const { pollUrl } = req.body;
        if (!pollUrl) {
            return res.status(400).json({ success: false, message: 'Missing required field: pollUrl' });
        }
        const response = await pesepay.pollTransaction(pollUrl);
        if (response.success) {
            res.status(200).json(response);
        } else {
            res.status(400).json(response);
        }
    } catch (error) {
        console.error('Error polling transaction:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});

// --- 6. EXISTING: Helper Endpoints (using node-fetch) ---

// Get Active Currencies
app.get('/currencies', async (req, res) => {
    console.log('Fetching active currencies...');
    try {
        const response = await fetch(`${PESEPAY_API_URL}/currencies/active`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching currencies:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch currencies', error: error.message });
    }
});

// Get Payment Methods by Currency
app.get('/payment-methods', async (req, res) => {
    try {
        const { currencyCode } = req.query;
        if (!currencyCode) {
            return res.status(400).json({ success: false, message: 'Query parameter "currencyCode" is required' });
        }
        
        const url = new URL(`${PESEPAY_API_URL}/payment-methods/for-currency`);
        url.searchParams.append('currencyCode', currencyCode);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching payment methods:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch payment methods', error: error.message });
    }
});

// --- 7. START THE SERVER ---
app.listen(port, () => {
    console.log(`✅ Pesepay Server running on http://localhost:${port}`);
    console.log(`---`);
    console.log(`🔔 Webhook (Result) URL: ${process.env.RESULT_URL}`);
    console.log(`📈 Dashboard Data URL: http://localhost:${port}/all-transactions`);
    console.log(`---`);
});