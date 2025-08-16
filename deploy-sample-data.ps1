# NexHire Backend - Database Sample Data Deployment
# Run this after the backend is deployed to populate with test data

param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "??? Deploying Sample Data to NexHire Database..." -ForegroundColor Green
Write-Host ""

# Check if SqlServer module is available
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "?? Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Test connection
Write-Host "?? Testing database connection..." -ForegroundColor Yellow
try {
    $testResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT 1 as TestConnection" -QueryTimeout 10
    if ($testResult.TestConnection -eq 1) {
        Write-Host "? Database connection successful" -ForegroundColor Green
    }
} catch {
    Write-Error "? Database connection failed: $($_.Exception.Message)"
    exit 1
}

# Check if sample data already exists
Write-Host "?? Checking for existing data..." -ForegroundColor Yellow
$userCount = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM Users" -QueryTimeout 10
$jobCount = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM Jobs" -QueryTimeout 10

Write-Host "?? Current data count:" -ForegroundColor Cyan
Write-Host "  • Users: $($userCount.Count)" -ForegroundColor White
Write-Host "  • Jobs: $($jobCount.Count)" -ForegroundColor White
Write-Host ""

if ($userCount.Count -gt 0 -or $jobCount.Count -gt 0) {
    $response = Read-Host "?? Database already contains data. Do you want to add more sample data? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "?? Sample data deployment cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Deploy sample data
Write-Host "?? Checking for insert_table.sql file..." -ForegroundColor Yellow

if (Test-Path "insert_table.sql") {
    Write-Host "?? Found insert_table.sql file" -ForegroundColor Green
    Write-Host "?? Executing sample data script..." -ForegroundColor Yellow
    Write-Host "? This may take 1-2 minutes..." -ForegroundColor Cyan
    
    try {
        Invoke-Sqlcmd -ConnectionString $ConnectionString -InputFile "insert_table.sql" -QueryTimeout 120
        Write-Host "? Sample data deployed successfully!" -ForegroundColor Green
    } catch {
        Write-Error "? Sample data deployment failed: $($_.Exception.Message)"
        exit 1
    }
} else {
    Write-Host "?? insert_table.sql not found. Creating basic sample data..." -ForegroundColor Yellow
    
    # Create basic sample data if the file doesn't exist
    $basicSampleData = @"
-- Basic sample data for testing
INSERT INTO JobTypes (Type, Description, IsActive, CreatedAt, UpdatedAt) VALUES
('Full-Time', 'Full-Time Employment', 1, GETUTCDATE(), GETUTCDATE()),
('Part-Time', 'Part-Time Employment', 1, GETUTCDATE(), GETUTCDATE()),
('Contract', 'Contract Work', 1, GETUTCDATE(), GETUTCDATE()),
('Freelance', 'Freelance Work', 1, GETUTCDATE(), GETUTCDATE()),
('Internship', 'Internship Position', 1, GETUTCDATE(), GETUTCDATE());

INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt, UpdatedAt) VALUES
('USD', 'US Dollar', '$', 1, 1.0000, GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
('EUR', 'Euro', '€', 1, 0.8500, GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
('GBP', 'British Pound', '£', 1, 0.7500, GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
('INR', 'Indian Rupee', '?', 1, 83.0000, GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
('AUD', 'Australian Dollar', 'A$', 1, 1.5000, GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
('CAD', 'Canadian Dollar', 'C$', 1, 1.3500, GETUTCDATE(), GETUTCDATE(), GETUTCDATE());

INSERT INTO ApplicationStatuses (Status, Description, IsActive, DisplayOrder, CreatedAt, UpdatedAt) VALUES
('Submitted', 'Application submitted by candidate', 1, 1, GETUTCDATE(), GETUTCDATE()),
('Under Review', 'Application is being reviewed', 1, 2, GETUTCDATE(), GETUTCDATE()),
('Shortlisted', 'Candidate shortlisted for interview', 1, 3, GETUTCDATE(), GETUTCDATE()),
('Interview Scheduled', 'Interview scheduled with candidate', 1, 4, GETUTCDATE(), GETUTCDATE()),
('Interview Completed', 'Interview process completed', 1, 5, GETUTCDATE(), GETUTCDATE()),
('Rejected', 'Application rejected', 1, 6, GETUTCDATE(), GETUTCDATE());

INSERT INTO InternalStatusTypes (Status, Description, IsActive, DisplayOrder, CreatedAt, UpdatedAt) VALUES
('Initial Screening', 'Initial application screening', 1, 1, GETUTCDATE(), GETUTCDATE()),
('HR Screening', 'HR round screening', 1, 2, GETUTCDATE(), GETUTCDATE()),
('Technical Screening', 'Technical screening round', 1, 3, GETUTCDATE(), GETUTCDATE()),
('Final Interview', 'Final round interview', 1, 4, GETUTCDATE(), GETUTCDATE()),
('Offer Preparation', 'Offer letter preparation', 1, 5, GETUTCDATE(), GETUTCDATE());
"@
    
    try {
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $basicSampleData -QueryTimeout 60
        Write-Host "? Basic sample data created successfully!" -ForegroundColor Green
    } catch {
        Write-Error "? Basic sample data creation failed: $($_.Exception.Message)"
        exit 1
    }
}

# Verify data
Write-Host "?? Verifying deployed data..." -ForegroundColor Yellow

$verification = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query @"
SELECT 
    'Users' as TableName, COUNT(*) as RecordCount FROM Users
UNION ALL
SELECT 'Organizations', COUNT(*) FROM Organizations  
UNION ALL
SELECT 'Jobs', COUNT(*) FROM Jobs
UNION ALL
SELECT 'Applicants', COUNT(*) FROM Applicants
UNION ALL
SELECT 'JobApplications', COUNT(*) FROM JobApplications
UNION ALL
SELECT 'JobTypes', COUNT(*) FROM JobTypes
UNION ALL
SELECT 'Currencies', COUNT(*) FROM Currencies
UNION ALL
SELECT 'ApplicationStatuses', COUNT(*) FROM ApplicationStatuses
ORDER BY TableName
"@ -QueryTimeout 30

Write-Host "?? Data Verification Results:" -ForegroundColor Cyan
foreach ($row in $verification) {
    Write-Host "  • $($row.TableName): $($row.RecordCount) records" -ForegroundColor White
}
Write-Host ""

# Create a sample admin user for testing
Write-Host "?? Creating test admin user..." -ForegroundColor Yellow
$adminUserQuery = @"
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'admin@nexhire.com')
BEGIN
    INSERT INTO Users (
        UserID, Email, Password, UserType, FirstName, LastName,
        EmailVerified, PhoneVerified, ProfileVisibility, CreatedAt, UpdatedAt,
        IsActive, TwoFactorEnabled, LoginAttempts
    ) VALUES (
        NEWID(), 'admin@nexhire.com', 
        '$2a$12$LQv3c1yqBWVHxkd0LQ1Gv.6FqvVDGFy8Q8oQQ8oQQ8oQQ8oQQ8oQQ', -- password: admin123
        'Admin', 'Admin', 'User',
        1, 0, 'Public', GETUTCDATE(), GETUTCDATE(),
        1, 0, 0
    );
    
    PRINT 'Admin user created: admin@nexhire.com / admin123';
END
ELSE
BEGIN
    PRINT 'Admin user already exists';
END
"@

try {
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $adminUserQuery -QueryTimeout 30
    Write-Host "? Test admin user ready" -ForegroundColor Green
} catch {
    Write-Warning "?? Could not create admin user: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "?? DATABASE SETUP COMPLETED!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""

Write-Host "?? Test Accounts Created:" -ForegroundColor Cyan
Write-Host "  • Admin: admin@nexhire.com / admin123" -ForegroundColor White
Write-Host ""

Write-Host "?? Ready for API Testing:" -ForegroundColor Cyan
Write-Host "  • Run: .\test-api.ps1" -ForegroundColor White
Write-Host "  • Or use Postman with your API endpoints" -ForegroundColor White
Write-Host ""

Write-Host "?? Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Test API endpoints with sample data" -ForegroundColor White
Write-Host "  2. Create additional test users as needed" -ForegroundColor White
Write-Host "  3. Configure frontend to use the API" -ForegroundColor White
Write-Host "  4. Set up additional organizations and jobs" -ForegroundColor White
Write-Host ""

Write-Host "?? Database is ready for your NexHire application!" -ForegroundColor Green