# RefOpen Wallet Schema Deployment Script
# Wallet feature for adding money using Razorpay

param(
    [string]$ConnectionString = $env:DB_CONNECTION_STRING,
    [string]$KeyVaultName = "refopen-keyvault-prod"
)

# Auto-load credentials from Key Vault if not provided
if (-not $ConnectionString) {
    Write-Host "🔐 Loading credentials from Azure Key Vault..." -ForegroundColor Cyan
    $ConnectionString = az keyvault secret show --vault-name $KeyVaultName --name "DbConnectionString" --query "value" -o tsv 2>$null
    if (-not $ConnectionString) {
        Write-Error "Failed to load credentials. Ensure you're logged in: az login"
        exit 1
    }
    Write-Host "✅ Credentials loaded from Key Vault" -ForegroundColor Green
}

Write-Host "💰 Setting up RefOpen Wallet Schema..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "?? Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Wallet Schema SQL
$walletSchemaSQL = @"
-- ========================================================================
-- WALLET SYSTEM TABLES
-- ========================================================================

-- Wallets: Main wallet table mapped to users
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Wallets')
BEGIN
    CREATE TABLE Wallets (
        WalletID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserID UNIQUEIDENTIFIER NOT NULL UNIQUE,
        Balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        CurrencyID INT NOT NULL DEFAULT 4, -- Default to INR
        Status NVARCHAR(20) NOT NULL DEFAULT 'Active', -- Active, Frozen, Closed
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        LastTransactionAt DATETIME2 NULL,
        
        CONSTRAINT CHK_Wallet_Balance CHECK (Balance >= 0),
        FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
    );
    
    PRINT '? Wallets table created successfully';
END
ELSE
BEGIN
    PRINT '?? Wallets table already exists';
END

-- WalletTransactions: All wallet transactions (credits, debits)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletTransactions')
BEGIN
    CREATE TABLE WalletTransactions (
        TransactionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        WalletID UNIQUEIDENTIFIER NOT NULL,
        TransactionType NVARCHAR(20) NOT NULL, -- Credit, Debit
        Amount DECIMAL(15,2) NOT NULL,
        BalanceBefore DECIMAL(15,2) NOT NULL,
        BalanceAfter DECIMAL(15,2) NOT NULL,
        CurrencyID INT NOT NULL,
        Source NVARCHAR(50) NOT NULL, -- Razorpay, Refund, Referral_Bonus, Admin_Credit
        PaymentReference NVARCHAR(200) NULL, -- Razorpay payment ID or order ID
        Description NVARCHAR(500) NULL,
        Metadata NVARCHAR(MAX) NULL, -- JSON for additional info
        Status NVARCHAR(20) NOT NULL DEFAULT 'Completed', -- Pending, Completed, Failed, Reversed
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT CHK_Transaction_Amount CHECK (Amount > 0),
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID) ON DELETE CASCADE,
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
    );
    
    PRINT '? WalletTransactions table created successfully';
END
ELSE
BEGIN
    PRINT '?? WalletTransactions table already exists';
END

-- WalletRechargeOrders: Track Razorpay recharge orders
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletRechargeOrders')
BEGIN
    CREATE TABLE WalletRechargeOrders (
        OrderID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        WalletID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        Amount DECIMAL(15,2) NOT NULL,
        CurrencyID INT NOT NULL,
        Status NVARCHAR(50) DEFAULT 'Pending', -- Pending, Paid, Failed, Expired
        PaymentGateway NVARCHAR(50) NOT NULL DEFAULT 'Razorpay',
        RazorpayOrderID NVARCHAR(200) NULL, -- Razorpay order_id
        RazorpayPaymentID NVARCHAR(200) NULL, -- Razorpay payment_id
        RazorpaySignature NVARCHAR(500) NULL,
        Receipt NVARCHAR(100) NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        PaidAt DATETIME2 NULL,
        ExpiresAt DATETIME2 NULL,
        ErrorMessage NVARCHAR(500) NULL,
        
        CONSTRAINT CHK_Recharge_Amount CHECK (Amount >= 1.00), -- Minimum ?1
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID) ON DELETE CASCADE,
        FOREIGN KEY (UserID) REFERENCES Users(UserID),
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
    );
    
    PRINT '? WalletRechargeOrders table created successfully';
END
ELSE
BEGIN
    PRINT '?? WalletRechargeOrders table already exists';
END

-- WalletWithdrawals: Track withdrawal requests (future feature)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletWithdrawals')
BEGIN
    CREATE TABLE WalletWithdrawals (
        WithdrawalID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        WalletID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        Amount DECIMAL(15,2) NOT NULL,
        CurrencyID INT NOT NULL,
        BankAccountNumber NVARCHAR(50) NULL,
        BankIFSC NVARCHAR(20) NULL,
        BankAccountName NVARCHAR(200) NULL,
        UPI_ID NVARCHAR(100) NULL,
        Status NVARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Processing, Completed, Rejected
        RequestedAt DATETIME2 DEFAULT GETUTCDATE(),
        ProcessedAt DATETIME2 NULL,
        ProcessedBy UNIQUEIDENTIFIER NULL,
        PaymentReference NVARCHAR(200) NULL,
        RejectionReason NVARCHAR(500) NULL,
        
        CONSTRAINT CHK_Withdrawal_Amount CHECK (Amount >= 100.00), -- Minimum ?100 for withdrawal
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID),
        FOREIGN KEY (UserID) REFERENCES Users(UserID),
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
        FOREIGN KEY (ProcessedBy) REFERENCES Users(UserID)
    );
    
    PRINT '? WalletWithdrawals table created successfully';
END
ELSE
BEGIN
    PRINT '?? WalletWithdrawals table already exists';
END

"@

# Create indexes for wallet tables
$walletIndexesSQL = @"
-- ========================================================================
-- WALLET INDEXES FOR PERFORMANCE
-- ========================================================================

-- Wallets indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Wallets_UserID')
    CREATE UNIQUE INDEX IX_Wallets_UserID ON Wallets(UserID) INCLUDE (WalletID, Balance, Status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Wallets_Status')
    CREATE INDEX IX_Wallets_Status ON Wallets(Status) INCLUDE (WalletID, UserID, Balance);

-- WalletTransactions indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletTransactions_WalletID_CreatedAt')
    CREATE INDEX IX_WalletTransactions_WalletID_CreatedAt 
    ON WalletTransactions(WalletID, CreatedAt DESC) 
    INCLUDE (TransactionType, Amount, Source, Status, Description);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletTransactions_PaymentReference')
    CREATE INDEX IX_WalletTransactions_PaymentReference 
    ON WalletTransactions(PaymentReference) 
    WHERE PaymentReference IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletTransactions_Source_Status')
    CREATE INDEX IX_WalletTransactions_Source_Status 
    ON WalletTransactions(Source, Status) 
    INCLUDE (WalletID, Amount, CreatedAt);

-- WalletRechargeOrders indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletRechargeOrders_WalletID_Status')
    CREATE INDEX IX_WalletRechargeOrders_WalletID_Status 
    ON WalletRechargeOrders(WalletID, Status) 
    INCLUDE (Amount, CreatedAt, PaidAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletRechargeOrders_UserID_CreatedAt')
    CREATE INDEX IX_WalletRechargeOrders_UserID_CreatedAt 
    ON WalletRechargeOrders(UserID, CreatedAt DESC) 
    INCLUDE (OrderID, Amount, Status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletRechargeOrders_RazorpayOrderID')
    CREATE UNIQUE INDEX IX_WalletRechargeOrders_RazorpayOrderID 
    ON WalletRechargeOrders(RazorpayOrderID) 
    WHERE RazorpayOrderID IS NOT NULL;

-- WalletWithdrawals indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletWithdrawals_WalletID_Status')
    CREATE INDEX IX_WalletWithdrawals_WalletID_Status 
    ON WalletWithdrawals(WalletID, Status) 
    INCLUDE (Amount, RequestedAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletWithdrawals_Status_RequestedAt')
    CREATE INDEX IX_WalletWithdrawals_Status_RequestedAt 
    ON WalletWithdrawals(Status, RequestedAt DESC) 
    INCLUDE (WithdrawalID, WalletID, UserID, Amount);

PRINT '? All wallet indexes created successfully';
"@

# Auto-create wallet trigger (optional but recommended)
$walletTriggersSQL = @"
-- ========================================================================
-- WALLET TRIGGERS FOR AUTOMATIC WALLET CREATION
-- ========================================================================

-- Trigger to auto-create wallet when new user registers
IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_CreateWalletOnUserRegistration')
BEGIN
    EXEC('
    CREATE TRIGGER trg_CreateWalletOnUserRegistration
    ON Users
    AFTER INSERT
    AS
    BEGIN
        SET NOCOUNT ON;
        
        INSERT INTO Wallets (UserID, Balance, CurrencyID, Status)
        SELECT 
            i.UserID, 
            0.00, 
            4, -- INR (CurrencyID = 4)
            ''Active''
        FROM inserted i
        WHERE NOT EXISTS (
            SELECT 1 FROM Wallets w WHERE w.UserID = i.UserID
        );
    END
    ');
    
    PRINT '? Auto-create wallet trigger created successfully';
END
ELSE
BEGIN
    PRINT '?? Auto-create wallet trigger already exists';
END

"@

try {
    Write-Host "?? Creating wallet tables..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $walletSchemaSQL -QueryTimeout 120
    Write-Host "? Wallet tables created successfully" -ForegroundColor Green

    Write-Host "?? Creating wallet indexes..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $walletIndexesSQL -QueryTimeout 120
    Write-Host "? Wallet indexes created successfully" -ForegroundColor Green

    Write-Host "? Creating wallet triggers..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $walletTriggersSQL -QueryTimeout 60
    Write-Host "? Wallet triggers created successfully" -ForegroundColor Green

    Write-Host ""
    Write-Host "?? WALLET SYSTEM SETUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host ""
    Write-Host "?? WALLET SYSTEM SUMMARY:" -ForegroundColor Cyan
    Write-Host "- ?? Wallets table (user wallet management)" -ForegroundColor White
    Write-Host "- ?? WalletTransactions table (all credits/debits)" -ForegroundColor White
    Write-Host "- ?? WalletRechargeOrders table (Razorpay recharge tracking)" -ForegroundColor White
    Write-Host "- ?? WalletWithdrawals table (withdrawal requests)" -ForegroundColor White
    Write-Host "- ? Auto-wallet creation trigger on user registration" -ForegroundColor White
    Write-Host "- ?? Performance indexes for all tables" -ForegroundColor White
    Write-Host ""
    Write-Host "?? Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Deploy wallet service and controller" -ForegroundColor White
    Write-Host "2. Add API endpoints to index.ts" -ForegroundColor White
    Write-Host "3. Test wallet recharge flow with Razorpay" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Error "? Wallet schema setup failed: $($_.Exception.Message)"
    exit 1
}
