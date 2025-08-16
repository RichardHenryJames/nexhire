# Quick Reference Data Population Script
# This script populates only the essential reference data needed for the APIs to work

param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host " Populating Essential Reference Data..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host " Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Quick Reference Data Population
$referenceDataSQL = @"
-- Clear and repopulate JobTypes
DELETE FROM JobTypes;
DBCC CHECKIDENT ('JobTypes', RESEED, 0);

INSERT INTO JobTypes (Type, Description, IsActive) VALUES
('Full-time', 'Full-time permanent position', 1),
('Part-time', 'Part-time position', 1),
('Contract', 'Contract-based position', 1),
('Freelance', 'Freelance work', 1),
('Internship', 'Internship position', 1),
('Temporary', 'Temporary position', 1),
('Remote', 'Remote work position', 1),
('Hybrid', 'Hybrid work arrangement', 1);

-- Clear and repopulate Currencies
DELETE FROM Currencies;
DBCC CHECKIDENT ('Currencies', RESEED, 0);

INSERT INTO Currencies (Code, Name, Symbol, IsActive) VALUES
('USD', 'US Dollar', '$', 1),
('EUR', 'Euro', '�', 1),
('GBP', 'British Pound', '�', 1),
('INR', 'Indian Rupee', '?', 1),
('CAD', 'Canadian Dollar', 'C$', 1),
('AUD', 'Australian Dollar', 'A$', 1),
('JPY', 'Japanese Yen', '�', 1),
('CNY', 'Chinese Yuan', '�', 1),
('SGD', 'Singapore Dollar', 'S$', 1),
('AED', 'UAE Dirham', '?.?', 1);

-- Clear and repopulate ApplicationStatuses
DELETE FROM ApplicationStatuses;
DBCC CHECKIDENT ('ApplicationStatuses', RESEED, 0);

INSERT INTO ApplicationStatuses (Status, Description, IsActive) VALUES
('Submitted', 'Application has been submitted', 1),
('Under Review', 'Application is being reviewed', 1),
('Shortlisted', 'Candidate has been shortlisted', 1),
('Interview Scheduled', 'Interview has been scheduled', 1),
('Interview Completed', 'Interview has been completed', 1),
('Rejected', 'Application has been rejected', 1),
('Offer Extended', 'Job offer has been extended', 1),
('Offer Accepted', 'Job offer has been accepted', 1),
('Offer Declined', 'Job offer has been declined', 1),
('Withdrawn', 'Application has been withdrawn', 1);

-- Clear and repopulate InternalStatusTypes
DELETE FROM InternalStatusTypes;
DBCC CHECKIDENT ('InternalStatusTypes', RESEED, 0);

INSERT INTO InternalStatusTypes (Status, Description, IsActive) VALUES
('Initial Screening', 'Initial application screening', 1),
('HR Screening', 'HR round screening', 1),
('Technical Screening', 'Technical screening round', 1),
('Final Interview', 'Final round interview', 1),
('Offer Preparation', 'Offer letter preparation', 1),
('Background Check', 'Background verification', 1);

-- Create a demo organization if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM Organizations WHERE Name = 'NexHire Demo Company')
BEGIN
    INSERT INTO Organizations (OrganizationID, Name, Type, Industry, Size, Description, VerificationStatus, IsActive)
    VALUES 
    (NEWID(), 'NexHire Demo Company', 'Technology', 'Software Development', '51-200', 'A demo company for testing the NexHire platform APIs and functionality', 'Verified', 1);
END
"@

try {
    Write-Host " Populating reference data..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referenceDataSQL -QueryTimeout 60
    Write-Host "? Reference data populated successfully!" -ForegroundColor Green
    
    # Verify the data
    Write-Host " Verifying reference data..." -ForegroundColor Yellow
    
    $jobTypesCount = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM JobTypes WHERE IsActive = 1" -QueryTimeout 30
    $currenciesCount = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM Currencies WHERE IsActive = 1" -QueryTimeout 30
    $statusesCount = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM ApplicationStatuses WHERE IsActive = 1" -QueryTimeout 30
    $orgCount = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM Organizations WHERE IsActive = 1" -QueryTimeout 30
    
    Write-Host "? Reference data verification:" -ForegroundColor Green
    Write-Host "  � Job Types: $($jobTypesCount.Count)" -ForegroundColor Cyan
    Write-Host "  � Currencies: $($currenciesCount.Count)" -ForegroundColor Cyan
    Write-Host "  � Application Statuses: $($statusesCount.Count)" -ForegroundColor Cyan
    Write-Host "  � Organizations: $($orgCount.Count)" -ForegroundColor Cyan
    
} catch {
    Write-Error "? Reference data population failed: $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host " Reference data is ready!" -ForegroundColor Green
Write-Host "? Your APIs should now work correctly." -ForegroundColor Green
Write-Host ""
Write-Host " Test your APIs now:" -ForegroundColor Cyan
Write-Host "  .\test-api.ps1 -BaseUrl 'https://nexhire-api-func.azurewebsites.net/api'" -ForegroundColor Yellow