# Scripts Directory

Organized collection of PowerShell and JavaScript scripts for RefOpen.

## 📁 Folder Structure

```
scripts/
├── database/         # Database setup, migrations, indexes
├── data-generation/  # Generate test data, enrich organizations
├── deployment/       # Deploy backend, frontend, sync env vars
├── job-scraping/     # Job scraper management
├── maintenance/      # Cleanup, benchmarks, diagnostics
└── utils/            # Helper scripts (credentials, env loading)
```

## 🔐 Before Running Scripts

**All scripts require database credentials.** Load them first:

```powershell
# Load credentials from Azure Key Vault (recommended)
. .\scripts\utils\Load-DbCredentials.ps1

# Now run any script
.\scripts\database\setup-database.ps1
.\scripts\data-generation\enrich-organizations.ps1 -DryRun
```

## 📂 Script Categories

### `/database` - Database Scripts
| Script | Description |
|--------|-------------|
| `setup-database.ps1` | Create all database tables |
| `wallet-schema.ps1` | Wallet/payment tables |
| `referral-schema.ps1` | Referral system tables |
| `rebuild-all-indexes.ps1` | Rebuild fragmented indexes |
| `diagnose-performance.ps1` | Performance diagnostics |

### `/data-generation` - Data Scripts
| Script | Description |
|--------|-------------|
| `generate-indian-users.ps1` | Generate 1000 Indian test users |
| `generate-us-users.ps1` | Generate 1000 US test users |
| `enrich-organizations.ps1` | Fetch missing org data from APIs |
| `update-org-logos.ps1` | Update organization logos |

### `/deployment` - Deployment Scripts
| Script | Description |
|--------|-------------|
| `deploy-infrastructure.ps1` | **Create full Azure infrastructure** (supports all environments) |
| `deploy-backend.ps1` | Deploy Azure Function App |
| `deployfe.ps1` | Deploy frontend to Static Web App |
| `sync-env-variables.ps1` | Sync .env to Azure Function App |
| `deploy-email-service.ps1` | Deploy email service configuration |
| `deploy-env-from-json.ps1` | Deploy environment from JSON config |

### `/job-scraping` - Job Scraper Scripts
| Script | Description |
|--------|-------------|
| `Manage-JobScraper.ps1` | Start/stop/status of job scraper |
| `Run-AllScrapers.ps1` | Run all job scrapers |
| `test-job-archival.ps1` | Test job archival process |

### `/maintenance` - Maintenance Scripts
| Script | Description |
|--------|-------------|
| `cleanup-duplicate-organizations.ps1` | Remove duplicate orgs |
| `cleanup-invalid-organizations.ps1` | Remove invalid orgs |
| `benchmark-api.ps1` | API performance benchmarks |

### `/utils` - Utility Scripts
| Script | Description |
|--------|-------------|
| `Load-DbCredentials.ps1` | Load DB credentials from Key Vault |
| `Load-EnvFile.ps1` | Load env vars from .env file |

## 💡 Common Commands

```powershell
# ==============================
# INFRASTRUCTURE DEPLOYMENT
# ==============================

# Create NEW environment infrastructure (dev, staging, prod, etc.)
.\scripts\deployment\deploy-infrastructure.ps1 -Environment dev
.\scripts\deployment\deploy-infrastructure.ps1 -Environment prod
.\scripts\deployment\deploy-infrastructure.ps1 -Environment staging

# Dry run (see what will be created without creating)
.\scripts\deployment\deploy-infrastructure.ps1 -Environment dev -DryRun

# Skip confirmation prompt
.\scripts\deployment\deploy-infrastructure.ps1 -Environment dev -SkipConfirmation

# ==============================
# DATABASE SETUP
# ==============================

# Setup database from scratch
. .\scripts\utils\Load-DbCredentials.ps1
.\scripts\database\setup-database.ps1

# ==============================
# TEST DATA
# ==============================

# Generate test users
.\scripts\data-generation\generate-indian-users.ps1 -UserCount 100 -DryRun

# ==============================
# CODE DEPLOYMENT
# ==============================

# Deploy backend (dev)
.\deploy-backend.ps1 -Environment dev

# Deploy backend (prod)
.\deploy-backend.ps1 -Environment prod

# Deploy frontend (dev)
.\deployfe.ps1 -Environment dev

# Deploy frontend (prod)
.\deployfe.ps1 -Environment prod

# ==============================
# ENVIRONMENT SYNC
# ==============================

# Sync environment variables to Azure
.\scripts\deployment\sync-env-variables.ps1 -Environment dev
.\scripts\deployment\sync-env-variables.ps1 -Environment prod
```
