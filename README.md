# NexHire - Modern Job Platform

## Technical Stack Overview

### Frontend (Web/Mobile)
- **Technology**: React + React Native
- **Hosting**: Azure Static Web Apps
- **Benefits**:
  - Free tier for basic hosting needs
  - Global CDN with automatic scaling
  - Built-in CI/CD from GitHub
  - Zero-config deployment
  - Pay-per-use model for traffic
  - Native mobile capabilities with React Native

### Backend
- **Technology**: Node.js v20
- **Platform**: Azure Functions (Serverless)
- **Benefits**:
  - Pay-per-execution pricing model
  - Auto-scaling to zero when idle
  - Built-in monitoring and logging
  - Consumption plan for cost optimization
  - Seamless integration with other Azure services
  - Functions v4 runtime for latest features

### Database
- **Primary Database**: Azure SQL Database
- **Configuration**: Basic Tier (Upgradable)
- **Benefits**:
  - Managed service with automatic updates
  - Built-in high availability
  - Automatic backups
  - Easy scaling options
  - Familiar SQL syntax
  - Cost-effective basic tier for startups

### Storage
- **Service**: Azure Blob Storage
- **Tier**: Standard Locally Redundant Storage (LRS)
- **Use Cases**: 
  - Resume/CV storage
  - Company logos
  - Profile pictures
  - Document attachments
- **Benefits**:
  - Pay only for what you use
  - Automatic content distribution
  - Secure file access control
  - Integration with Azure CDN

### Search Engine
- **Service**: Azure Cognitive Search
- **Tier**: Free
- **Features**:
  - Full-text search
  - Faceted navigation
  - Filters and scoring profiles
  - AI-powered relevance
- **Benefits**:
  - Built-in language understanding
  - Semantic search capabilities
  - Scale as your content grows
  - No infrastructure management

### Monitoring & Analytics
- **Service**: Application Insights
- **Features**:
  - Real-time user monitoring
  - Performance tracking
  - Error detection
  - Usage analytics
- **Benefits**:
  - Built-in diagnostics
  - AI-powered insights
  - Integration with Azure dashboards
  - Custom alerts and metrics

### Authentication
- **Service**: Azure AD B2C (To be implemented)
- **Features**:
  - Social identity providers
  - Custom user flows
  - Multi-factor authentication
  - Custom branding
- **Benefits**:
  - Free tier up to 50K monthly active users
  - Enterprise-grade security
  - Customizable login experiences
  - GDPR compliance support

## Infrastructure Details

All resources are deployed in **West US 2** region for optimal performance and availability:
Resource Group: nexhire-dev-rg
├── Static Web App: nexhire-frontend-web (Free tier)
├── Function App: nexhire-api-func (Consumption Plan)
├── SQL Server: nexhire-sql-srv
│   └── Database: nexhire-sql-db (Basic tier)
├── Storage Accounts:
│   ├── nexhirefuncdevst (Function storage)
│   └── nexhireblobdev (File storage)
├── Cognitive Search: nexhire-search (Free tier)
└── Application Insights: nexhire-monitor
## Deployment Guide

### Prerequisites
- Azure CLI installed
- PowerShell with SqlServer module
- Azure subscription access

### Step 1: Deploy Azure Infrastructure
1. Open PowerShell as Administrator
2. Navigate to the project directory
3. Run the deployment script:.\deploy.ps1
### Step 2: Deploy Database Schema
After the Azure resources are created, deploy the database schema:

1. **Install SQL Server PowerShell Module** (if not already installed):Install-Module -Name SqlServer -Force -AllowClobber
2. **Execute Database Schema Deployment**:$connectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
Invoke-Sqlcmd -ConnectionString $connectionString -InputFile "deploy_database.sql"
3. **Verify Database Deployment**:# Test connection and list tables
Invoke-Sqlcmd -ConnectionString $connectionString -Query "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
### Step 3: Configure Firewall Rules
Add your IP address to SQL Server firewall:# Get your public IP
$myIP = (Invoke-WebRequest -Uri "https://api.ipify.org").Content

# Add firewall rule
az sql server firewall-rule create --resource-group "nexhire-dev-rg" --server "nexhire-sql-srv" --name "DeveloperAccess" --start-ip-address $myIP --end-ip-address $myIP
## Cost Optimization

- **Pay-as-you-go** model for most services
- **Free tiers** utilized where available
- **Auto-scaling** to handle varying loads
- **Consumption-based** pricing for Functions
- **Basic tiers** for initial setup with upgrade paths

## Scalability

- Automatic scaling for Static Web Apps
- Serverless Functions scale based on demand
- SQL Database can be scaled up/down as needed
- Storage accounts handle unlimited data growth
- Search service scales with content volume

## Database Schema

For detailed database schema documentation, see [database.md](database.md).

## Development Setup

Required tools:
- Azure CLI
- PowerShell with SqlServer module
- Node.js v20
- React development environment

## Next Steps
- [ ] Set up CI/CD pipelines
- [ ] Configure Azure AD B2C
- [ ] Implement monitoring alerts
- [ ] Set up backup policies
- [ ] Configure network security rules
- [ ] Deploy database schema using the provided scripts

## Security Notes

- **Important**: Change default SQL Server admin credentials in production
- Azure AD B2C needs manual setup through Azure Portal
- Storage account access keys should be rotated regularly
- Function app settings need secure configuration
- CORS policies should be properly configured
- Configure SQL Server firewall rules for your specific IP ranges

## Troubleshooting

### Database Connection Issues
1. Verify firewall rules allow your IP address
2. Check connection string parameters
3. Ensure SQL Server and database are running
4. Verify credentials are correct

### PowerShell SqlServer Module Issues# If module installation fails, try:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
