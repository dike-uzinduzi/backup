var http = require('http');
const { Pesepay } = require('pesepay')
const {loadEnvFile} = require('node:process');

loadEnvFile();

const pesepay = new Pesepay(process.env.INTEGRATION_KEY, process.env.ENCRYPTION_KEY);

pesepay.resultUrl = process.env.RESULT_URL;
pesepay.returnUrl = process.env.RETURN_URL;

const transaction = pesepay.createTransaction(amount, 'CURRENCY_CODE', 'PAYMENT_REASON')

pesepay
    .initiateTransaction(transaction)
    .then((response) => {
      // User the redirect url to complete the transaction on Pesepay payment page
      const redirectUrl = response.redirectUrl;
      // Save the reference number (used to check the status of a transaction and to make the payment)
      const referenceNumber = response.referenceNumber;
    })
    .catch((error) => {
     console.error('Error initiating transaction:', error);
  });

const payment = pesepay.createPayment('CURRENCY_CODE', 'PAYMENT_METHOD_CODE', 'CUSTOMER_EMAIL(OPTIONAL)', 'CUSTOMER_PHONE_NUMBER(OPTIONAL)', 'CUSTOMER_NAME(OPTIONAL)')

const requiredFields = {'requiredFieldName': 'requiredFieldValue'}

pesepay
     .makeSeamlessPayment(payment, 'PAYMENT_REASON', AMOUNT, requiredFields)
     .then((response) => {
       // Save the poll url and reference number (used to check the status of a transaction)
       const pollUrl = response.pollUrl;
       const referenceNumber = response.referenceNumber;
     })
     .catch((error) => {
       console.error('Error making seamless payment:', error);
     });
http.createServer(function (req, res) {

    res.writeHead(200, {'Content-Type': 'text/html'});
    
    res.end('Hello World!');

}).listen(8080);
