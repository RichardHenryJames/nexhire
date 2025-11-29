/**
 * Fortune 500 Companies List
 * Source: Fortune 500 2024 + Global Tech Giants
 * Used as canonical names for company normalization
 */

export interface Fortune500Company {
  canonicalName: string;      // The "correct" name to use
  alternateNames: string[];   // Common variations/misspellings
  industry: string;           // Industry classification
  rank?: number;              // Fortune 500 rank (if applicable)
}

export const FORTUNE_500_COMPANIES: Fortune500Company[] = [
  // Tech Giants (Top 10)
  {
    canonicalName: 'Apple',
    alternateNames: ['Apple Inc', 'Apple Computer', 'Apple Inc.'],
    industry: 'Technology',
    rank: 3
  },
  {
    canonicalName: 'Microsoft',
    alternateNames: ['Microsoft Corp', 'Microsoft Corporation', 'MSFT', 'Microsft'],
    industry: 'Technology',
    rank: 14
  },
  {
    canonicalName: 'Amazon',
    alternateNames: [
      'Amazon.com', 'Amazon Inc', 'Amazon.com Inc',
      'Amazon Web Services', 'AWS',
      'Amazon Dev Center', 'Amazon Development Center',
      'Amazon Data Services', 'Amazon Retail',
      'Amazon Stores', 'Amazon Advertising', 'Amazon Kindle',
      'Amazon Kuiper', 'Amazon LEO', 'Amazon Neptune'
    ],
    industry: 'E-commerce & Technology',
    rank: 2
  },
  {
    canonicalName: 'Google',
    alternateNames: [
      'Alphabet', 'Alphabet Inc', 'Google LLC', 'Google Inc',
      'YouTube', 'Waymo', 'DeepMind', 'Verily'
    ],
    industry: 'Technology',
    rank: 8
  },
  {
    canonicalName: 'Meta',
    alternateNames: [
      'Meta Platforms', 'Facebook', 'Facebook Inc',
      'Instagram', 'WhatsApp', 'Oculus', 'Reality Labs'
    ],
    industry: 'Technology',
    rank: 31
  },
  {
    canonicalName: 'Tesla',
    alternateNames: ['Tesla Inc', 'Tesla Motors', 'Tesla Energy'],
    industry: 'Automotive & Energy',
    rank: 47
  },
  {
    canonicalName: 'NVIDIA',
    alternateNames: ['Nvidia Corp', 'Nvidia Corporation', 'NVDA', 'NVIDIA USA', '2100 NVIDIA', '2100 NVIDIA USA', 'Nvidia Graphics'],
    industry: 'Technology',
    rank: 134
  },
  {
    canonicalName: 'IBM',
    alternateNames: [
      'International Business Machines', 'IBM Corp',
      'IBM Corporation', 'Red Hat'
    ],
    industry: 'Technology',
    rank: 71
  },
  {
    canonicalName: 'Intel',
    alternateNames: ['Intel Corp', 'Intel Corporation', 'INTC'],
    industry: 'Technology',
    rank: 58
  },
  {
    canonicalName: 'Oracle',
    alternateNames: ['Oracle Corp', 'Oracle Corporation', 'ORCL'],
    industry: 'Technology',
    rank: 91
  },

  // Financial Services
  {
    canonicalName: 'JPMorgan Chase',
    alternateNames: ['JP Morgan', 'JPM', 'Chase Bank', 'Chase'],
    industry: 'Financial Services',
    rank: 15
  },
  {
    canonicalName: 'Bank of America',
    alternateNames: ['BofA', 'BoA', 'Bank of America Corp', 'BAC'],
    industry: 'Financial Services',
    rank: 29
  },
  {
    canonicalName: 'Wells Fargo',
    alternateNames: ['Wells Fargo & Company', 'WFC'],
    industry: 'Financial Services',
    rank: 35
  },
  {
    canonicalName: 'Goldman Sachs',
    alternateNames: ['Goldman Sachs Group', 'GS'],
    industry: 'Financial Services',
    rank: 55
  },
  {
    canonicalName: 'Morgan Stanley',
    alternateNames: ['Morgan Stanley & Co', 'MS'],
    industry: 'Financial Services',
    rank: 61
  },
  {
    canonicalName: 'Citigroup',
    alternateNames: ['Citi', 'Citibank', 'Citicorp'],
    industry: 'Financial Services',
    rank: 36
  },

  // Retail & E-commerce
  {
    canonicalName: 'Walmart',
    alternateNames: ['Wal-Mart', 'Walmart Inc', 'Walmart Stores'],
    industry: 'Retail',
    rank: 1
  },
  {
    canonicalName: 'Costco',
    alternateNames: ['Costco Wholesale', 'Costco Wholesale Corp'],
    industry: 'Retail',
    rank: 11
  },
  {
    canonicalName: 'Target',
    alternateNames: ['Target Corp', 'Target Corporation'],
    industry: 'Retail',
    rank: 32
  },
  {
    canonicalName: 'Home Depot',
    alternateNames: ['The Home Depot', 'Home Depot Inc'],
    industry: 'Retail',
    rank: 18
  },

  // Healthcare & Pharma
  {
    canonicalName: 'UnitedHealth Group',
    alternateNames: ['UnitedHealthcare', 'United Health', 'Optum'],
    industry: 'Healthcare',
    rank: 5
  },
  {
    canonicalName: 'CVS Health',
    alternateNames: ['CVS', 'CVS Pharmacy', 'Aetna'],
    industry: 'Healthcare',
    rank: 4
  },
  {
    canonicalName: 'Pfizer',
    alternateNames: ['Pfizer Inc'],
    industry: 'Pharmaceuticals',
    rank: 66
  },
  {
    canonicalName: 'Johnson & Johnson',
    alternateNames: ['J&J', 'JNJ'],
    industry: 'Healthcare',
    rank: 37
  },

  // Automotive
  {
    canonicalName: 'Ford',
    alternateNames: ['Ford Motor', 'Ford Motor Company'],
    industry: 'Automotive',
    rank: 21
  },
  {
    canonicalName: 'General Motors',
    alternateNames: ['GM', 'General Motors Company'],
    industry: 'Automotive',
    rank: 25
  },

  // Aerospace & Defense
  {
    canonicalName: 'Boeing',
    alternateNames: ['The Boeing Company', 'Boeing Co'],
    industry: 'Aerospace',
    rank: 52
  },
  {
    canonicalName: 'Lockheed Martin',
    alternateNames: ['Lockheed Martin Corp'],
    industry: 'Aerospace & Defense',
    rank: 56
  },

  // Telecommunications
  {
    canonicalName: 'AT&T',
    alternateNames: ['AT&T Inc', 'American Telephone & Telegraph'],
    industry: 'Telecommunications',
    rank: 13
  },
  {
    canonicalName: 'Verizon',
    alternateNames: ['Verizon Communications', 'Verizon Wireless'],
    industry: 'Telecommunications',
    rank: 20
  },
  {
    canonicalName: 'T-Mobile',
    alternateNames: ['T-Mobile US', 'T-Mobile USA'],
    industry: 'Telecommunications',
    rank: 41
  },

  // Energy
  {
    canonicalName: 'ExxonMobil',
    alternateNames: ['Exxon Mobil', 'Exxon', 'Mobil'],
    industry: 'Energy',
    rank: 7
  },
  {
    canonicalName: 'Chevron',
    alternateNames: ['Chevron Corp', 'Chevron Corporation'],
    industry: 'Energy',
    rank: 10
  },

  // Consumer Goods
  {
    canonicalName: 'Procter & Gamble',
    alternateNames: ['P&G', 'Procter and Gamble'],
    industry: 'Consumer Goods',
    rank: 43
  },
  {
    canonicalName: 'PepsiCo',
    alternateNames: ['Pepsi', 'PepsiCo Inc'],
    industry: 'Food & Beverage',
    rank: 44
  },
  {
    canonicalName: 'Coca-Cola',
    alternateNames: ['The Coca-Cola Company', 'Coke'],
    industry: 'Food & Beverage',
    rank: 89
  },

  // Additional Tech Companies
  {
    canonicalName: 'Adobe',
    alternateNames: ['Adobe Inc', 'Adobe Systems'],
    industry: 'Technology',
    rank: 230
  },
  {
    canonicalName: 'Salesforce',
    alternateNames: ['Salesforce.com', 'Salesforce Inc'],
    industry: 'Technology',
    rank: 136
  },
  {
    canonicalName: 'Netflix',
    alternateNames: ['Netflix Inc'],
    industry: 'Technology',
    rank: 115
  },
  {
    canonicalName: 'PayPal',
    alternateNames: ['PayPal Holdings'],
    industry: 'Technology',
    rank: 201
  },
  {
    canonicalName: 'Uber',
    alternateNames: ['Uber Technologies'],
    industry: 'Technology',
    rank: 143
  },
  {
    canonicalName: 'Airbnb',
    alternateNames: ['Airbnb Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Spotify',
    alternateNames: ['Spotify Technology'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Snap',
    alternateNames: ['Snap Inc', 'Snapchat'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Twitter',
    alternateNames: ['Twitter Inc', 'X Corp', 'X'],
    industry: 'Technology'
  },
  {
    canonicalName: 'LinkedIn',
    alternateNames: ['LinkedIn Corp', 'LinkedIn Corporation'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Dell',
    alternateNames: ['Dell Technologies', 'Dell Inc', 'Dell Computer'],
    industry: 'Technology',
    rank: 28
  },
  {
    canonicalName: 'HP',
    alternateNames: ['Hewlett Packard', 'HP Inc', 'Hewlett-Packard'],
    industry: 'Technology',
    rank: 59
  },
  {
    canonicalName: 'Cisco',
    alternateNames: ['Cisco Systems', 'Cisco Systems Inc'],
    industry: 'Technology',
    rank: 74
  },
  {
    canonicalName: 'VMware',
    alternateNames: ['VMware Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'ServiceNow',
    alternateNames: ['ServiceNow Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Workday',
    alternateNames: ['Workday Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Zoom',
    alternateNames: ['Zoom Video Communications', 'Zoom Communications'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Slack',
    alternateNames: ['Slack Technologies'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Atlassian',
    alternateNames: ['Atlassian Corporation'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Square',
    alternateNames: ['Block Inc', 'Block', 'Cash App'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Stripe',
    alternateNames: ['Stripe Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Shopify',
    alternateNames: ['Shopify Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Intuit',
    alternateNames: ['Intuit Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Autodesk',
    alternateNames: ['Autodesk Inc'],
    industry: 'Technology'
  },

  // Indian Tech Companies (Major Players)
  {
    canonicalName: 'Tata Consultancy Services',
    alternateNames: ['TCS', 'Tata Consulting', 'TCS Ltd'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Infosys',
    alternateNames: ['Infosys Technologies', 'Infosys Ltd'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Wipro',
    alternateNames: ['Wipro Technologies', 'Wipro Ltd'],
    industry: 'Technology'
  },
  {
    canonicalName: 'HCL Technologies',
    alternateNames: ['HCL', 'HCL Tech'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Tech Mahindra',
    alternateNames: ['Tech Mahindra Ltd'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Cognizant',
    alternateNames: ['Cognizant Technology Solutions'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Accenture',
    alternateNames: ['Accenture plc', 'Accenture Ltd'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Capgemini',
    alternateNames: ['Capgemini SE'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Deloitte',
    alternateNames: ['Deloitte Consulting', 'Deloitte Touche Tohmatsu'],
    industry: 'Technology'
  },

  // More Fortune 500 - Healthcare
  {
    canonicalName: 'McKesson',
    alternateNames: ['McKesson Corp', 'McKesson Corporation'],
    industry: 'Healthcare',
    rank: 6
  },
  {
    canonicalName: 'AmerisourceBergen',
    alternateNames: ['AmerisourceBergen Corp', 'Cencora'],
    industry: 'Healthcare',
    rank: 9
  },
  {
    canonicalName: 'Cardinal Health',
    alternateNames: ['Cardinal Health Inc'],
    industry: 'Healthcare',
    rank: 12
  },
  {
    canonicalName: 'Cigna',
    alternateNames: ['Cigna Group', 'Cigna Health'],
    industry: 'Healthcare',
    rank: 16
  },
  {
    canonicalName: 'Elevance Health',
    alternateNames: ['Anthem', 'Anthem Inc', 'Elevance'],
    industry: 'Healthcare',
    rank: 22
  },
  {
    canonicalName: 'Centene',
    alternateNames: ['Centene Corp', 'Centene Corporation'],
    industry: 'Healthcare',
    rank: 24
  },
  {
    canonicalName: 'Humana',
    alternateNames: ['Humana Inc'],
    industry: 'Healthcare',
    rank: 42
  },

  // More Retail
  {
    canonicalName: 'Kroger',
    alternateNames: ['The Kroger Co', 'Kroger Company'],
    industry: 'Retail',
    rank: 23
  },
  {
    canonicalName: 'Walgreens',
    alternateNames: ['Walgreens Boots Alliance', 'WBA'],
    industry: 'Retail',
    rank: 17
  },
  {
    canonicalName: "Lowe's",
    alternateNames: ["Lowe's Companies", "Lowes"],
    industry: 'Retail',
    rank: 38
  },
  {
    canonicalName: 'Best Buy',
    alternateNames: ['Best Buy Co'],
    industry: 'Retail',
    rank: 72
  },

  // Financial Services (More)
  {
    canonicalName: 'American Express',
    alternateNames: ['AmEx', 'Amex', 'American Express Company'],
    industry: 'Financial Services',
    rank: 68
  },
  {
    canonicalName: 'US Bancorp',
    alternateNames: ['U.S. Bancorp', 'US Bank', 'U.S. Bank'],
    industry: 'Financial Services',
    rank: 130
  },
  {
    canonicalName: 'PNC Financial Services',
    alternateNames: ['PNC', 'PNC Bank'],
    industry: 'Financial Services',
    rank: 145
  },
  {
    canonicalName: 'Capital One',
    alternateNames: ['Capital One Financial'],
    industry: 'Financial Services',
    rank: 106
  },
  {
    canonicalName: 'Truist',
    alternateNames: ['Truist Financial', 'BB&T', 'SunTrust'],
    industry: 'Financial Services',
    rank: 151
  },
  {
    canonicalName: 'Charles Schwab',
    alternateNames: ['The Charles Schwab Corporation', 'Schwab'],
    industry: 'Financial Services',
    rank: 156
  },

  // Insurance
  {
    canonicalName: 'State Farm',
    alternateNames: ['State Farm Insurance', 'State Farm Mutual'],
    industry: 'Insurance',
    rank: 33
  },
  {
    canonicalName: 'Berkshire Hathaway',
    alternateNames: ['Berkshire', 'BRK'],
    industry: 'Insurance',
    rank: 11
  },
  {
    canonicalName: 'Progressive',
    alternateNames: ['Progressive Insurance', 'Progressive Corp'],
    industry: 'Insurance',
    rank: 94
  },
  {
    canonicalName: 'Allstate',
    alternateNames: ['The Allstate Corporation', 'Allstate Insurance'],
    industry: 'Insurance',
    rank: 79
  },
  {
    canonicalName: 'MetLife',
    alternateNames: ['Metropolitan Life Insurance'],
    industry: 'Insurance',
    rank: 43
  },
  {
    canonicalName: 'Prudential Financial',
    alternateNames: ['Prudential', 'Prudential Insurance'],
    industry: 'Insurance',
    rank: 50
  },
  {
    canonicalName: 'Liberty Mutual',
    alternateNames: ['Liberty Mutual Insurance', 'Liberty Mutual Group'],
    industry: 'Insurance',
    rank: 71
  },
  {
    canonicalName: 'USAA',
    alternateNames: ['United Services Automobile Association'],
    industry: 'Insurance',
    rank: 97
  },
  {
    canonicalName: 'Travelers',
    alternateNames: ['The Travelers Companies', 'Travelers Insurance'],
    industry: 'Insurance',
    rank: 106
  },

  // Automotive (More)
  {
    canonicalName: 'Stellantis',
    alternateNames: ['FCA', 'Fiat Chrysler', 'Chrysler'],
    industry: 'Automotive',
    rank: 53
  },

  // Energy (More)
  {
    canonicalName: 'Phillips 66',
    alternateNames: ['Phillips66'],
    industry: 'Energy',
    rank: 19
  },
  {
    canonicalName: 'Valero Energy',
    alternateNames: ['Valero'],
    industry: 'Energy',
    rank: 27
  },
  {
    canonicalName: 'Marathon Petroleum',
    alternateNames: ['Marathon'],
    industry: 'Energy',
    rank: 26
  },
  {
    canonicalName: 'ConocoPhillips',
    alternateNames: ['Conoco Phillips'],
    industry: 'Energy',
    rank: 48
  },

  // Aerospace & Defense (More)
  {
    canonicalName: 'Raytheon Technologies',
    alternateNames: ['RTX', 'Raytheon', 'RTX Corporation'],
    industry: 'Aerospace & Defense',
    rank: 51
  },
  {
    canonicalName: 'Northrop Grumman',
    alternateNames: ['Northrop Grumman Corp'],
    industry: 'Aerospace & Defense',
    rank: 101
  },
  {
    canonicalName: 'General Dynamics',
    alternateNames: ['General Dynamics Corp'],
    industry: 'Aerospace & Defense',
    rank: 88
  },

  // Food & Beverage (More)
  {
    canonicalName: 'Albertsons',
    alternateNames: ['Albertsons Companies', 'Safeway'],
    industry: 'Retail',
    rank: 46
  },
  {
    canonicalName: 'Sysco',
    alternateNames: ['Sysco Corp', 'Sysco Corporation'],
    industry: 'Food & Beverage',
    rank: 57
  },
  {
    canonicalName: 'Tyson Foods',
    alternateNames: ['Tyson'],
    industry: 'Food & Beverage',
    rank: 83
  },
  {
    canonicalName: 'Archer Daniels Midland',
    alternateNames: ['ADM', 'Archer Daniels'],
    industry: 'Food & Beverage',
    rank: 64
  },
  {
    canonicalName: 'Mondelez International',
    alternateNames: ['Mondelez', 'Kraft Foods'],
    industry: 'Food & Beverage',
    rank: 108
  },
  {
    canonicalName: 'General Mills',
    alternateNames: ['General Mills Inc'],
    industry: 'Food & Beverage',
    rank: 182
  },
  {
    canonicalName: 'Kraft Heinz',
    alternateNames: ['Kraft', 'Heinz', 'The Kraft Heinz Company'],
    industry: 'Food & Beverage',
    rank: 76
  },
  {
    canonicalName: 'Mars',
    alternateNames: ['Mars Inc', 'Mars Incorporated'],
    industry: 'Food & Beverage'
  },
  {
    canonicalName: 'Starbucks',
    alternateNames: ['Starbucks Corp', 'Starbucks Corporation'],
    industry: 'Food & Beverage',
    rank: 120
  },

  // Pharmaceuticals (More)
  {
    canonicalName: 'AbbVie',
    alternateNames: ['AbbVie Inc'],
    industry: 'Pharmaceuticals',
    rank: 73
  },
  {
    canonicalName: 'Bristol Myers Squibb',
    alternateNames: ['BMS', 'Bristol-Myers Squibb'],
    industry: 'Pharmaceuticals',
    rank: 75
  },
  {
    canonicalName: 'Merck',
    alternateNames: ['Merck & Co', 'MSD'],
    industry: 'Pharmaceuticals',
    rank: 69
  },
  {
    canonicalName: 'Eli Lilly',
    alternateNames: ['Lilly', 'Eli Lilly and Company'],
    industry: 'Pharmaceuticals',
    rank: 127
  },
  {
    canonicalName: 'Amgen',
    alternateNames: ['Amgen Inc'],
    industry: 'Pharmaceuticals',
    rank: 109
  },
  {
    canonicalName: 'Gilead Sciences',
    alternateNames: ['Gilead'],
    industry: 'Pharmaceuticals',
    rank: 137
  },

  // Manufacturing & Industrial
  {
    canonicalName: 'Caterpillar',
    alternateNames: ['CAT', 'Caterpillar Inc'],
    industry: 'Manufacturing',
    rank: 65
  },
  {
    canonicalName: '3M',
    alternateNames: ['3M Company', 'Minnesota Mining'],
    industry: 'Manufacturing',
    rank: 96
  },
  {
    canonicalName: 'Honeywell',
    alternateNames: ['Honeywell International'],
    industry: 'Manufacturing',
    rank: 77
  },
  {
    canonicalName: 'Deere',
    alternateNames: ['John Deere', 'Deere & Company'],
    industry: 'Manufacturing',
    rank: 84
  },
  {
    canonicalName: 'GE',
    alternateNames: ['General Electric', 'GE Aerospace'],
    industry: 'Manufacturing',
    rank: 49
  },
  {
    canonicalName: 'Dow',
    alternateNames: ['Dow Chemical', 'Dow Inc'],
    industry: 'Manufacturing',
    rank: 110
  },
  {
    canonicalName: 'DuPont',
    alternateNames: ['DuPont de Nemours', 'E.I. du Pont'],
    industry: 'Manufacturing',
    rank: 148
  },

  // Telecommunications (More)
  {
    canonicalName: 'Comcast',
    alternateNames: ['Comcast Corp', 'Xfinity', 'NBCUniversal'],
    industry: 'Telecommunications',
    rank: 30
  },
  {
    canonicalName: 'Charter Communications',
    alternateNames: ['Charter', 'Spectrum'],
    industry: 'Telecommunications',
    rank: 63
  },
  {
    canonicalName: 'Sprint',
    alternateNames: ['Sprint Corporation', 'Sprint Nextel'],
    industry: 'Telecommunications'
  },

  // Media & Entertainment
  {
    canonicalName: 'Disney',
    alternateNames: ['Walt Disney', 'The Walt Disney Company', 'Walt Disney Co'],
    industry: 'Entertainment',
    rank: 54
  },
  {
    canonicalName: 'Warner Bros Discovery',
    alternateNames: ['Warner Bros', 'Discovery', 'WarnerMedia', 'Time Warner'],
    industry: 'Entertainment',
    rank: 62
  },
  {
    canonicalName: 'Paramount',
    alternateNames: ['Paramount Global', 'ViacomCBS', 'CBS'],
    industry: 'Entertainment',
    rank: 155
  },
  {
    canonicalName: 'Sony',
    alternateNames: ['Sony Corporation', 'Sony Group'],
    industry: 'Entertainment'
  },

  // Logistics & Transportation
  {
    canonicalName: 'UPS',
    alternateNames: ['United Parcel Service', 'UPS Inc'],
    industry: 'Logistics',
    rank: 34
  },
  {
    canonicalName: 'FedEx',
    alternateNames: ['Federal Express', 'FedEx Corp'],
    industry: 'Logistics',
    rank: 39
  },
  {
    canonicalName: 'Delta Air Lines',
    alternateNames: ['Delta', 'Delta Airlines'],
    industry: 'Transportation',
    rank: 78
  },
  {
    canonicalName: 'American Airlines',
    alternateNames: ['American Airlines Group', 'AA'],
    industry: 'Transportation',
    rank: 80
  },
  {
    canonicalName: 'United Airlines',
    alternateNames: ['United Airlines Holdings', 'United'],
    industry: 'Transportation',
    rank: 121
  },
  {
    canonicalName: 'Southwest Airlines',
    alternateNames: ['Southwest'],
    industry: 'Transportation',
    rank: 138
  },

  // More Tech Companies
  {
    canonicalName: 'Qualcomm',
    alternateNames: ['Qualcomm Inc'],
    industry: 'Technology',
    rank: 158
  },
  {
    canonicalName: 'Broadcom',
    alternateNames: ['Broadcom Inc', 'Avago'],
    industry: 'Technology',
    rank: 119
  },
  {
    canonicalName: 'Texas Instruments',
    alternateNames: ['TI', 'Texas Instruments Inc'],
    industry: 'Technology',
    rank: 184
  },
  {
    canonicalName: 'Applied Materials',
    alternateNames: ['Applied Materials Inc', 'AMAT'],
    industry: 'Technology',
    rank: 325
  },
  {
    canonicalName: 'AMD',
    alternateNames: ['Advanced Micro Devices', 'AMD Inc'],
    industry: 'Technology',
    rank: 452
  },
  {
    canonicalName: 'Micron Technology',
    alternateNames: ['Micron'],
    industry: 'Technology',
    rank: 134
  },
  {
    canonicalName: 'Western Digital',
    alternateNames: ['WDC', 'Western Digital Corp'],
    industry: 'Technology',
    rank: 168
  },
  {
    canonicalName: 'Seagate',
    alternateNames: ['Seagate Technology'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Synopsys',
    alternateNames: ['Synopsys Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Cadence',
    alternateNames: ['Cadence Design Systems'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Palo Alto Networks',
    alternateNames: ['Palo Alto', 'PANW'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Fortinet',
    alternateNames: ['Fortinet Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'CrowdStrike',
    alternateNames: ['CrowdStrike Holdings'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Snowflake',
    alternateNames: ['Snowflake Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Databricks',
    alternateNames: ['Databricks Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'MongoDB',
    alternateNames: ['MongoDB Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Splunk',
    alternateNames: ['Splunk Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Twilio',
    alternateNames: ['Twilio Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Okta',
    alternateNames: ['Okta Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'DocuSign',
    alternateNames: ['DocuSign Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'HubSpot',
    alternateNames: ['HubSpot Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Zendesk',
    alternateNames: ['Zendesk Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Box',
    alternateNames: ['Box Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Dropbox',
    alternateNames: ['Dropbox Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Roblox',
    alternateNames: ['Roblox Corp', 'Roblox Corporation'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Unity',
    alternateNames: ['Unity Technologies', 'Unity Software'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Epic Games',
    alternateNames: ['Epic'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Riot Games',
    alternateNames: ['Riot'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Electronic Arts',
    alternateNames: ['EA', 'EA Games'],
    industry: 'Technology',
    rank: 389
  },
  {
    canonicalName: 'Activision Blizzard',
    alternateNames: ['Activision', 'Blizzard', 'Activision Blizzard Inc'],
    industry: 'Technology'
  },
  {
    canonicalName: 'Take-Two Interactive',
    alternateNames: ['Take-Two', 'Rockstar Games'],
    industry: 'Technology'
  },

  // Consulting & Professional Services
  {
    canonicalName: 'McKinsey',
    alternateNames: ['McKinsey & Company', 'McKinsey and Company'],
    industry: 'Consulting'
  },
  {
    canonicalName: 'Boston Consulting Group',
    alternateNames: ['BCG'],
    industry: 'Consulting'
  },
  {
    canonicalName: 'Bain',
    alternateNames: ['Bain & Company', 'Bain and Company'],
    industry: 'Consulting'
  },
  {
    canonicalName: 'PwC',
    alternateNames: ['PricewaterhouseCoopers', 'PricewaterhouseCoopers LLP'],
    industry: 'Consulting'
  },
  {
    canonicalName: 'EY',
    alternateNames: ['Ernst & Young', 'Ernst and Young', 'EY Global'],
    industry: 'Consulting'
  },
  {
    canonicalName: 'KPMG',
    alternateNames: ['KPMG LLP'],
    industry: 'Consulting'
  },

  // E-commerce & Marketplaces
  {
    canonicalName: 'eBay',
    alternateNames: ['eBay Inc'],
    industry: 'E-commerce',
    rank: 337
  },
  {
    canonicalName: 'Etsy',
    alternateNames: ['Etsy Inc'],
    industry: 'E-commerce'
  },
  {
    canonicalName: 'Wayfair',
    alternateNames: ['Wayfair Inc'],
    industry: 'E-commerce'
  },
  {
    canonicalName: 'Chewy',
    alternateNames: ['Chewy Inc'],
    industry: 'E-commerce'
  },

  // More Indian Companies
  {
    canonicalName: 'Tata Motors',
    alternateNames: ['Tata', 'Tata Motors Ltd'],
    industry: 'Automotive'
  },
  {
    canonicalName: 'Reliance Industries',
    alternateNames: ['Reliance', 'RIL'],
    industry: 'Conglomerate'
  },
  {
    canonicalName: 'ICICI Bank',
    alternateNames: ['ICICI'],
    industry: 'Financial Services'
  },
  {
    canonicalName: 'HDFC Bank',
    alternateNames: ['HDFC'],
    industry: 'Financial Services'
  },
  {
    canonicalName: 'State Bank of India',
    alternateNames: ['SBI'],
    industry: 'Financial Services'
  },
  {
    canonicalName: 'Bharti Airtel',
    alternateNames: ['Airtel'],
    industry: 'Telecommunications'
  },
  {
    canonicalName: 'Mahindra',
    alternateNames: ['Mahindra & Mahindra', 'M&M'],
    industry: 'Automotive'
  },

  // Fortune 500: 100-200
  {
    canonicalName: 'MetLife',
    alternateNames: ['Metropolitan Life Insurance', 'MetLife Inc'],
    industry: 'Insurance',
    rank: 43
  },
  {
    canonicalName: 'Fannie Mae',
    alternateNames: ['Federal National Mortgage Association'],
    industry: 'Financial Services',
    rank: 21
  },
  {
    canonicalName: 'Freddie Mac',
    alternateNames: ['Federal Home Loan Mortgage Corp'],
    industry: 'Financial Services',
    rank: 37
  },
  {
    canonicalName: 'Energy Transfer',
    alternateNames: ['Energy Transfer LP'],
    industry: 'Energy',
    rank: 81
  },
  {
    canonicalName: 'World Fuel Services',
    alternateNames: ['World Fuel', 'WFS'],
    industry: 'Energy',
    rank: 92
  },
  {
    canonicalName: 'Plains GP Holdings',
    alternateNames: ['Plains All American Pipeline'],
    industry: 'Energy',
    rank: 98
  },
  {
    canonicalName: 'Enterprise Products Partners',
    alternateNames: ['Enterprise Products'],
    industry: 'Energy',
    rank: 60
  },
  {
    canonicalName: 'Publix Super Markets',
    alternateNames: ['Publix'],
    industry: 'Retail',
    rank: 85
  },
  {
    canonicalName: 'Nationwide',
    alternateNames: ['Nationwide Mutual Insurance'],
    industry: 'Insurance',
    rank: 86
  },
  {
    canonicalName: 'StoneX Group',
    alternateNames: ['INTL FCStone', 'StoneX'],
    industry: 'Financial Services',
    rank: 87
  },
  {
    canonicalName: 'HCA Healthcare',
    alternateNames: ['HCA', 'Hospital Corporation of America'],
    industry: 'Healthcare',
    rank: 70
  },
  {
    canonicalName: 'Archer Daniels Midland',
    alternateNames: ['ADM'],
    industry: 'Food & Beverage',
    rank: 64
  },
  {
    canonicalName: 'PBF Energy',
    alternateNames: ['PBF'],
    industry: 'Energy',
    rank: 100
  },
  {
    canonicalName: 'Centene',
    alternateNames: ['Centene Corporation'],
    industry: 'Healthcare',
    rank: 24
  },
  {
    canonicalName: 'Energy Transfer',
    alternateNames: ['ET'],
    industry: 'Energy',
    rank: 81
  },
  {
    canonicalName: 'New York Life Insurance',
    alternateNames: ['New York Life'],
    industry: 'Insurance',
    rank: 67
  },
  {
    canonicalName: 'Northwestern Mutual',
    alternateNames: ['Northwestern Mutual Life Insurance'],
    industry: 'Insurance',
    rank: 111
  },
  {
    canonicalName: 'CHS',
    alternateNames: ['CHS Inc', 'Cenex Harvest States'],
    industry: 'Agriculture',
    rank: 93
  },
  {
    canonicalName: 'Performance Food Group',
    alternateNames: ['PFG'],
    industry: 'Food & Beverage',
    rank: 82
  },

  // Fortune 500: 200-300
  {
    canonicalName: 'Land O\'Lakes',
    alternateNames: ['Land O Lakes'],
    industry: 'Agriculture',
    rank: 222
  },
  {
    canonicalName: 'Rite Aid',
    alternateNames: ['Rite Aid Corp'],
    industry: 'Retail',
    rank: 141
  },
  {
    canonicalName: 'Tech Data',
    alternateNames: ['TD Synnex', 'Synnex'],
    industry: 'Technology',
    rank: 83
  },
  {
    canonicalName: 'Nucor',
    alternateNames: ['Nucor Corp'],
    industry: 'Manufacturing',
    rank: 135
  },
  {
    canonicalName: 'Whirlpool',
    alternateNames: ['Whirlpool Corp'],
    industry: 'Manufacturing',
    rank: 153
  },
  {
    canonicalName: 'American Electric Power',
    alternateNames: ['AEP'],
    industry: 'Utilities',
    rank: 149
  },
  {
    canonicalName: 'Duke Energy',
    alternateNames: ['Duke Energy Corp'],
    industry: 'Utilities',
    rank: 139
  },
  {
    canonicalName: 'Southern Company',
    alternateNames: ['Southern Co'],
    industry: 'Utilities',
    rank: 140
  },
  {
    canonicalName: 'Exelon',
    alternateNames: ['Exelon Corp'],
    industry: 'Utilities',
    rank: 152
  },
  {
    canonicalName: 'NextEra Energy',
    alternateNames: ['NextEra'],
    industry: 'Utilities',
    rank: 169
  },
  {
    canonicalName: 'Dominion Energy',
    alternateNames: ['Dominion'],
    industry: 'Utilities',
    rank: 157
  },
  {
    canonicalName: 'Sempra Energy',
    alternateNames: ['Sempra'],
    industry: 'Utilities',
    rank: 244
  },
  {
    canonicalName: 'Public Service Enterprise Group',
    alternateNames: ['PSEG', 'PSE&G'],
    industry: 'Utilities',
    rank: 260
  },
  {
    canonicalName: 'Consolidated Edison',
    alternateNames: ['Con Edison', 'ConEd'],
    industry: 'Utilities',
    rank: 262
  },
  {
    canonicalName: 'Xcel Energy',
    alternateNames: ['Xcel'],
    industry: 'Utilities',
    rank: 295
  },
  {
    canonicalName: 'WEC Energy Group',
    alternateNames: ['Wisconsin Energy'],
    industry: 'Utilities',
    rank: 322
  },
  {
    canonicalName: 'Emerson Electric',
    alternateNames: ['Emerson'],
    industry: 'Manufacturing',
    rank: 165
  },
  {
    canonicalName: 'Illinois Tool Works',
    alternateNames: ['ITW'],
    industry: 'Manufacturing',
    rank: 194
  },
  {
    canonicalName: 'Parker Hannifin',
    alternateNames: ['Parker'],
    industry: 'Manufacturing',
    rank: 254
  },
  {
    canonicalName: 'Eaton',
    alternateNames: ['Eaton Corp'],
    industry: 'Manufacturing',
    rank: 247
  },

  // Fortune 500: 300-400
  {
    canonicalName: 'L3Harris Technologies',
    alternateNames: ['L3Harris', 'Harris Corp', 'L3 Technologies'],
    industry: 'Aerospace & Defense',
    rank: 196
  },
  {
    canonicalName: 'Leidos',
    alternateNames: ['Leidos Holdings'],
    industry: 'Technology',
    rank: 268
  },
  {
    canonicalName: 'CBRE Group',
    alternateNames: ['CBRE', 'CB Richard Ellis'],
    industry: 'Real Estate',
    rank: 129
  },
  {
    canonicalName: 'Jacobs Engineering',
    alternateNames: ['Jacobs', 'Jacobs Solutions'],
    industry: 'Engineering',
    rank: 207
  },
  {
    canonicalName: 'Fluor',
    alternateNames: ['Fluor Corp'],
    industry: 'Engineering',
    rank: 163
  },
  {
    canonicalName: 'AECOM',
    alternateNames: ['AECOM Technology'],
    industry: 'Engineering',
    rank: 157
  },
  {
    canonicalName: 'Quanta Services',
    alternateNames: ['Quanta'],
    industry: 'Engineering',
    rank: 298
  },
  {
    canonicalName: 'Lennar',
    alternateNames: ['Lennar Corp'],
    industry: 'Real Estate',
    rank: 145
  },
  {
    canonicalName: 'D.R. Horton',
    alternateNames: ['DR Horton'],
    industry: 'Real Estate',
    rank: 161
  },
  {
    canonicalName: 'PulteGroup',
    alternateNames: ['Pulte Homes'],
    industry: 'Real Estate',
    rank: 282
  },
  {
    canonicalName: 'NVR',
    alternateNames: ['NVR Inc'],
    industry: 'Real Estate',
    rank: 395
  },
  {
    canonicalName: 'Toll Brothers',
    alternateNames: ['Toll Brothers Inc'],
    industry: 'Real Estate',
    rank: 433
  },
  {
    canonicalName: 'Host Hotels & Resorts',
    alternateNames: ['Host Hotels'],
    industry: 'Real Estate',
    rank: 441
  },
  {
    canonicalName: 'Waste Management',
    alternateNames: ['WM', 'Waste Management Inc'],
    industry: 'Services',
    rank: 224
  },
  {
    canonicalName: 'Republic Services',
    alternateNames: ['Republic Services Inc'],
    industry: 'Services',
    rank: 293
  },
  {
    canonicalName: 'Aramark',
    alternateNames: ['Aramark Corp'],
    industry: 'Services',
    rank: 234
  },
  {
    canonicalName: 'Sodexo',
    alternateNames: ['Sodexo Inc'],
    industry: 'Services'
  },
  {
    canonicalName: 'Cintas',
    alternateNames: ['Cintas Corp'],
    industry: 'Services',
    rank: 404
  },
  {
    canonicalName: 'Rollins',
    alternateNames: ['Rollins Inc', 'Orkin'],
    industry: 'Services',
    rank: 497
  },

  // Fortune 500: 400-500
  {
    canonicalName: 'Kohl\'s',
    alternateNames: ['Kohls', 'Kohl\'s Corp'],
    industry: 'Retail',
    rank: 179
  },
  {
    canonicalName: 'Nordstrom',
    alternateNames: ['Nordstrom Inc'],
    industry: 'Retail',
    rank: 243
  },
  {
    canonicalName: 'Gap',
    alternateNames: ['The Gap', 'Gap Inc'],
    industry: 'Retail',
    rank: 202
  },
  {
    canonicalName: 'Ross Stores',
    alternateNames: ['Ross Dress for Less'],
    industry: 'Retail',
    rank: 142
  },
  {
    canonicalName: 'TJX Companies',
    alternateNames: ['TJX', 'TJ Maxx', 'Marshalls'],
    industry: 'Retail',
    rank: 80
  },
  {
    canonicalName: 'Dollar General',
    alternateNames: ['Dollar General Corp'],
    industry: 'Retail',
    rank: 114
  },
  {
    canonicalName: 'Dollar Tree',
    alternateNames: ['Dollar Tree Inc', 'Family Dollar'],
    industry: 'Retail',
    rank: 123
  },
  {
    canonicalName: 'AutoNation',
    alternateNames: ['AutoNation Inc'],
    industry: 'Retail',
    rank: 126
  },
  {
    canonicalName: 'CarMax',
    alternateNames: ['CarMax Inc'],
    industry: 'Retail',
    rank: 125
  },
  {
    canonicalName: 'Penske Automotive Group',
    alternateNames: ['Penske Automotive'],
    industry: 'Retail',
    rank: 167
  },
  {
    canonicalName: 'Lithia Motors',
    alternateNames: ['Lithia & Driveway'],
    industry: 'Retail',
    rank: 181
  },
  {
    canonicalName: 'Group 1 Automotive',
    alternateNames: ['Group 1'],
    industry: 'Retail',
    rank: 307
  },
  {
    canonicalName: 'Hertz',
    alternateNames: ['Hertz Global Holdings', 'Hertz Rent-A-Car'],
    industry: 'Transportation',
    rank: 310
  },
  {
    canonicalName: 'Avis Budget Group',
    alternateNames: ['Avis', 'Budget Rent a Car'],
    industry: 'Transportation',
    rank: 378
  },
  {
    canonicalName: 'AutoZone',
    alternateNames: ['AutoZone Inc'],
    industry: 'Retail',
    rank: 144
  },
  {
    canonicalName: 'O\'Reilly Automotive',
    alternateNames: ['O\'Reilly Auto Parts', 'OReilly'],
    industry: 'Retail',
    rank: 210
  },
  {
    canonicalName: 'Advance Auto Parts',
    alternateNames: ['Advance Auto'],
    industry: 'Retail',
    rank: 227
  },
  {
    canonicalName: 'Genuine Parts',
    alternateNames: ['Genuine Parts Company', 'NAPA Auto Parts'],
    industry: 'Retail',
    rank: 237
  },
  {
    canonicalName: 'Tractor Supply',
    alternateNames: ['Tractor Supply Co'],
    industry: 'Retail',
    rank: 314
  },
  {
    canonicalName: 'Williams-Sonoma',
    alternateNames: ['Williams Sonoma', 'Pottery Barn'],
    industry: 'Retail',
    rank: 424
  },
  {
    canonicalName: 'Bed Bath & Beyond',
    alternateNames: ['Bed Bath and Beyond', 'BBB'],
    industry: 'Retail',
    rank: 239
  },
  {
    canonicalName: 'Office Depot',
    alternateNames: ['Office Depot Inc', 'OfficeMax'],
    industry: 'Retail',
    rank: 248
  },
  {
    canonicalName: 'Staples',
    alternateNames: ['Staples Inc'],
    industry: 'Retail',
    rank: 166
  },
  {
    canonicalName: 'Big Lots',
    alternateNames: ['Big Lots Inc'],
    industry: 'Retail',
    rank: 450
  },
  {
    canonicalName: 'Five Below',
    alternateNames: ['Five Below Inc'],
    industry: 'Retail'
  },
  {
    canonicalName: 'Burlington Stores',
    alternateNames: ['Burlington Coat Factory', 'Burlington'],
    industry: 'Retail',
    rank: 281
  },
  {
    canonicalName: 'Foot Locker',
    alternateNames: ['Foot Locker Inc'],
    industry: 'Retail',
    rank: 423
  },
  {
    canonicalName: 'Dick\'s Sporting Goods',
    alternateNames: ['Dicks Sporting Goods', 'Dick\'s'],
    industry: 'Retail',
    rank: 278
  },
  {
    canonicalName: 'Academy Sports',
    alternateNames: ['Academy Sports + Outdoors'],
    industry: 'Retail'
  },
  {
    canonicalName: 'GameStop',
    alternateNames: ['GameStop Corp'],
    industry: 'Retail',
    rank: 464
  },
  {
    canonicalName: 'Sherwin-Williams',
    alternateNames: ['Sherwin Williams', 'Sherwin-Williams Co'],
    industry: 'Retail',
    rank: 178
  },
  {
    canonicalName: 'PPG Industries',
    alternateNames: ['PPG'],
    industry: 'Manufacturing',
    rank: 192
  },
  {
    canonicalName: 'Ball Corporation',
    alternateNames: ['Ball Corp'],
    industry: 'Manufacturing',
    rank: 321
  },
  {
    canonicalName: 'Packaging Corporation of America',
    alternateNames: ['PCA', 'Packaging Corp'],
    industry: 'Manufacturing',
    rank: 323
  },
  {
    canonicalName: 'International Paper',
    alternateNames: ['International Paper Co'],
    industry: 'Manufacturing',
    rank: 198
  },
  {
    canonicalName: 'WestRock',
    alternateNames: ['WestRock Co'],
    industry: 'Manufacturing',
    rank: 236
  },
  {
    canonicalName: 'Owens Corning',
    alternateNames: ['Owens Corning Inc'],
    industry: 'Manufacturing',
    rank: 356
  },
  {
    canonicalName: 'Stanley Black & Decker',
    alternateNames: ['Stanley Black and Decker', 'Stanley', 'Black & Decker'],
    industry: 'Manufacturing',
    rank: 286
  },
  {
    canonicalName: 'Newell Brands',
    alternateNames: ['Newell Rubbermaid'],
    industry: 'Manufacturing',
    rank: 343
  },
  {
    canonicalName: 'Clorox',
    alternateNames: ['The Clorox Company'],
    industry: 'Consumer Goods',
    rank: 474
  },
  {
    canonicalName: 'Colgate-Palmolive',
    alternateNames: ['Colgate'],
    industry: 'Consumer Goods',
    rank: 270
  },
  {
    canonicalName: 'Kimberly-Clark',
    alternateNames: ['Kimberly Clark'],
    industry: 'Consumer Goods',
    rank: 177
  },
  {
    canonicalName: 'Estee Lauder',
    alternateNames: ['The Estee Lauder Companies', 'Estée Lauder'],
    industry: 'Consumer Goods',
    rank: 252
  },
  {
    canonicalName: 'Coty',
    alternateNames: ['Coty Inc'],
    industry: 'Consumer Goods',
    rank: 417
  },
  {
    canonicalName: 'Hasbro',
    alternateNames: ['Hasbro Inc'],
    industry: 'Consumer Goods',
    rank: 480
  },
  {
    canonicalName: 'Mattel',
    alternateNames: ['Mattel Inc'],
    industry: 'Consumer Goods',
    rank: 470
  },
  {
    canonicalName: 'VF Corporation',
    alternateNames: ['VF Corp', 'Vans', 'The North Face'],
    industry: 'Consumer Goods',
    rank: 291
  },
  {
    canonicalName: 'Ralph Lauren',
    alternateNames: ['Ralph Lauren Corp', 'Polo Ralph Lauren'],
    industry: 'Consumer Goods',
    rank: 494
  },
  {
    canonicalName: 'Tapestry',
    alternateNames: ['Tapestry Inc', 'Coach', 'Kate Spade'],
    industry: 'Consumer Goods',
    rank: 488
  },
  {
    canonicalName: 'Under Armour',
    alternateNames: ['Under Armour Inc'],
    industry: 'Consumer Goods',
    rank: 455
  },
  {
    canonicalName: 'Nike',
    alternateNames: ['Nike Inc'],
    industry: 'Consumer Goods',
    rank: 90
  },
  {
    canonicalName: 'Levi Strauss',
    alternateNames: ['Levi\'s', 'Levi Strauss & Co'],
    industry: 'Consumer Goods'
  },
  {
    canonicalName: 'Skechers',
    alternateNames: ['Skechers USA'],
    industry: 'Consumer Goods'
  },
  {
    canonicalName: 'Crocs',
    alternateNames: ['Crocs Inc'],
    industry: 'Consumer Goods'
  },
  {
    canonicalName: 'Yum! Brands',
    alternateNames: ['Yum Brands', 'Yum! Brands Inc', 'KFC', 'Taco Bell', 'Pizza Hut'],
    industry: 'Food & Beverage',
    rank: 359
  },
  {
    canonicalName: 'McDonald\'s',
    alternateNames: ['McDonalds', 'McDonald\'s Corp'],
    industry: 'Food & Beverage',
    rank: 132
  },
  {
    canonicalName: 'Chipotle',
    alternateNames: ['Chipotle Mexican Grill'],
    industry: 'Food & Beverage'
  },
  {
    canonicalName: 'Domino\'s Pizza',
    alternateNames: ['Dominos', 'Domino\'s Pizza Inc'],
    industry: 'Food & Beverage'
  },
  {
    canonicalName: 'Papa John\'s',
    alternateNames: ['Papa Johns International'],
    industry: 'Food & Beverage'
  },
  {
    canonicalName: 'Wendy\'s',
    alternateNames: ['Wendys', 'The Wendy\'s Company'],
    industry: 'Food & Beverage'
  },
  {
    canonicalName: 'Restaurant Brands International',
    alternateNames: ['RBI', 'Burger King', 'Tim Hortons', 'Popeyes'],
    industry: 'Food & Beverage',
    rank: 361
  },
  {
    canonicalName: 'Darden Restaurants',
    alternateNames: ['Darden', 'Olive Garden', 'LongHorn Steakhouse'],
    industry: 'Food & Beverage',
    rank: 438
  },
  {
    canonicalName: 'Hilton',
    alternateNames: ['Hilton Worldwide Holdings', 'Hilton Hotels'],
    industry: 'Hospitality',
    rank: 228
  },
  {
    canonicalName: 'Marriott International',
    alternateNames: ['Marriott'],
    industry: 'Hospitality',
    rank: 189
  },
  {
    canonicalName: 'Hyatt Hotels',
    alternateNames: ['Hyatt'],
    industry: 'Hospitality',
    rank: 395
  },
  {
    canonicalName: 'Wyndham Hotels & Resorts',
    alternateNames: ['Wyndham'],
    industry: 'Hospitality'
  },
  {
    canonicalName: 'MGM Resorts International',
    alternateNames: ['MGM Resorts', 'MGM'],
    industry: 'Hospitality',
    rank: 364
  },
  {
    canonicalName: 'Caesars Entertainment',
    alternateNames: ['Caesars', 'Harrah\'s'],
    industry: 'Hospitality',
    rank: 340
  },
  {
    canonicalName: 'Las Vegas Sands',
    alternateNames: ['LV Sands', 'Sands Corp'],
    industry: 'Hospitality',
    rank: 258
  },
  {
    canonicalName: 'Wynn Resorts',
    alternateNames: ['Wynn'],
    industry: 'Hospitality',
    rank: 485
  },
];

/**
 * Find Fortune 500 canonical name for a company
 * Returns canonical name if match found, null otherwise
 */
export function findFortune500Match(companyName: string): {
  canonicalName: string;
  industry: string;
  isFortune500: boolean;
  rank?: number;
} | null {
  if (!companyName) return null;
  
  const normalized = companyName.toLowerCase().trim();
  
  for (const company of FORTUNE_500_COMPANIES) {
    // Check canonical name
    if (company.canonicalName.toLowerCase() === normalized) {
      return {
        canonicalName: company.canonicalName,
        industry: company.industry,
        isFortune500: true,
        rank: company.rank
      };
    }
    
    // Check alternate names
    for (const altName of company.alternateNames) {
      if (altName.toLowerCase() === normalized) {
        return {
          canonicalName: company.canonicalName,
          industry: company.industry,
          isFortune500: true,
          rank: company.rank
        };
      }
    }
    
    // Fuzzy match - check if normalized contains canonical name or vice versa
    const canonicalLower = company.canonicalName.toLowerCase();
    if (normalized.includes(canonicalLower) || canonicalLower.includes(normalized)) {
      // Additional check: must be substantial overlap (at least 70% of shorter string)
      const shortLen = Math.min(normalized.length, canonicalLower.length);
      const longLen = Math.max(normalized.length, canonicalLower.length);
      if (shortLen / longLen >= 0.7) {
        return {
          canonicalName: company.canonicalName,
          industry: company.industry,
          isFortune500: true,
          rank: company.rank
        };
      }
    }
  }
  
  return null;
}

/**
 * Get all Fortune 500 company names (for dropdown/autocomplete)
 */
export function getAllFortune500Names(): string[] {
  return FORTUNE_500_COMPANIES.map(c => c.canonicalName).sort();
}

/**
 * Check if a company is Fortune 500 (boolean check)
 */
export function isFortune500Company(companyName: string): boolean {
  return findFortune500Match(companyName) !== null;
}
