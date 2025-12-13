# ================================================================
# Generate 1000 Realistic Indian Users Script
# ================================================================
# Creates 1000 users with Indian names, assigns them to
# Indian engineering colleges, adds work experience with
# Fortune 500 companies, and populates all related tables
# ================================================================

param(
    [string]$ConnectionString = "Server=refopen-sqlserver-ci.database.windows.net;Database=refopen-sql-db;User ID=sqladmin;Password=RefOpen@2024!Secure;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    [int]$UserCount = 1000,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " GENERATE 1000 REALISTIC INDIAN USERS" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No database changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# ================================================================
# Install Required Modules
# ================================================================
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# ================================================================
# Load Data Files
# ================================================================
Write-Host "Step 1: Loading data files..." -ForegroundColor Cyan

$firstNames = Get-Content -Path "data/indian-first-names.txt" | Where-Object { $_.Trim() -ne "" }
$lastNames = Get-Content -Path "data/indian-last-names.txt" | Where-Object { $_.Trim() -ne "" }
$colleges = Get-Content -Path "data/indian-engineering-colleges.txt" | Where-Object { $_.Trim() -ne "" }

# Fortune 500 companies for work experience
$fortune500Companies = @(
    'Tata Consultancy Services', 'Infosys', 'Wipro', 'HCL Technologies', 'Tech Mahindra',
    'Cognizant', 'Accenture', 'Capgemini', 'Deloitte', 'Amazon', 'Microsoft', 'Google',
    'Apple', 'IBM', 'Oracle', 'Intel', 'Cisco', 'Dell', 'HP', 'Adobe', 'Salesforce',
    'SAP', 'VMware', 'ServiceNow', 'Workday', 'Zoom', 'Atlassian', 'Stripe', 'Shopify',
    'JPMorgan Chase', 'Bank of America', 'Goldman Sachs', 'Morgan Stanley', 'Citigroup',
    'Wells Fargo', 'NVIDIA', 'Tesla', 'Meta', 'Netflix', 'PayPal', 'Uber', 'Airbnb',
    'American Express', 'Capital One', 'Walmart', 'Target', 'Costco', 'Amazon Web Services',
    'ICICI Bank', 'HDFC Bank', 'State Bank of India', 'Reliance Industries', 'Tata Motors',
    'Mahindra', 'Bharti Airtel', 'Flipkart', 'PhonePe', 'Paytm', 'Ola', 'Swiggy', 'Zomato'
)

# Job titles for engineers
$engineeringTitles = @(
    'Software Engineer', 'Senior Software Engineer', 'Software Developer', 'Full Stack Developer',
    'Backend Developer', 'Frontend Developer', 'DevOps Engineer', 'Cloud Engineer', 
    'Data Engineer', 'Machine Learning Engineer', 'AI Engineer', 'Data Scientist',
    'Systems Engineer', 'Network Engineer', 'Security Engineer', 'QA Engineer',
    'Test Engineer', 'Automation Engineer', 'Site Reliability Engineer', 'Platform Engineer',
    'Technical Lead', 'Engineering Manager', 'Product Engineer', 'Solutions Engineer',
    'Application Developer', 'Mobile Developer', 'iOS Developer', 'Android Developer',
    'React Developer', 'Java Developer', 'Python Developer', '.NET Developer',
    'Database Engineer', 'ETL Developer', 'Big Data Engineer', 'Analytics Engineer'
)

# Skills for engineers
$technicalSkills = @(
    'Java', 'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift',
    'React', 'Angular', 'Vue.js', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'ASP.NET',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'DynamoDB', 'Oracle',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'GitLab CI/CD',
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy',
    'REST APIs', 'GraphQL', 'Microservices', 'System Design', 'Agile', 'Scrum', 'Git', 'Linux'
)

# Degree types
$degreeTypes = @(
    'B.Tech / B.E', 'M.Tech / M.E', 'B.Sc Computer Science', 'M.Sc Computer Science',
    'BCA', 'MCA', 'B.Tech Computer Science', 'B.E Computer Engineering'
)

# Fields of study
$fieldsOfStudy = @(
    'Computer Science & Engineering', 'Information Technology', 'Electronics & Communication Engineering',
    'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Software Engineering',
    'Computer Applications', 'Artificial Intelligence', 'Data Science', 'Cybersecurity'
)

Write-Host "   ? Loaded $($firstNames.Count) first names" -ForegroundColor Green
Write-Host "   ? Loaded $($lastNames.Count) last names" -ForegroundColor Green
Write-Host "   ? Loaded $($colleges.Count) engineering colleges" -ForegroundColor Green
Write-Host "   ? Loaded $($fortune500Companies.Count) companies" -ForegroundColor Green
Write-Host ""

# ================================================================
# Query Database Schema
# ================================================================
Write-Host "Step 2: Querying database schema..." -ForegroundColor Cyan

$schemaQueries = @{
    Users = @"
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users'
ORDER BY ORDINAL_POSITION
"@
    Applicants = @"
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Applicants'
ORDER BY ORDINAL_POSITION
"@
    WorkExperiences = @"
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'WorkExperiences'
ORDER BY ORDINAL_POSITION
"@
    Colleges = @"
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Colleges'
ORDER BY ORDINAL_POSITION
"@
}

$schemas = @{}
foreach ($tableName in $schemaQueries.Keys) {
    try {
        $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $schemaQueries[$tableName] -QueryTimeout 30
        $schemas[$tableName] = $result
        Write-Host "   ? $tableName schema loaded ($($result.Count) columns)" -ForegroundColor Green
    } catch {
        Write-Host "   ?? $tableName schema not found (table might not exist)" -ForegroundColor Yellow
    }
}
Write-Host ""

# ================================================================
# Check Existing Colleges
# ================================================================
Write-Host "Step 3: Checking existing colleges in database..." -ForegroundColor Cyan

$existingCollegesQuery = @"
SELECT CollegeID, Name, Type, Country, State
FROM Colleges
WHERE Country = 'India'
ORDER BY Name
"@

try {
    $existingColleges = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $existingCollegesQuery -QueryTimeout 30
    Write-Host "   ? Found $($existingColleges.Count) existing Indian colleges in database" -ForegroundColor Green
    
    if ($existingColleges.Count -lt 50) {
        Write-Host "   ?? Limited colleges found, will use college names from file" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ?? Colleges table not accessible, will use college names only" -ForegroundColor Yellow
    $existingColleges = @()
}
Write-Host ""

# ================================================================
# Helper Functions
# ================================================================

function Get-RandomItem {
    param([array]$Array)
    return $Array | Get-Random
}

function Get-RandomEmail {
    param([string]$FirstName, [string]$LastName)
    
    $domains = @('gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com')
    
    # Randomly choose separator (. _ or none)
    $separatorChoice = Get-Random -Minimum 0 -Maximum 3
    $separator = switch ($separatorChoice) {
        0 { '.' }
        1 { '_' }
        2 { '' }
    }
    
    # Randomly add numeric suffix or not
    $suffixChoice = Get-Random -Minimum 0 -Maximum 2
    $suffix = if ($suffixChoice -eq 1) { (Get-Random -Minimum 1 -Maximum 999).ToString() } else { '' }
    
    $email = "$($FirstName.ToLower())$separator$($LastName.ToLower())$suffix@$(Get-RandomItem -Array $domains)"
    return $email
}

function Get-RandomPhoneNumber {
    $prefixes = @('9', '8', '7', '6')
    $prefix = Get-RandomItem -Array $prefixes
    $number = "$prefix"
    for ($i = 0; $i -lt 9; $i++) {
        $number += Get-Random -Minimum 0 -Maximum 10
    }
    return "+91$number"
}

function Get-RandomDate {
    param(
        [DateTime]$StartDate,
        [DateTime]$EndDate
    )
    
    $span = $EndDate - $StartDate
    $randomDays = Get-Random -Minimum 0 -Maximum $span.Days
    return $StartDate.AddDays($randomDays)
}

function Get-RandomSkills {
    param([int]$Count = 8)
    
    $selected = $technicalSkills | Get-Random -Count $Count
    return ($selected -join ', ')
}

function New-Guid {
    return [System.Guid]::NewGuid().ToString()
}

# ================================================================
# Generate Users
# ================================================================

Write-Host "Step 4: Generating $UserCount users..." -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "   ?? DRY RUN - Showing first 5 sample users:" -ForegroundColor Yellow
    for ($i = 1; $i -le 5; $i++) {
        $firstName = Get-RandomItem -Array $firstNames
        $lastName = Get-RandomItem -Array $lastNames
        $email = Get-RandomEmail -FirstName $firstName -LastName $lastName
        $college = Get-RandomItem -Array $colleges
        $company = Get-RandomItem -Array $fortune500Companies
        $title = Get-RandomItem -Array $engineeringTitles
        
        Write-Host ""
        Write-Host "      User #$i" -ForegroundColor White
        Write-Host "      Name: $firstName $lastName" -ForegroundColor Gray
        Write-Host "      Email: $email" -ForegroundColor Gray
        Write-Host "      College: $college" -ForegroundColor Gray
        Write-Host "      Current: $title at $company" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "   ?? Run without -DryRun to insert into database" -ForegroundColor Cyan
    exit 0
}

$successCount = 0
$errorCount = 0
$startTime = Get-Date

# Create a hash table to track used emails
$usedEmails = @{}

# Get existing emails to avoid duplicates
try {
    $existingEmailsQuery = "SELECT Email FROM Users"
    $existingEmailsResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $existingEmailsQuery -QueryTimeout 30
    foreach ($row in $existingEmailsResult) {
        $usedEmails[$row.Email] = $true
    }
    Write-Host "   ?? Found $($usedEmails.Count) existing users, will avoid duplicate emails" -ForegroundColor Cyan
} catch {
    Write-Host "   ?? Could not check existing emails" -ForegroundColor Yellow
}

for ($i = 1; $i -le $UserCount; $i++) {
    try {
        # Generate unique user data
        $firstName = Get-RandomItem -Array $firstNames
        $lastName = Get-RandomItem -Array $lastNames
        
        # Generate unique email
        $email = ""
        $attempts = 0
        do {
            $email = Get-RandomEmail -FirstName $firstName -LastName $lastName
            $attempts++
        } while ($usedEmails.ContainsKey($email) -and $attempts -lt 10)
        
        if ($usedEmails.ContainsKey($email)) {
            # If still duplicate after 10 attempts, add timestamp
            $email = "$($firstName.ToLower()).$($lastName.ToLower()).$([DateTimeOffset]::Now.ToUnixTimeSeconds())@gmail.com"
        }
        
        $usedEmails[$email] = $true
        
        # Generate random password hash (bcrypt hash of "Password123!")
        $passwordHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
        
        # User IDs
        $userId = New-Guid
        $applicantId = $userId  # Same as UserID for Applicants
        
        # Random phone
        $phone = Get-RandomPhoneNumber
        
        # Random age (22-35 for fresh to experienced engineers)
        $age = Get-Random -Minimum 22 -Maximum 36
        $birthYear = (Get-Date).Year - $age
        $dob = Get-Date -Year $birthYear -Month (Get-Random -Minimum 1 -Maximum 13) -Day (Get-Random -Minimum 1 -Maximum 29)
        
        # Random gender
        $gender = Get-RandomItem -Array @('Male', 'Female', 'Other')
        
        # Random college
        $collegeName = Get-RandomItem -Array $colleges
        
        # Random degree
        $degreeType = Get-RandomItem -Array $degreeTypes
        $fieldOfStudy = Get-RandomItem -Array $fieldsOfStudy
        
        # Graduation year (2015-2024)
        $graduationYear = Get-Random -Minimum 2015 -Maximum 2025
        
        # Experience years (0-12 years)
        $experienceYears = Get-Random -Minimum 0 -Maximum 13
        
        # Current company and title
        $currentCompany = Get-RandomItem -Array $fortune500Companies
        $currentTitle = Get-RandomItem -Array $engineeringTitles
        
        # Skills
        $primarySkills = Get-RandomSkills -Count (Get-Random -Minimum 5 -Maximum 10)
        $secondarySkills = Get-RandomSkills -Count (Get-Random -Minimum 3 -Maximum 6)
        
        # Random city
        $indianCities = @('Bangalore', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Noida', 'Gurgaon')
        $city = Get-RandomItem -Array $indianCities
        
        # Salary (3-50 LPA based on experience)
        $salaryLPA = if ($experienceYears -eq 0) { 
            Get-Random -Minimum 3 -Maximum 8
        } elseif ($experienceYears -le 3) { 
            Get-Random -Minimum 6 -Maximum 15
        } elseif ($experienceYears -le 6) { 
            Get-Random -Minimum 12 -Maximum 30
        } else { 
            Get-Random -Minimum 25 -Maximum 55
        }
        $currentSalary = $salaryLPA * 100000
        
        # OpenToRefer should be true for all (set in Applicants table, not Users)
        $openToRefer = 1
        
        # 1. Insert into Users table
        $userQuery = @"
INSERT INTO Users (
    UserID, Email, Password, FirstName, LastName, UserType, Phone,
    EmailVerified, IsActive, CreatedAt, UpdatedAt
)
VALUES (
    '$userId', '$email', '$passwordHash', '$firstName', '$lastName', 'JobSeeker', '$phone',
    1, 1, GETUTCDATE(), GETUTCDATE()
)
"@
        
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $userQuery -QueryTimeout 30 -ErrorAction Stop
        
        # 2. Insert into Applicants table
        $applicantQuery = @"
INSERT INTO Applicants (
    ApplicantID, UserID, CurrentLocation, PrimarySkills, Institution, 
    FieldOfStudy, GraduationYear, TotalExperienceMonths, CurrentCompanyName, 
    CurrentJobTitle, OpenToRefer, IsOpenToWork, ProfileCompleteness, CreatedAt, UpdatedAt
)
VALUES (
    '$applicantId', '$userId', '$city', '$primarySkills', '$collegeName',
    '$fieldOfStudy', '$graduationYear', $($experienceYears * 12), '$currentCompany',
    '$currentTitle', $openToRefer, 1, 85, GETUTCDATE(), GETUTCDATE()
)
"@
        
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $applicantQuery -QueryTimeout 30 -ErrorAction Stop
        
        # 3. Add work experiences (1-3 companies for experienced professionals)
        if ($experienceYears -gt 0) {
            $numJobs = if ($experienceYears -le 2) { 1 } elseif ($experienceYears -le 5) { Get-Random -Minimum 1 -Maximum 3 } else { Get-Random -Minimum 2 -Maximum 4 }
            
            $currentDate = Get-Date
            $lastEndDate = $currentDate
            
            for ($j = 0; $j -lt $numJobs; $j++) {
                $experienceId = New-Guid
                $company = if ($j -eq 0) { $currentCompany } else { Get-RandomItem -Array $fortune500Companies }
                $jobTitle = if ($j -eq 0) { $currentTitle } else { Get-RandomItem -Array $engineeringTitles }
                
                # Calculate dates (working backwards from current)
                $isCurrent = if ($j -eq 0) { 1 } else { 0 }
                
                if ($isCurrent -eq 1) {
                    $endDate = $null
                } else {
                    $randomDays = Get-Random -Minimum 30 -Maximum 180
                    $endDate = $lastEndDate.AddDays(-$randomDays)
                }
                
                if ($endDate) {
                    $randomYears = Get-Random -Minimum 1 -Maximum 4
                    $startDate = $endDate.AddYears(-$randomYears)
                } else {
                    $randomYears = Get-Random -Minimum 1 -Maximum 3
                    $startDate = $currentDate.AddYears(-$randomYears)
                }
                
                if ($endDate) {
                    $lastEndDate = $startDate
                }
                
                $workExpQuery = @"
INSERT INTO WorkExperiences (
    WorkExperienceID, ApplicantID, CompanyName, JobTitle, StartDate, EndDate,
    IsCurrent, Location, Skills, IsActive, CreatedAt, UpdatedAt
)
VALUES (
    '$experienceId', '$applicantId', '$company', '$jobTitle', '$($startDate.ToString('yyyy-MM-dd'))', 
    $(if ($endDate) { "'$($endDate.ToString('yyyy-MM-dd'))'" } else { "NULL" }),
    $isCurrent, '$city', '$primarySkills', 1, GETUTCDATE(), GETUTCDATE()
)
"@
                
                Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $workExpQuery -QueryTimeout 30 -ErrorAction Stop
            }
        }
        
        $successCount++
        
        # Progress indicator every 50 users
        if ($i % 50 -eq 0) {
            $elapsed = (Get-Date) - $startTime
            $rate = $i / $elapsed.TotalSeconds
            $remaining = ($UserCount - $i) / $rate
            
            Write-Host "   ? Progress: $i / $UserCount users created ($([math]::Round($rate, 2)) users/sec, ~$([math]::Round($remaining, 0))s remaining)" -ForegroundColor Cyan
        }
        
    } catch {
        Write-Host "   ? Error creating user #$i`: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
        
        # Stop if too many errors
        if ($errorCount -gt 10) {
            Write-Host ""
            Write-Host "   ?? Too many errors, stopping..." -ForegroundColor Red
            break
        }
    }
}

$elapsed = (Get-Date) - $startTime

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " GENERATION COMPLETE" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Statistics:" -ForegroundColor Cyan
Write-Host "   ? Successfully created: $successCount users" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "   ? Errors: $errorCount" -ForegroundColor Red
}
Write-Host "   ?? Time taken: $([math]::Round($elapsed.TotalMinutes, 2)) minutes" -ForegroundColor White
Write-Host "   ?? Average rate: $([math]::Round($successCount / $elapsed.TotalSeconds, 2)) users/second" -ForegroundColor White
Write-Host ""

# Verify data
Write-Host "Verification:" -ForegroundColor Cyan

$verificationQueries = @{
    "Total Users" = "SELECT COUNT(*) as Count FROM Users WHERE UserType = 'JobSeeker'"
    "Total Applicants" = "SELECT COUNT(*) as Count FROM Applicants"
    "Users with Experience" = "SELECT COUNT(DISTINCT ApplicantID) as Count FROM WorkExperiences"
    "Total Work Experiences" = "SELECT COUNT(*) as Count FROM WorkExperiences"
    "Open to Refer" = "SELECT COUNT(*) as Count FROM Applicants WHERE OpenToRefer = 1"
}

foreach ($key in $verificationQueries.Keys) {
    try {
        $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $verificationQueries[$key] -QueryTimeout 30
        Write-Host "   • $key`: $($result.Count)" -ForegroundColor White
    } catch {
        Write-Host "   • $key`: Unable to verify" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "? All done! $successCount realistic Indian users have been created." -ForegroundColor Green
Write-Host ""
Write-Host "Sample queries to test:" -ForegroundColor Cyan
Write-Host "   SELECT TOP 10 * FROM Users WHERE UserType = 'JobSeeker' ORDER BY CreatedAt DESC" -ForegroundColor Gray
Write-Host "   SELECT TOP 10 u.FirstName, u.LastName, u.Email, a.CurrentCompany, a.TotalExperienceYears" -ForegroundColor Gray
Write-Host "   FROM Users u INNER JOIN Applicants a ON u.UserID = a.ApplicantID" -ForegroundColor Gray
Write-Host "   ORDER BY u.CreatedAt DESC" -ForegroundColor Gray
Write-Host ""
