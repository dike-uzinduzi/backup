# Uzinduzi Node Js Pesepay Gateway Implementation

A simple Node.js Express server that acts as a wrapper for the Pesepay payment gateway API. This server simplifies creating payments, checking transaction status, and retrieving gateway information like active currencies and payment methods.

---

## 🚀 Getting Started

You can use it as reference to your codebase

### 1. Prerequisites

* pesepay


## 🌎 API Helper Endpoints

These endpoints help you get the necessary codes and information before creating a transaction.

---

### 1. Get Active Currencies

Retrieves a list of all active currencies you can charge in.

* **Endpoint:** `GET /currencies`
* **Example Request:** `http://localhost:3000/currencies`
* **Example Response (200 OK):**

    ```json
    [
      {
        "createdDate": "2019-09-09 12:31:26",
        "version": 14,
        "deleted": false,
        "id": 3,
        "name": "Zimbabwe Dollar",
        "description": "Zimbabwe Dollar",
        "code": "ZiG",
        "defaultCurrency": false,
        "rateToDefault": 13.56,
        "active": true
      },
      {
        "createdBy": null,
        "lastModifiedBy": "oneal",
        "lastModifiedDate": "2022-09-15 17:35:27",
        "createdDate": "2020-06-18 20:16:27",
        "version": 15,
        "deleted": false,
        "id": 25646,
        "name": "United States Dollar",
        "description": "USD",
        "code": "USD",
        "defaultCurrency": true,
        "rateToDefault": 1,
        "active": true
      }
    ]
    ```

### 2. Get Payment Methods by Currency

Retrieves a list of available payment methods for a specific currency. This is critical for seamless payments.

* **Endpoint:** `GET /payment-methods`
* **Query Parameters:**
    * `currencyCode` (string, **required**): The currency code (e.g., `USD`).
* **Example Request:** `http://localhost:3000/payment-methods?currencyCode=USD`
* **Example Response (200 OK):**
    *This shows one of the methods, "Innbuçks USD".*

    ```json
    [
      ...
      {
        "createdBy": "webster",
        "lastModifiedBy": "webster",
        "lastModifiedDate": "2024-06-12 12:09:57",
        "createdDate": "2024-02-11 16:44:44",
        "version": 7,
        "deleted": false,
        "id": 25693,
        "name": "Innbuçks USD",
        "description": "QR code based method of payment for USD payments",
        "processingPaymentMessage": "Please enter PIN on the phone that is making the payment.",
        "code": "PZW212",
        "reverseProxyName": "innbucks",
        ...
      }
    ]
    ```

---

## 💸 Payment Creation Endpoints

These endpoints are used to initiate a new transaction.

---

### 3. Create Redirect Payment

Initiates a transaction and returns a URL to which the user must be redirected to complete payment.

* **Endpoint:** `POST /create-redirect-payment`
* **Request Body (JSON):**

    ```json
    {
      "amount": 100,
      "currencyCode": "USD",
      "paymentReason": "Test payment from backup"
    }
    ```

* **Success Response (200 OK):**

    ```json
    {
      "success": true,
      "referenceNumber": "20251102011055871-E345645C",
      "pollUrl": "[https://api.pesepay.com/api/payments-engine/v1/payments/check-payment?referenceNumber=20251102011055871-E345645C](https://api.pesepay.com/api/payments-engine/v1/payments/check-payment?referenceNumber=20251102011055871-E345645C)",
      "redirectUrl": "[https://pay.pesepay.com/#/pesepay-payments?referenceNumber=20251102011055871-E345645C](https://pay.pesepay.com/#/pesepay-payments?referenceNumber=20251102011055871-E345645C)",
      "paid": false
    }
    ```

### 4. Create Seamless Payment

Initiates a payment directly (e.g., for mobile money) without redirection.

* **Endpoint:** `POST /create-seamless-payment`
* **Request Body (JSON):**
    *Note the required `requiredFields` object, which you found using the `/payment-methods` endpoint.*

    ```json
    {
      "amount": 10,
      "currencyCode": "USD",
      "paymentReason": "test seamleass",
      "paymentMethodCode": "PZW211",
      "customerEmail": "dike@uzinduziafrica.com",
      "customerPhone": "0774556973",
      "customerName": "Dike",
      "requiredFields": {
        "customerPhoneNumber": "0774556973"
      }
    }
    ```

* **Success Response (200 OK):**

    ```json
    {
      "success": true,
      "referenceNumber": "20251102022734457-27D46AD9",
      "pollUrl": "[https://api.pesepay.com/api/payments-engine/v1/payments/check-payment?referenceNumber=20251102022734457-27D46AD9](https://api.pesepay.com/api/payments-engine/v1/payments/check-payment?referenceNumber=20251102022734457-27D46AD9)",
      "paid": false
    }
    ```

---

## 📊 Payment Status Endpoints

These endpoints are used to check the status of a previously created transaction.

---

### 5. Check Status by Reference Number

Checks a transaction's status using its unique `referenceNumber`.

* **Endpoint:** `GET /check-payment/:referenceNumber`
* **Example Request:** `http://localhost:3000/check-payment/20251102011055871-E345645C`
* **Success Response (200 OK):**

    ```json
    {
      "success": true,
      "referenceNumber": "20251102011055871-E345645C",
      "pollUrl": null,
      "paid": false
    }
    ```

### 6. Check Payment by Poll URL

Checks a transaction's status using the `pollUrl` returned when it was created.

* **Endpoint:** `POST /poll-payment`
* **Request Body (JSON):**

    ```json
    {
      "pollUrl": "[https://api.pesepay.com/api/payments-engine/v1/payments/check-payment?referenceNumber=20251102011055871-E345645C](https://api.pesepay.com/api/payments-engine/v1/payments/check-payment?referenceNumber=20251102011055871-E345645C)"
    }
    ```

* **Success Response (200 OK):**

    ```json
    {
      "success": true,
      "referenceNumber": "20251102011055871-E345645C",
      "pollUrl": null,
      "paid": false
    }
    ```