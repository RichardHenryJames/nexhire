-- =============================================================================
-- Migration 001: Pricing Overhaul — Tier-based referral pricing & milestones
-- Date: 2026-02-25
-- NOTE: IsFortune500 column is LEFT UNTOUCHED for backward compatibility.
--       New Tier column is added alongside it. IsFortune500 will be deprecated later.
-- =============================================================================

-- 1. Add Tier column to Organizations table (alongside existing IsFortune500)
-- Values: 'Standard' (default), 'Premium', 'Elite'
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Organizations') AND name = 'Tier')
BEGIN
    ALTER TABLE Organizations ADD Tier NVARCHAR(20) NOT NULL DEFAULT 'Standard';
    PRINT 'Added Tier column to Organizations';
END
GO

-- 2. ELITE tier — FAANG, top global tech, top finance, top consulting, top pharma/defense
-- These are the most sought-after companies where referrals have highest value
UPDATE Organizations SET Tier = 'Elite' WHERE Name IN (
    -- FAANG / Big Tech
    'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix',
    'NVIDIA', 'Tesla', 'Adobe', 'Salesforce', 'Oracle', 'Intel',
    'Qualcomm', 'AMD', 'Broadcom', 'IBM',
    -- Top Cloud/SaaS
    'Atlassian', 'Snowflake', 'Databricks', 'ServiceNow', 'Workday',
    'MongoDB', 'CrowdStrike', 'Palo Alto Networks', 'Fortinet',
    -- Top Fintech/Payments
    'Stripe', 'PayPal', 'Visa', 'Mastercard', 'American Express',
    'Block', 'Square', 'Intuit',
    -- Top Finance
    'Goldman Sachs', 'Morgan Stanley', 'JPMorgan Chase',
    'Bank of America', 'Citigroup', 'Wells Fargo', 'Capital One',
    'Berkshire Hathaway', 'Charles Schwab',
    -- Top Consulting (MBB + Big 4)
    'McKinsey', 'Boston Consulting Group', 'Bain',
    'Deloitte', 'PwC', 'EY', 'KPMG',
    -- Top Consumer / Iconic Brands
    'Procter & Gamble', 'Johnson & Johnson', 'Nike', 'Coca-Cola',
    'PepsiCo', 'Starbucks', 'Disney', 'McDonald''s',
    'Walmart', 'Costco', 'Home Depot', 'Target',
    -- Top Pharma / Healthcare
    'Pfizer', 'Merck', 'Eli Lilly', 'AbbVie', 'Amgen',
    'UnitedHealth Group', 'UnitedHealthcare', 'Optum',
    -- Top Aerospace / Defense
    'Boeing', 'Lockheed Martin', 'Raytheon Technologies', 'RTX', 'Northrop Grumman',
    -- Top Platforms / Social
    'Uber', 'Airbnb', 'LinkedIn', 'Twitter', 'Snap', 'Spotify', 'Shopify',
    -- Iconic brands with aliases in prod DB
    'The Coca-Cola Company',
    -- Top Indian Companies (brand name = elite)
    'Flipkart', 'Reliance Industries', 'Jio',
    'Tata Consultancy Services', 'Infosys',
    'HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Kotak Mahindra Bank',
    'Razorpay', 'PhonePe'
) AND IsActive = 1;
GO

-- 3. PREMIUM tier — Well-known companies, large Indian IT, funded startups, recognizable MNCs
-- Not auto-setting all IsFortune500=1 as Elite because many are obscure (utilities, regional retail)
UPDATE Organizations SET Tier = 'Premium' WHERE Name IN (
    -- Large Indian IT / Tech
    'Wipro', 'Wipro Limited', 'HCL Technologies', 'Tech Mahindra',
    'Cognizant', 'Capgemini', 'Accenture',
    'Infosys BPM', 'L&T', 'Freshworks', 'Zoho',
    -- Indian Unicorns / Well-known Startups
    'Swiggy', 'Zomato', 'Paytm', 'Myntra', 'Meesho',
    'Dream11', 'CRED', 'Zerodha', 'Groww',
    'BYJU''S', 'Ola', 'OYO', 'Nykaa', 'Lenskart',
    'CARS24', 'PolicyBazaar', 'ShareChat', 'Unacademy', 'upGrad',
    -- Indian Conglomerates
    'Tata Motors', 'Mahindra', 'Bajaj Finance',
    'Bharti Airtel', 'Axis Bank', 'ITC', 'Hindustan Unilever',
    'Asian Paints', 'Titan Company', 'Sun Pharmaceutical',
    -- Well-known Global Tech
    'Dell', 'HP', 'Cisco', 'VMware', 'Autodesk', 'Cadence', 'Synopsys',
    'Twilio', 'DocuSign', 'Okta', 'HubSpot', 'Zendesk',
    'Box', 'Dropbox', 'Slack', 'Zoom', 'Roblox', 'Unity',
    'Splunk', 'Seagate', 'Western Digital', 'Micron Technology',
    'Applied Materials', 'Texas Instruments', 'Motorola Solutions',
    'Rockwell Automation',
    -- Well-known Consumer / Retail
    'Best Buy', 'Lowe''s', 'Nordstrom', 'TJX Companies',
    'Marriott International', 'Hilton', 'Stryker', 'Boston Scientific',
    'Honeywell', '3M', 'Caterpillar', 'Deere', 'GE', 'GE Aerospace',
    'Danaher', 'Eaton', 'Cummins', 'Parker Hannifin',
    -- Well-known Finance / Insurance
    'MetLife', 'Prudential Financial', 'USAA', 'State Farm',
    'Progressive', 'Allstate', 'TIAA', 'Ameriprise Financial',
    'PNC Financial Services', 'PNC Financial Services Group', 'Truist', 'US Bancorp', 'U.S. Bank',
    'Discover Financial Services', 'Synchrony Financial',
    'Raymond James Financial', 'KKR',
    'Fannie Mae', 'Freddie Mac', 'New York Life Insurance',
    'Northwestern Mutual', 'Massachusetts Mutual Life Insurance', 'MassMutual',
    'Principal Financial', 'Principal Financial Group', 'Voya Financial',
    'Huntington Bancshares', 'Fifth Third Bancorp', 'KeyCorp', 'Comerica',
    'Regions Financial', 'Reinsurance Group of America',
    'WR Berkley', 'Markel', 'Travelers', 'Nationwide',
    'Erie Insurance Group', 'Mutual of Omaha', 'Thrivent Financial',
    'Lincoln National', 'Brighthouse Financial', 'Loews',
    -- Well-known Media / Entertainment
    'Sony', 'Electronic Arts', 'Activision Blizzard', 'Epic Games',
    'Riot Games', 'Take-Two Interactive', 'Warner Bros Discovery',
    'Paramount', 'Comcast', 'NBCUniversal', 'ViacomCBS',
    'Live Nation Entertainment',
    -- Well-known Food & Beverage
    'Kraft Heinz', 'General Mills', 'Mondelez International',
    'Colgate-Palmolive', 'Estee Lauder', 'Kimberly-Clark',
    'Domino''s Pizza', 'Chipotle', 'Chipotle Mexican Grill',
    -- Telecom / Logistics
    'AT&T', 'Verizon', 'T-Mobile', 'Comcast', 'Charter Communications',
    'FedEx', 'UPS', 'Delta Air Lines', 'United Airlines',
    'Southwest Airlines', 'American Airlines',
    -- Well-known Consulting / Professional Services
    'Booz Allen Hamilton', 'Leidos', 'CBRE Group', 'JLL',
    'Jones Lang LaSalle', 'ManpowerGroup',
    -- Cybersecurity
    'Cognex', 'CDW',
    -- Healthcare
    'CVS Health', 'Cigna', 'Cigna Group', 'Humana', 'Elevance Health',
    'McKesson', 'Cardinal Health', 'HCA Healthcare', 'Bristol Myers Squibb',
    'Gilead Sciences', 'Vertex Pharmaceuticals', 'Baxter International',
    'Becton Dickinson', 'Zimmer Biomet',
    -- Real Estate notable
    'Simon Property Group',
    -- Auto
    'Ford', 'Ford Motor', 'General Motors', 'Stellantis',
    -- Other notable
    'eBay', 'Etsy', 'Chewy', 'Wayfair',
    'Fortive', 'Sodexo',
    'Kroger', 'Albertsons', 'Publix Super Markets',
    'ExxonMobil', 'Chevron', 'ConocoPhillips', 'Marathon Petroleum',
    'Phillips 66', 'Valero Energy',
    'General Dynamics', 'L3Harris Technologies',
    'Spirit AeroSystems', 'Textron',
    'Sherwin-Williams', 'DuPont', 'Dow', 'PPG Industries',
    'Nucor', 'Freeport-McMoRan', 'Newmont',
    'Levi Strauss', 'Ralph Lauren', 'Under Armour',
    'NextEra Energy', 'Duke Energy', 'Southern Company',
    'Sempra Energy', 'Exelon', 'Dominion Energy',
    -- Prod DB aliases & additional well-known names
    'American Airlines Group', 'Burger King', 'KFC', 'Taco Bell',
    'Yum! Brands', 'Restaurant Brands International',
    'Labcorp', 'Laboratory Corporation of America',
    'Jacobs', 'Jacobs Engineering', 'Jacobs Engineering Group', 'Jacobs Solutions',
    'EMCOR Group', 'EMCOR Group Inc',
    'Genuine Parts', 'Genuine Parts Company',
    'Oshkosh', 'Oshkosh Corporation',
    'Williams-Sonoma', 'Williams-Sonoma, Inc.',
    'Henry Schein', 'Henry Schein One',
    'PG&E', 'PG&E Corporation',
    'Southern California Edison',
    'Hyatt Hotels', 'Wyndham Hotels & Resorts',
    'Crocs', 'Skechers',
    'Tyson Foods', 'Sysco', 'Campbell Soup', 'McCormick',
    'Conagra Brands', 'Hormel Foods', 'Mars', 'Land O''Lakes',
    'Molson Coors Beverage',
    'Waste Management', 'WM', 'Republic Services',
    'Norfolk Southern', 'CSX', 'J.B. Hunt Transport Services',
    'Illinois Tool Works', 'Emerson Electric', 'Dover',
    'Stanley Black & Decker', 'Whirlpool', 'Masco',
    'International Paper', 'Sealed Air', 'Packaging Corporation of America',
    'Ball Corporation', 'Crown Holdings', 'Graphic Packaging',
    'D.R. Horton', 'Lennar', 'PulteGroup', 'NVR', 'Toll Brothers',
    'Kinder Morgan', 'Williams Companies', 'ONEOK',
    'Enterprise Products Partners', 'Plains GP Holdings', 'Energy Transfer',
    'CDK Global', 'Avnet', 'Arrow Electronics',
    'Cintas', 'Iron Mountain', 'Rollins',
    'Wendy''s', 'Domino''s Pizza', 'Papa John''s',
    'LongHorn Steakhouse', 'Darden Restaurants', 'Popeyes',
    'Starbucks', 'Chipotle Mexican Grill',
    'CLEAR', 'SPECTRUM', 'MSD',
    'Jupiter', 'PMG', 'Progress',
    'Cencora', 'IQVIA', 'DaVita', 'Molina Healthcare',
    'Tenet Healthcare', 'Universal Health Services',
    'Orkin', 'ASGN', 'Graybar Electric', 'WESCO International',
    'W.W. Grainger', 'Walgreens', 'Dollar General', 'Dollar Tree',
    'Family Dollar', 'Ross Stores', 'Burlington Stores',
    'Kohl''s', 'Dick''s Sporting Goods', 'Five Below',
    'Tractor Supply', 'O''Reilly Automotive', 'AutoZone', 'AutoNation',
    'CarMax', 'Penske Automotive Group', 'Lithia Motors',
    'Group 1 Automotive', 'Murphy USA',
    'Weyerhaeuser', 'Martin Marietta Materials',
    'Eastman Chemical', 'Huntsman', 'Cabot',
    'Reliance Steel & Aluminum', 'Steel Dynamics',
    'Mohawk Industries', 'Owens Corning',
    'Occidental Petroleum', 'HF Sinclair', 'PBF Energy',
    'DTE Energy', 'Entergy', 'CMS Energy', 'CenterPoint Energy',
    'Alliant Energy', 'Ameren', 'FirstEnergy', 'Edison International',
    'PPL', 'WEC Energy Group', 'Xcel Energy', 'NRG Energy',
    'Public Service Enterprise Group', 'PSEG', 'Consolidated Edison',
    'Public Storage', 'Regency Centers', 'Host Hotels & Resorts',
    'American Tower', 'Wynn Resorts', 'Las Vegas Sands',
    'Caesars Entertainment', 'MGM Resorts International',
    'Hertz', 'Avis Budget Group',
    'StoneX Group', 'First American Financial',
    'American Financial Group', 'Western Union',
    'Mattel', 'Hasbro', 'Newell Brands',
    'Altria Group', 'Coty', 'Tapestry', 'VF Corporation',
    'Clorox', 'Ecolab', 'Colgate-Palmolive',
    'Avery Dennison', 'Middleby',
    'Tech Data', 'World Fuel Services',
    'Sanmina', 'Jabil', 'Flex',
    'Fluor', 'AECOM', 'Quanta Services',
    'Builders FirstSource',
    'Sprint', 'Interpublic Group',
    'Loews', 'Mars', 'Tenneco', 'Dana', 'Lear', 'LKQ',
    'CH Robinson', 'Performance Food Group', 'United Natural Foods',
    'Paccar', 'Deere',
    'Fortinet', 'UGI',
    'New York Life Insurance', 'Northwestern Mutual',
    'Liberty Mutual', 'Nationwide',
    'Brighthouse Financial', 'Lincoln National',
    'SPECTRUM', 'Office Depot', 'Staples'
) AND IsActive = 1 AND Tier != 'Elite'; -- Don't downgrade Elite companies
GO

-- 4. Everything else stays 'Standard' (default)
-- Remaining IsFortune500=1 companies that are Standard tier include:
-- Defunct/troubled: Bed Bath & Beyond, Rite Aid, GameStop, Big Lots, Office Depot
-- Obscure/niche: Ingredion, Cabot, Middleby, Mosaic, Avery Dennison, Rollins, etc.
-- User-created companies without IsFortune500 flag also remain Standard
-- IsFortune500 column is NOT touched — all existing code/queries/indexes work as-is

-- 4a. Verification: Show tier distribution
-- (Uncomment to run manually after migration)
-- SELECT Tier, COUNT(*) as Count FROM Organizations WHERE IsActive = 1 GROUP BY Tier ORDER BY Count DESC;

-- 5. Add new pricing settings for tier-based referral costs
INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt) 
SELECT N'PREMIUM_REFERRAL_COST', 99, N'Cost in INR for referral at Premium-tier company', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'PREMIUM_REFERRAL_COST');
GO

INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'ELITE_REFERRAL_COST', 199, N'Cost in INR for referral at Elite-tier company (FAANG etc)', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'ELITE_REFERRAL_COST');
GO

-- 6. Add referrer payout settings (fixed, transparent — replaces random ₹20-40)
INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'STANDARD_REFERRER_PAYOUT', 25, N'Referrer payout in INR for verified Standard-tier referral', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'STANDARD_REFERRER_PAYOUT');
GO

INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'PREMIUM_REFERRER_PAYOUT', 50, N'Referrer payout in INR for verified Premium-tier referral', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'PREMIUM_REFERRER_PAYOUT');
GO

INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'ELITE_REFERRER_PAYOUT', 100, N'Referrer payout in INR for verified Elite-tier referral (FAANG)', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'ELITE_REFERRER_PAYOUT');
GO

-- 7. Milestone bonus settings (monthly)
INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'MILESTONE_5_BONUS', 100, N'Bonus in INR for 5th verified referral in a calendar month', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'MILESTONE_5_BONUS');
GO

INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'MILESTONE_10_BONUS', 250, N'Bonus in INR for 10th verified referral in a calendar month', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'MILESTONE_10_BONUS');
GO

INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'MILESTONE_20_BONUS', 500, N'Bonus in INR for 20th verified referral in a calendar month', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'MILESTONE_20_BONUS');
GO

-- 8. Minimum withdrawal amount
INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'MINIMUM_WITHDRAWAL', 200, N'Minimum amount in INR required to withdraw earnings', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'MINIMUM_WITHDRAWAL');
GO

-- 9. AI Resume Analysis cost
INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'AI_RESUME_ANALYSIS_COST', 29, N'Cost in INR per AI resume analysis (after 2 free uses)', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'AI_RESUME_ANALYSIS_COST');
GO

INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive, CreatedAt, UpdatedAt)
SELECT N'AI_RESUME_FREE_USES', 2, N'Number of free AI resume analyses per user', 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'AI_RESUME_FREE_USES');
GO

-- 10. Index for tier-based lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_Tier')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_Tier ON Organizations(Tier, OrganizationID, IsActive);
    PRINT 'Created index IX_Organizations_Tier';
END
GO

PRINT '✅ Migration 001 complete — Pricing overhaul applied';
GO
