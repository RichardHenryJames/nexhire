param(
    [string]$ResourceGroup = "",  # Auto-detected based on environment
    [string]$StaticAppName = "",  # Auto-detected based on environment
    [string]$Environment = "production",  # dev, staging, production
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb"
)

$ErrorActionPreference = "Stop"

Write-Host "=== RefOpen/RefOpen Frontend Build & Deploy ===" -ForegroundColor Cyan

# Normalize environment
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }
    { $_ -in @("prod", "production") } { "prod" }
    default { "prod" }
}

# Env-specific resources
# PRODUCTION = RefOpen infrastructure
# DEV/STAGING = RefOpen infrastructure
$azureResources = switch ($normalizedEnv) {
    "dev" {
        @{ 
            ResourceGroup = "refopen-dev-rg"
            StaticAppName = "refopen-frontend-dev"
            FunctionAppName = "refopen-api-func-dev"
            Infrastructure = "RefOpen"
        }
    }
    "staging" {
        @{ 
            ResourceGroup = "refopen-dev-rg"
            StaticAppName = "refopen-frontend-staging"
            FunctionAppName = "refopen-api-func-staging"
            Infrastructure = "RefOpen"
        }
    }
    "prod" {
        @{ 
            ResourceGroup = "refopen-prod-rg"
            StaticAppName = "refopen-frontend-web"
            FunctionAppName = "refopen-api-func"
            Infrastructure = "RefOpen"
        }
    }
}

# Override with parameters if provided
if ($ResourceGroup) { $azureResources.ResourceGroup = $ResourceGroup }
if ($StaticAppName) { $azureResources.StaticAppName = $StaticAppName }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "        FRONTEND DEPLOYMENT CONFIGURATION              " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Environment: $normalizedEnv" -ForegroundColor Green
Write-Host "Infrastructure: $($azureResources.Infrastructure)" -ForegroundColor $(if ($normalizedEnv -eq "prod") { "Magenta" } else { "Yellow" })
Write-Host "Resource Group: $($azureResources.ResourceGroup)" -ForegroundColor White
Write-Host "Static Web App: $($azureResources.StaticAppName)" -ForegroundColor White
Write-Host "Function App: $($azureResources.FunctionAppName)" -ForegroundColor White
Write-Host ""

# Set Azure subscription
Write-Host "Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set subscription"
    exit 1
}
Write-Host "Subscription set" -ForegroundColor Green

# Step 1: Switch to frontend directory
if (-not (Test-Path "frontend")) {
    Write-Error "Frontend directory not found!"
    exit 1
}

Set-Location "frontend"
Write-Host "`nChanged to frontend directory" -ForegroundColor Cyan

# Step 2: Switch environment file
$envFile = ".env.$normalizedEnv"
Write-Host "`nSwitching to $envFile..." -ForegroundColor Yellow

if (Test-Path $envFile) {
    Copy-Item $envFile ".env" -Force
    Write-Host "Environment file switched to $envFile" -ForegroundColor Green
    
    # Show key configurations
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "EXPO_PUBLIC_API_URL=(.+)") {
        Write-Host "   API URL: $($matches[1].Trim())" -ForegroundColor Gray
    }
    if ($envContent -match "EXPO_PUBLIC_APP_ENV=(.+)") {
        Write-Host "   App Env: $($matches[1].Trim())" -ForegroundColor Gray
    }
} else {
    Write-Host " Warning: $envFile not found, using existing .env" -ForegroundColor Yellow
    if (Test-Path ".env") {
        Write-Host "   Using existing .env file" -ForegroundColor Gray
    } else {
        Write-Error "No .env file found! Please create .env.$normalizedEnv"
        Set-Location ..
        exit 1
    }
}

# Step 3: Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install failed!"
    Set-Location ..
    exit 1
}
Write-Host "Dependencies installed" -ForegroundColor Green

# Step 4: Clean previous build
if (Test-Path "web-build") {
    Write-Host "`nCleaning previous build..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "web-build"
    Write-Host "Previous build cleaned" -ForegroundColor Green
}

# Step 5: Build frontend
Write-Host "`nBuilding frontend for $normalizedEnv..." -ForegroundColor Yellow
Write-Host "   Platform: web" -ForegroundColor Gray
Write-Host "   Output: web-build/" -ForegroundColor Gray

# Load .env vars into shell environment so Metro can inline EXPO_PUBLIC_* into the web bundle
# (dotenv/config in app.config.js only loads them for that file; Metro needs actual shell env vars)
if (Test-Path ".env") {
    Write-Host "   Loading .env into shell environment..." -ForegroundColor Gray
    $envVarCount = 0
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $key = $Matches[1]
            $val = $Matches[2].Trim()
            # Remove surrounding quotes if present
            if ($val -match '^["''](.*)["'']$') { $val = $Matches[1] }
            [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
            $envVarCount++
        }
    }
    Write-Host "   Loaded $envVarCount env vars for build" -ForegroundColor Gray
}

npx expo export --platform web --output-dir web-build --clear

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    Set-Location ..
    exit 1
}

# Verify build
if (-not (Test-Path "web-build/index.html")) {
    Write-Error "Build failed! No index.html found in web-build/"
    Set-Location ..
    exit 1
}

# Ensure Azure Static Web Apps routing config is included in the deployed output
if (Test-Path "staticwebapp.config.json") {
    Copy-Item "staticwebapp.config.json" "web-build/staticwebapp.config.json" -Force
    Write-Host "Azure SWA config copied to web-build/staticwebapp.config.json" -ForegroundColor Green

    # Replace CSP placeholder tokens with environment-specific hostnames
    $swaConfigPath = "web-build/staticwebapp.config.json"
    $swaContent = Get-Content $swaConfigPath -Raw

    # Environment-specific Azure resource hostnames
    $envHosts = switch ($normalizedEnv) {
        "dev" {
            @{
                API      = "refopen-api-func-dev"
                Storage  = "refopenstoragedev"
                SignalR  = "refopen-signalr-dev"
            }
        }
        "staging" {
            @{
                API      = "refopen-api-func-staging"
                Storage  = "refopenstoragedev"
                SignalR  = "refopen-signalr-dev"
            }
        }
        "prod" {
            @{
                API      = "refopen-api-func"
                Storage  = "refopenstoragesi"
                SignalR  = "refopen-signalr"
            }
        }
    }

    $swaContent = $swaContent -replace '__API_HOST__',     $envHosts.API
    $swaContent = $swaContent -replace '__STORAGE_HOST__', $envHosts.Storage
    $swaContent = $swaContent -replace '__SIGNALR_HOST__', $envHosts.SignalR

    Set-Content $swaConfigPath $swaContent -NoNewline
    Write-Host "   CSP tokens replaced for $normalizedEnv environment:" -ForegroundColor Gray
    Write-Host "     API:     $($envHosts.API).azurewebsites.net" -ForegroundColor Gray
    Write-Host "     Storage: $($envHosts.Storage).blob.core.windows.net" -ForegroundColor Gray
    Write-Host "     SignalR: $($envHosts.SignalR).service.signalr.net" -ForegroundColor Gray
} else {
    Write-Host "Warning: staticwebapp.config.json not found in frontend/. SPA deep links may 404." -ForegroundColor Yellow
}

# Copy public folder assets (favicon, etc.) to web-build - but NOT index.html
if (Test-Path "public") {
    Get-ChildItem "public" -Exclude "index.html" | ForEach-Object {
        Copy-Item $_.FullName "web-build/" -Force -Recurse
    }
    Write-Host "Public folder assets (excluding index.html) copied to web-build/" -ForegroundColor Green
}

# Update the Expo-generated index.html with SEO meta tags
$indexPath = "web-build/index.html"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw
    
    # Replace the title
    $indexContent = $indexContent -replace '<title>.*?</title>', '<title>RefOpen - India''s Leading Job & Referral Platform | Find Jobs, Get Referred, Hire Talent, Earn Rewards</title>'
    
    # Add SEO meta tags after <meta charset>
    # NOTE: Google AdSense script is loaded dynamically by AdCard component
    # to avoid "ads on screens without publisher content" violation
    $seoTags = @"
    <meta name="google-site-verification" content="d2gTyIhcv5i6OYtnNqXg3zOY5nKXykW8_3-QZ4XtD8g" />
    <meta name="description" content="RefOpen - India's leading job & referral platform. Find jobs, get referred to Google, Amazon, Microsoft & 500+ top companies. Hire talent & earn rewards. Apply, Hire, Refer & Earn!" />
    <meta name="keywords" content="refer, referral, job refer, ask for referral, get referred, job referrals, employee referrals, referral request, refer me, refer job, company referral, ask referral, request referral, job referral platform, get job referral, how to get referral, referral for job, job search, find jobs, job apply, apply for job, job application, job vacancy, job openings, fresher jobs, experienced jobs, IT jobs, tech jobs, software jobs, resume, upload resume, job portal, job hunting, career opportunities, hiring, work from home jobs, remote jobs, internship, placement, hire talent, earn rewards, referral bonus" />
    <meta name="author" content="RefOpen" />
    <meta name="robots" content="index, follow" />
    <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://refopen.com/" />
    <meta property="og:title" content="RefOpen - India's Leading Job & Referral Platform | Apply, Hire, Refer, Earn" />
    <meta property="og:description" content="Find jobs, get referred to top companies. Hire talent & earn rewards. India's #1 job & referral platform with 125K+ jobs." />
    <meta property="og:image" content="https://refopen.com/refopen-logo.png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:site_name" content="RefOpen" />
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="RefOpen - India's Leading Job & Referral Platform" />
    <meta name="twitter:description" content="Find jobs, get referred, hire talent & earn rewards. Apply, Hire, Refer & Earn at India's #1 job referral platform." />
    <meta name="twitter:image" content="https://refopen.com/refopen-logo.png" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/jpeg" href="/favicon.jpg" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/refopen-small-logo.jpg" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <meta name="theme-color" content="#6366F1" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7167287641762329" crossorigin="anonymous"></script>
    <link rel="canonical" href="https://refopen.com/" />
    <meta name="application-name" content="RefOpen" />
    <meta name="apple-mobile-web-app-title" content="RefOpen" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "RefOpen",
      "url": "https://refopen.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://refopen.com/refopen-logo.png",
        "width": 512,
        "height": 512
      },
      "image": "https://refopen.com/refopen-logo.png",
      "sameAs": [
        "https://www.linkedin.com/company/refopen"
      ],
      "description": "The leading job referral platform connecting job seekers with employees at top companies. Get referred to your dream job.",
      "foundingDate": "2024",
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "url": "https://www.refopen.com/support"
      }
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "RefOpen - Job Referral & Job Search Platform",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, Android, iOS",
      "description": "Find jobs, apply, and request referrals from employees at top companies. Browse jobs for free, search openings, and boost your chances with employee referrals.",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "1250"
      }
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I ask for a job referral?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Sign up on RefOpen, browse jobs at top companies, and click 'Ask for Referral'. Your request is sent to all employees of that company on the platform who can choose to refer you."
          }
        },
        {
          "@type": "Question",
          "name": "How to find and apply for jobs on RefOpen?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Search for jobs using keywords, location or company name. Browse thousands of job openings and apply directly or request a referral to increase your chances of getting hired."
          }
        },
        {
          "@type": "Question",
          "name": "What features are free on RefOpen?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Creating your profile, browsing all job listings, applying to jobs directly, and receiving referral requests as an employee are completely free. Premium features like referral requests use a convenient pay-per-use wallet system."
          }
        },
        {
          "@type": "Question",
          "name": "Which companies can I get referred to?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "RefOpen has employees from 500+ companies including Google, Amazon, Microsoft, Flipkart, Swiggy, TCS, Infosys, and many more top companies ready to help with referrals."
          }
        },
        {
          "@type": "Question",
          "name": "Can I upload my resume on RefOpen?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, you can upload your resume on RefOpen. Your resume is shared with referrers when you request a job referral, helping them evaluate your profile and increasing your chances of getting referred."
          }
        },
        {
          "@type": "Question",
          "name": "What types of jobs are available on RefOpen?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "RefOpen has jobs for freshers, experienced professionals, IT jobs, software developer jobs, remote jobs, work from home jobs, internships and positions across all industries and experience levels."
          }
        }
      ]
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "RefOpen",
      "url": "https://refopen.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://refopen.com/jobs?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
    </script>
"@
    
    # Only add SEO tags if not already present
    if ($indexContent -notmatch 'og:title') {
        $indexContent = $indexContent -replace '(<meta charset="utf-8"\s*/?>)', "`$1`n$seoTags"
    }
    
    # Add static HTML content for search engine crawlers
    # This content is visible to crawlers but visually hidden from users
    # Using clip-rect technique which is SEO-safe (unlike display:none)
    $staticContent = @"
    <!-- Static content for SEO crawlers - visually hidden but accessible to crawlers -->
    <div id="seo-content" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">
      <header>
        <h1>RefOpen - India's Leading Job & Referral Platform</h1>
        <nav>
          <a href="/jobs">Browse Jobs</a>
          <a href="/referrals">Ask for Referral</a>
          <a href="/about">About Us</a>
          <a href="/blog">Career Blog</a>
        </nav>
      </header>
      <main>
        <article>
          <h2>Find Your Dream Job with Employee Referrals</h2>
          <p>RefOpen connects job seekers with employees at top companies like Google, Amazon, Microsoft, Flipkart, Swiggy, TCS, Infosys and 500+ more. Get referred to your dream job and increase your chances of getting hired by 10x.</p>
          
          <h2>How RefOpen Works</h2>
          <p>1. Create your free profile and upload your resume. 2. Browse thousands of job openings across IT, software, engineering, and more. 3. Apply directly or request a referral from employees at that company. 4. Get referred and boost your chances of landing interviews.</p>
          
          <h2>Browse Jobs by Category</h2>
          <ul>
            <li><a href="/jobs?category=software">Software Developer Jobs</a></li>
            <li><a href="/jobs?category=data">Data Science & Analytics Jobs</a></li>
            <li><a href="/jobs?category=product">Product Management Jobs</a></li>
            <li><a href="/jobs?category=design">UI/UX Design Jobs</a></li>
            <li><a href="/jobs?category=remote">Remote & Work From Home Jobs</a></li>
            <li><a href="/jobs?category=fresher">Fresher Jobs & Internships</a></li>
          </ul>
          
          <h2>Top Companies Hiring</h2>
          <p>Find referrals and job openings at Google, Amazon, Microsoft, Meta, Apple, Flipkart, Swiggy, Zomato, Paytm, PhonePe, Razorpay, TCS, Infosys, Wipro, HCL, Cognizant, Accenture, Deloitte, and hundreds more top employers in India.</p>
          
          <h2>Career Resources</h2>
          <p>Explore our blog for expert career advice on resume writing, interview preparation, salary negotiation, networking, and job search strategies. Learn how to get referrals, prepare for FAANG interviews, and navigate your tech career in India.</p>
          
          <h2>Why Choose RefOpen?</h2>
          <p>Free job search and applications. Direct employee referrals to top companies. 125,000+ active job listings. Trusted by thousands of job seekers and employees. Affordable referral requests with pay-per-use pricing.</p>
        </article>
      </main>
      <footer>
        <p>RefOpen - Apply, Hire, Refer & Earn. India's #1 Job Referral Platform.</p>
        <p>Contact: support@refopen.com</p>
      </footer>
    </div>
    <script>
      // Remove SEO content after React app loads
      window.addEventListener('DOMContentLoaded', function() {
        var seoContent = document.getElementById('seo-content');
        if (seoContent) seoContent.remove();
      });
    </script>
"@
    
    # Add static content before <div id="root">
    $indexContent = $indexContent -replace '(<div id="root"></div>)', "$staticContent`n    `$1"
    
    Set-Content $indexPath $indexContent -NoNewline
    Write-Host "SEO meta tags added to index.html" -ForegroundColor Green
    Write-Host "Static SEO content added for crawlers" -ForegroundColor Green
}

$buildSize = (Get-ChildItem -Path "web-build" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Build completed successfully" -ForegroundColor Green
Write-Host "   Build size: $([math]::Round($buildSize, 2)) MB" -ForegroundColor Gray

# Step 6: Get deployment token
$targetStaticApp = $azureResources.StaticAppName
$targetResourceGroup = $azureResources.ResourceGroup

Write-Host "`nFetching deployment token..." -ForegroundColor Yellow
$deploymentToken = az staticwebapp secrets list `
    --name $targetStaticApp `
    --resource-group $targetResourceGroup `
    --query "properties.apiKey" -o tsv 2>$null

if (-not $deploymentToken) {
    Write-Error "Failed to fetch deployment token for $targetStaticApp in $targetResourceGroup"
    Write-Host "Make sure the Static Web App exists and you have access" -ForegroundColor Yellow
    Set-Location ..
    exit 1
}
Write-Host "Deployment token retrieved" -ForegroundColor Green

# Step 7: Deploy to Azure Static Web App
Write-Host "`nDeploying to Azure Static Web App..." -ForegroundColor Yellow
Write-Host "   Target: $targetStaticApp" -ForegroundColor Gray
Write-Host "   Environment: $normalizedEnv" -ForegroundColor Gray

# Always deploy to the production slot of the target SWA
# For dev, we target the dev SWA (refopen-frontend-dev) production slot
# For prod, we target the prod SWA (refopen-frontend-web) production slot
swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken --env production

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed!"
    Set-Location ..
    exit 1
}

# Step 8: Success summary
$deploymentUrl = "https://$targetStaticApp.azurestaticapps.net"

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "    FRONTEND DEPLOYMENT COMPLETED SUCCESSFULLY      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

Write-Host "`nDeployment Summary:" -ForegroundColor Cyan
Write-Host "   Infrastructure: $($azureResources.Infrastructure)" -ForegroundColor White
Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
Write-Host "   Static Web App: $targetStaticApp" -ForegroundColor White
Write-Host "   Resource Group: $targetResourceGroup" -ForegroundColor White

Write-Host "`nAccess your frontend at:" -ForegroundColor Cyan
Write-Host "   $deploymentUrl" -ForegroundColor Green

if ($normalizedEnv -eq "prod") {
    Write-Host "`nCustom Domains:" -ForegroundColor Cyan
    Write-Host "   https://refopen.com (if configured)" -ForegroundColor White
    Write-Host "   https://www.refopen.com (if configured)" -ForegroundColor White
}

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "   1. Open: $deploymentUrl" -ForegroundColor White
Write-Host "   2. Test all functionality" -ForegroundColor White
Write-Host "   3. Check browser console for errors" -ForegroundColor White
if ($normalizedEnv -eq "prod") {
    Write-Host "   4. Verify API calls to: https://refopen-api-func.azurewebsites.net/api" -ForegroundColor White
}

Set-Location ..

Write-Host "`nFrontend deployment script completed!" -ForegroundColor Green
