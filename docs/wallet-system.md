# ?? NexHire Wallet System

## Overview

The NexHire Wallet System allows users to add money to their digital wallet using Razorpay payment gateway. Users can maintain a balance, recharge their wallet, view transaction history, and use wallet funds for various platform services.

---

## ??? Database Schema

### Tables Created

#### 1. **Wallets**
Main wallet table mapped to users (one wallet per user)

```sql
CREATE TABLE Wallets (
    WalletID UNIQUEIDENTIFIER PRIMARY KEY,
    UserID UNIQUEIDENTIFIER NOT NULL UNIQUE,
    Balance DECIMAL(15,2) DEFAULT 0.00,
    CurrencyID INT DEFAULT 4, -- INR
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME2,
    UpdatedAt DATETIME2,
    LastTransactionAt DATETIME2
)
```

#### 2. **WalletTransactions**
All wallet transactions (credits, debits)

```sql
CREATE TABLE WalletTransactions (
    TransactionID UNIQUEIDENTIFIER PRIMARY KEY,
    WalletID UNIQUEIDENTIFIER NOT NULL,
    TransactionType NVARCHAR(20) NOT NULL, -- Credit, Debit
    Amount DECIMAL(15,2) NOT NULL,
    BalanceBefore DECIMAL(15,2) NOT NULL,
    BalanceAfter DECIMAL(15,2) NOT NULL,
    Source NVARCHAR(50) NOT NULL, -- Razorpay, Refund, Referral_Bonus, Admin_Credit
    PaymentReference NVARCHAR(200) NULL,
    Description NVARCHAR(500) NULL,
    Status NVARCHAR(20) DEFAULT 'Completed',
    CreatedAt DATETIME2
)
```

#### 3. **WalletRechargeOrders**
Track Razorpay recharge orders

```sql
CREATE TABLE WalletRechargeOrders (
    OrderID UNIQUEIDENTIFIER PRIMARY KEY,
    WalletID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NOT NULL,
    Amount DECIMAL(15,2) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Pending',
    RazorpayOrderID NVARCHAR(200) NULL,
    RazorpayPaymentID NVARCHAR(200) NULL,
    RazorpaySignature NVARCHAR(500) NULL,
    CreatedAt DATETIME2,
    PaidAt DATETIME2 NULL
)
```

#### 4. **WalletWithdrawals**
Track withdrawal requests (future feature)

```sql
CREATE TABLE WalletWithdrawals (
    WithdrawalID UNIQUEIDENTIFIER PRIMARY KEY,
    WalletID UNIQUEIDENTIFIER NOT NULL,
    Amount DECIMAL(15,2) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Pending',
    BankAccountNumber NVARCHAR(50) NULL,
    UPI_ID NVARCHAR(100) NULL,
    RequestedAt DATETIME2,
    ProcessedAt DATETIME2 NULL
)
```

---

## ?? Setup Instructions

### 1. Run Database Script

```powershell
cd src/database_scripts
.\wallet-schema.ps1 -ConnectionString "Your-Connection-String"
```

This will:
- ? Create 4 wallet tables
- ? Create performance indexes
- ? Create auto-wallet creation trigger (creates wallet on user registration)

### 2. Environment Variables

Ensure you have Razorpay credentials in your `.env` or Azure Functions configuration:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxx  # or rzp_live_xxxxx for production
RAZORPAY_KEY_SECRET=your_secret_key
```

### 3. Deploy Backend

```sh
npm run build
# Deploy to Azure Functions
```

---

## ?? API Endpoints

### 1. **Get Wallet Details**
```http
GET /api/wallet
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "WalletID": "uuid",
    "UserID": "uuid",
    "Balance": 1500.00,
    "CurrencyCode": "INR",
    "Status": "Active",
    "CreatedAt": "2024-01-15T10:00:00Z",
    "LastTransactionAt": "2024-01-20T15:30:00Z"
  }
}
```

---

### 2. **Get Balance**
```http
GET /api/wallet/balance
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 1500.00,
    "currencyCode": "INR"
  }
}
```

---

### 3. **Create Recharge Order** (Step 1 of Payment)
```http
POST /api/wallet/recharge/create-order
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "amount": 500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order_xxxxx",
    "amount": 50000,
    "currency": "INR",
    "razorpayKeyId": "rzp_test_xxxxx",
    "isProduction": false
  }
}
```

**Validation:**
- ? Minimum: ?1
- ? Maximum: ?1,00,000

---

### 4. **Verify Payment and Credit Wallet** (Step 2 of Payment)
```http
POST /api/wallet/recharge/verify
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "razorpayPaymentId": "pay_xxxxx",
  "razorpayOrderId": "order_xxxxx",
  "razorpaySignature": "signature_xxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "amount": 500,
    "balanceBefore": 1000,
    "balanceAfter": 1500,
    "paymentId": "pay_xxxxx",
    "message": "?500 added to wallet successfully"
  }
}
```

---

### 5. **Get Transaction History**
```http
GET /api/wallet/transactions?page=1&pageSize=20&type=Credit
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 20, max: 50)
- `type` (optional): Filter by `Credit` or `Debit`

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "TransactionID": "uuid",
        "TransactionType": "Credit",
        "Amount": 500,
        "BalanceBefore": 1000,
        "BalanceAfter": 1500,
        "CurrencyCode": "INR",
        "Source": "Razorpay",
        "Description": "Wallet recharge via Razorpay - ?500",
        "Status": "Completed",
        "CreatedAt": "2024-01-20T15:30:00Z"
      }
    ],
    "currentBalance": 1500,
    "total": 25,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  }
}
```

---

### 6. **Get Recharge History**
```http
GET /api/wallet/recharge/history?page=1&pageSize=20
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "OrderID": "uuid",
        "Amount": 500,
        "Status": "Paid",
        "RazorpayOrderID": "order_xxxxx",
        "RazorpayPaymentID": "pay_xxxxx",
        "CreatedAt": "2024-01-20T15:00:00Z",
        "PaidAt": "2024-01-20T15:30:00Z"
      }
    ],
    "total": 10,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 7. **Get Wallet Statistics**
```http
GET /api/wallet/stats
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletId": "uuid",
    "currentBalance": 1500,
    "currencyCode": "INR",
    "status": "Active",
    "totalTransactions": 25,
    "totalCredits": 5000,
    "totalDebits": 3500,
    "lastCreditAt": "2024-01-20T15:30:00Z",
    "lastDebitAt": "2024-01-19T10:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 8. **Debit Wallet** (Internal Use Only)
```http
POST /api/wallet/debit
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "amount": 100,
  "source": "Referral_Plan_Purchase",
  "description": "Purchased Monthly Pro referral plan"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "TransactionID": "uuid",
    "Amount": 100,
    "BalanceBefore": 1500,
    "BalanceAfter": 1400,
    "Description": "Purchased Monthly Pro referral plan"
  }
}
```

---

## ?? Payment Flow (Frontend Integration)

### Step 1: Create Order
```javascript
const response = await fetch('/api/wallet/recharge/create-order', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ amount: 500 })
});

const { data } = await response.json();
const { orderId, razorpayKeyId, amount } = data;
```

### Step 2: Open Razorpay Checkout
```javascript
const options = {
  key: razorpayKeyId,
  amount: amount, // in paise
  currency: 'INR',
  name: 'NexHire',
  description: 'Wallet Recharge',
  order_id: orderId,
  handler: async function (response) {
    // Step 3: Verify payment
    await verifyPayment(response);
  },
  prefill: {
    email: user.email,
    contact: user.phone
  },
  theme: {
    color: '#007AFF'
  }
};

const razorpay = new Razorpay(options);
razorpay.open();
```

### Step 3: Verify Payment
```javascript
async function verifyPayment(response) {
  const verifyResponse = await fetch('/api/wallet/recharge/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      razorpayPaymentId: response.razorpay_payment_id,
      razorpayOrderId: response.razorpay_order_id,
      razorpaySignature: response.razorpay_signature
    })
  });

  const result = await verifyResponse.json();
  if (result.success) {
    alert(`?${result.data.amount} added to wallet!`);
    // Refresh wallet balance
  }
}
```

---

## ?? Security Features

### 1. **Payment Signature Verification**
- HMAC SHA256 signature validation
- Prevents payment tampering
- Matches Razorpay's security standards

### 2. **Transaction Validation**
- Minimum/maximum amount limits
- Duplicate transaction prevention
- Order status verification

### 3. **Wallet Constraints**
```sql
CONSTRAINT CHK_Wallet_Balance CHECK (Balance >= 0)
CONSTRAINT CHK_Transaction_Amount CHECK (Amount > 0)
CONSTRAINT CHK_Recharge_Amount CHECK (Amount >= 1.00)
```

### 4. **Auto-Wallet Creation**
- Trigger automatically creates wallet on user registration
- Prevents missing wallet errors
- Initialized with ?0 balance

---

## ?? Transaction Sources

| Source | Type | Description |
|--------|------|-------------|
| `Razorpay` | Credit | Wallet recharge via Razorpay |
| `Refund` | Credit | Payment refund |
| `Referral_Bonus` | Credit | Bonus from referral rewards |
| `Admin_Credit` | Credit | Manual credit by admin |
| `Referral_Plan_Purchase` | Debit | Purchasing referral plans |
| `Job_Boost` | Debit | Boosting job posts |
| `Premium_Feature` | Debit | Accessing premium features |

---

## ?? Testing

### Test Razorpay Credentials
```env
# Test Mode
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=test_secret_key
```

### Test Card Details
```
Card Number: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date
```

### Test UPI
```
UPI ID: success@razorpay
```

---

## ?? Future Enhancements

### 1. **Wallet Withdrawals**
- Bank transfer integration
- UPI withdrawal
- Minimum withdrawal: ?100
- Withdrawal fee: 2% or ?10 (whichever is higher)

### 2. **Wallet Offers**
- Cashback on recharge
- Bonus credits
- Referral rewards directly to wallet

### 3. **Wallet Pass/Subscriptions**
- Auto-debit for subscriptions
- Recurring payments
- Wallet as primary payment method

### 4. **Enhanced Analytics**
- Spending patterns
- Monthly reports
- Budget tracking

---

## ?? Support

For issues related to:
- **Payment failures**: Check Razorpay dashboard
- **Balance discrepancies**: Check `WalletTransactions` table
- **Integration issues**: See API error responses

---

## ?? Changelog

### Version 1.0.0 (2024-01-20)
- ? Initial wallet system release
- ? Razorpay integration
- ? Transaction history
- ? Recharge orders tracking
- ? Auto-wallet creation
- ? Comprehensive API documentation

---

**Built with ?? for NexHire Platform**
