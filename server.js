const express = require('express');
const { Pesepay } = require('pesepay');
const { loadEnvFile } = require('node:process');
const axios = require('axios');
const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

// using env file
try {
    loadEnvFile();
} catch (err) {
    console.warn('Could not load .env file', err.message);
}


const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

const PESEPAY_API_URL = 'https://api.pesepay.com/api/payments-engine/v1';


if (!process.env.INTEGRATION_KEY || !process.env.ENCRYPTION_KEY) {
    console.error("Error: INTEGRATION_KEY or ENCRYPTION_KEY not found in .env file.");
    console.log("Please create a .env file with your Pesepay credentials.");
    process.exit(1);
}

const pesepay = new Pesepay(process.env.INTEGRATION_KEY, process.env.ENCRYPTION_KEY);
pesepay.resultUrl = process.env.RESULT_URL;
pesepay.returnUrl = process.env.RETURN_URL;

console.log("Pesepay SDK initialized.");

// Redirect Payments Those with the pesepay page
app.post('/create-redirect-payment', async (req, res) => {
    try {
        const { amount, currencyCode, paymentReason } = req.body;
        if (!amount || !currencyCode || !paymentReason) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: amount, currencyCode, paymentReason'
            });
        }

        console.log(`Creating redirect transaction for ${amount} ${currencyCode}`);
        const transaction = pesepay.createTransaction(amount, currencyCode, paymentReason);

        const response = await pesepay.initiateTransaction(transaction);

        if (response.success) {
            res.status(200).json(response);
        } else {
            res.status(400).json(response);
        }
    } catch (error) {
        console.error('Error initiating transaction:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});

// SeamLess Payments Those without the pesepay page
app.post('/create-seamless-payment', async (req, res) => {
    try {
        const {
            amount,
            currencyCode,
            paymentReason,
            paymentMethodCode,
            customerEmail,
            customerPhone,
            customerName,
            requiredFields = {}
        } = req.body;

        if (!amount || !currencyCode || !paymentReason || !paymentMethodCode || (!customerEmail && !customerPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Missing fields: amount, currencyCode, paymentReason, paymentMethodCode, and (customerEmail or customerPhone)'
            });
        }

        console.log(`Creating seamless payment for ${amount} ${currencyCode} via ${paymentMethodCode}`);
        const payment = pesepay.createPayment(currencyCode, paymentMethodCode, customerEmail, customerPhone, customerName);
        const response = await pesepay.makeSeamlessPayment(payment, paymentReason, amount, requiredFields);

        if (response.success) {
            res.status(200).json(response);
        } else {
            res.status(400).json(response);
        }
    } catch (error) {
        console.error('Error making seamless payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});
// Check Payment by Reference Number
app.get('/check-payment/:referenceNumber', async (req, res) => {
    try {
        const { referenceNumber } = req.params;
        console.log(`Checking status for reference: ${referenceNumber}`);

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
            return res.status(400).json({
                success: false,
                message: 'Missing required field: pollUrl'
            });
        }

        console.log(`Polling URL: ${pollUrl}`);
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

// Get Active Currencies 
app.get('/currencies', async (req, res) => {
    console.log('Fetching active currencies...');
    try {
        const response = await axios.get(`${PESEPAY_API_URL}/currencies/active`, {
            headers: {
                'Content-Type': 'application/json'
            },
            httpAgent: httpAgent,
            httpsAgent: httpsAgent
        });

        res.status(200).json(response.data);
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
            return res.status(400).json({
                success: false,
                message: 'Query parameter "currencyCode" is required'
            });
        }

        console.log(`Fetching payment methods for: ${currencyCode}`);

        const response = await axios.get(`${PESEPAY_API_URL}/payment-methods/for-currency`, {
            params: {
                currencyCode: currencyCode
            },
            headers: {
                'Content-Type': 'application/json'
            },
            httpAgent: httpAgent,
            httpsAgent: httpsAgent
        });


        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error fetching payment methods:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch payment methods', error: error.message });
    }
});



app.listen(port, () => {
    console.log(`Pesepay Backup server running on http://localhost:${port}`);
    console.log('These are the available endpoints:');
    console.log(`  POST http://localhost:${port}/create-redirect-payment`);
    console.log(`  POST http://localhost:${port}/create-seamless-payment`);
    console.log(`  GET  http://localhost:${port}/check-payment/:referenceNumber`);
    console.log(`  POST http://localhost:${port}/poll-payment`);
    console.log(`  GET  http://localhost:${port}/currencies`);
    console.log(`  GET  http://localhost:${port}/payment-methods`);
});