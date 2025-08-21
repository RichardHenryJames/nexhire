import { dbService } from '../services/database.service';
import { successResponse } from '../utils/validation';

// Define interfaces for better type safety
interface ExternalAPIResponse {
    results?: {
        companies?: any[];
    };
}

interface University {
    name?: string;
    country?: string;
    'state-province'?: string;
    web_pages?: string[];
    domains?: string[];
    alpha_two_code?: string;
}

// Get all organizations for registration dropdown
export const getOrganizations = async (req: any): Promise<any> => {
    try {
        // Parse query parameters
        const url = new URL(req.url);
        const source = url.searchParams.get('source') || 'database';
        const country = url.searchParams.get('country') || 'US';
        const limit = parseInt(url.searchParams.get('limit') || '1000');

        let organizations: any[] = [];

        // Always get database organizations first
        const query = `
            SELECT 
                OrganizationID as id,
                Name as name,
                Industry as industry,
                CASE 
                    WHEN Size = 'Small' THEN '1-50'
                    WHEN Size = 'Medium' THEN '51-200'
                    WHEN Size = 'Large' THEN '201-1000'
                    WHEN Size = 'Enterprise' THEN '1000+'
                    ELSE Size
                END as size,
                Type as type,
                LogoURL as logoURL,
                Website as website,
                LinkedInProfile as linkedIn,
                VerificationStatus as verification
            FROM Organizations 
            WHERE IsActive = 1
            ORDER BY Name ASC
        `;

        const result = await dbService.executeQuery(query);
        organizations = result.recordset || [];

        // If requested, also fetch from external APIs
        if (source === 'external' || source === 'all') {
            try {
                console.log('Fetching companies from external APIs...');
                
                const externalCompanies = await Promise.allSettled([
                    fetchFromOpenCorporates(country, 50),
                    fetchFromFortuneAPI(50),
                    fetchFromUnicornAPI(50)
                ]);

                externalCompanies.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value) {
                        organizations.push(...result.value);
                        console.log(`? External API ${index + 1}: ${result.value.length} companies`);
                    } else {
                        console.log(`External API ${index + 1} failed:`, result.status === 'rejected' ? result.reason : 'No data');
                    }
                });

            } catch (error) {
                console.warn('Error fetching external companies:', error);
            }
        }

        // Remove duplicates based on name
        const uniqueOrganizations = organizations.filter((org, index, self) => 
            index === self.findIndex(o => o.name?.toLowerCase() === org.name?.toLowerCase())
        );

        // Limit results if specified
        const limitedOrganizations = uniqueOrganizations.slice(0, limit);

        // Add "My company is not listed" option at the end
        limitedOrganizations.push({
            id: 999999,
            name: 'My company is not listed',
            industry: 'Other',
            size: 'Unknown',
            type: 'Other',
            logoURL: null,
            website: null,
            verification: 'Manual'
        });

        return {
            status: 200,
            jsonBody: successResponse({
                organizations: limitedOrganizations,
                total: limitedOrganizations.length - 1,
                source: source,
                fromDatabase: organizations.length > 0,
                fromExternal: source !== 'database'
            }, `Organizations retrieved successfully (${limitedOrganizations.length - 1} companies)`)
        };
    } catch (error) {
        console.error('Error getting organizations:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Failed to retrieve organizations',
                message: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
};

// External API integration functions
async function fetchFromOpenCorporates(country: string, limit: number): Promise<any[]> {
    try {
        const apiUrl = `https://api.opencorporates.com/v0.4/companies/search?jurisdiction_code=${country.toLowerCase()}&per_page=${limit}&format=json`;
        
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'NexHire-Platform/1.0',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`OpenCorporates API error: ${response.status}`);
        }

        const data = await response.json() as ExternalAPIResponse;
        
        if (data && data.results && Array.isArray(data.results.companies)) {
            return data.results.companies.map((item: any) => {
                const company = item?.company || {};
                return {
                    id: `oc_${company.company_number || Math.random()}`,
                    name: company.name || 'Unknown Company',
                    industry: company.company_type || 'Unknown',
                    size: 'Unknown',
                    type: 'Corporation',
                    logoURL: null,
                    website: company.registry_url || null,
                    verification: 'External API',
                    source: 'OpenCorporates'
                };
            });
        }
        
        return [];
    } catch (error) {
        console.error('OpenCorporates API error:', error);
        return [];
    }
}

async function fetchFromFortuneAPI(limit: number): Promise<any[]> {
    try {
        const apiUrl = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv';
        
        const response = await fetch(apiUrl, {
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`Fortune API error: ${response.status}`);
        }

        const csvData = await response.text();
        const lines = csvData.split('\n').slice(1);
        
        const companies = [];
        for (let i = 0; i < Math.min(lines.length, limit); i++) {
            const line = lines[i].trim();
            if (line) {
                const fields = line.split(',');
                if (fields.length >= 3) {
                    companies.push({
                        id: `sp500_${i}`,
                        name: fields[1]?.replace(/"/g, '') || 'Unknown Company',
                        industry: fields[3]?.replace(/"/g, '') || 'Technology',
                        size: 'Enterprise',
                        type: 'Corporation',
                        logoURL: null,
                        website: fields[7] ? `https://${fields[7].replace(/"/g, '')}` : null,
                        verification: 'S&P 500',
                        source: 'Fortune 500'
                    });
                }
            }
        }
        
        return companies;
    } catch (error) {
        console.error('Fortune API error:', error);
        return [];
    }
}

async function fetchFromUnicornAPI(limit: number): Promise<any[]> {
    try {
        const apiUrl = 'https://raw.githubusercontent.com/datasets/unicorns/master/data/unicorns.csv';
        
        const response = await fetch(apiUrl, {
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`Unicorn API error: ${response.status}`);
        }

        const csvData = await response.text();
        const lines = csvData.split('\n').slice(1);
        
        const companies = [];
        for (let i = 0; i < Math.min(lines.length, limit); i++) {
            const line = lines[i].trim();
            if (line) {
                const fields = line.split(',');
                if (fields.length >= 2) {
                    companies.push({
                        id: `unicorn_${i}`,
                        name: fields[0]?.replace(/"/g, '') || 'Unknown Company',
                        industry: fields[2]?.replace(/"/g, '') || 'Technology',
                        size: 'Large',
                        type: 'Corporation',
                        logoURL: null,
                        website: null,
                        verification: 'Unicorn',
                        source: 'Unicorn Startups'
                    });
                }
            }
        }
        
        return companies;
    } catch (error) {
        console.error('Unicorn API error:', error);
        return [];
    }
}

// Get job types
export const getJobTypes = async (req: any): Promise<any> => {
    try {
        const query = 'SELECT JobTypeID, Type FROM JobTypes WHERE IsActive = 1 ORDER BY Type';
        const result = await dbService.executeQuery(query);

        return {
            status: 200,
            jsonBody: successResponse(result.recordset || [], 'Job types retrieved successfully')
        };
    } catch (error) {
        console.error('Error getting job types:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Failed to retrieve job types',
                message: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
};

// Get currencies
export const getCurrencies = async (req: any): Promise<any> => {
    try {
        const query = 'SELECT CurrencyID, Code, Symbol, Name FROM Currencies WHERE IsActive = 1 ORDER BY Code';
        const result = await dbService.executeQuery(query);

        return {
            status: 200,
            jsonBody: successResponse(result.recordset || [], 'Currencies retrieved successfully')
        };
    } catch (error) {
        console.error('Error getting currencies:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Failed to retrieve currencies',
                message: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
};

// Get industries
export const getIndustries = async (req: any): Promise<any> => {
    try {
        const query = `
            SELECT DISTINCT Industry as name
            FROM Organizations 
            WHERE IsActive = 1 AND Industry IS NOT NULL AND Industry != ''
            ORDER BY Industry ASC
        `;
        
        const result = await dbService.executeQuery(query);
        const industries = (result.recordset || []).map(row => row.name);

        return {
            status: 200,
            jsonBody: successResponse(industries, 'Industries retrieved successfully')
        };
    } catch (error) {
        console.error('Error getting industries:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Failed to retrieve industries',
                message: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
};

// Get colleges/universities from external API
export const getColleges = async (req: any): Promise<any> => {
    try {
        const url = new URL(req.url);
        const country = url.searchParams.get('country') || 'India';
        const searchName = url.searchParams.get('name') || '';
        
        console.log(`Fetching universities for country: ${country}, search: ${searchName}`);
        
        let apiUrl = `http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}`;
        if (searchName) {
            apiUrl += `&name=${encodeURIComponent(searchName)}`;
        }
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'NexHire-Platform/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`Universities API responded with status: ${response.status}`);
        }

        const universitiesData = await response.json();
        const universities = Array.isArray(universitiesData) ? universitiesData as University[] : [];
        
        const transformedColleges = universities.map((uni: University, index: number) => ({
            id: index + 1,
            name: uni.name || 'Unknown University',
            type: 'University',
            country: uni.country || country,
            state: uni['state-province'] || null,
            city: null,
            website: uni.web_pages && uni.web_pages.length > 0 ? uni.web_pages[0] : null,
            domains: uni.domains || [],
            establishedYear: null,
            isPublic: null,
            globalRanking: null,
            description: `University in ${uni['state-province'] || uni.country}`,
            logoURL: null,
            alpha_two_code: uni.alpha_two_code || null
        }));

        transformedColleges.sort((a: any, b: any) => a.name.localeCompare(b.name));

        if (country === 'India' && !searchName) {
            const internationalUniversities = [
                {
                    id: 99001,
                    name: 'Harvard University',
                    type: 'University',
                    country: 'United States',
                    state: 'Massachusetts',
                    city: null,
                    website: 'https://www.harvard.edu',
                    domains: ['harvard.edu'],
                    establishedYear: null,
                    isPublic: null,
                    globalRanking: null,
                    description: 'Private Ivy League research university',
                    logoURL: null,
                    alpha_two_code: 'US'
                },
                {
                    id: 99002,
                    name: 'Stanford University',
                    type: 'University',
                    country: 'United States',
                    state: 'California',
                    city: null,
                    website: 'https://www.stanford.edu',
                    domains: ['stanford.edu'],
                    establishedYear: null,
                    isPublic: null,
                    globalRanking: null,
                    description: 'Private research university in Silicon Valley',
                    logoURL: null,
                    alpha_two_code: 'US'
                },
                {
                    id: 99003,
                    name: 'Massachusetts Institute of Technology (MIT)',
                    type: 'University',
                    country: 'United States',
                    state: 'Massachusetts',
                    city: null,
                    website: 'https://www.mit.edu',
                    domains: ['mit.edu'],
                    establishedYear: null,
                    isPublic: null,
                    globalRanking: null,
                    description: 'Private research university specializing in technology',
                    logoURL: null,
                    alpha_two_code: 'US'
                }
            ];
            
            transformedColleges.unshift(...internationalUniversities);
        }

        transformedColleges.push({
            id: 999999,
            name: 'Other',
            type: 'Other',
            country: 'Various',
            state: null,
            city: null,
            website: null,
            domains: [],
            establishedYear: null,
            isPublic: null,
            globalRanking: null,
            description: 'My school/college is not listed',
            logoURL: null,
            alpha_two_code: null
        });

        console.log(`Successfully fetched ${transformedColleges.length - 1} universities + Other option`);

        return {
            status: 200,
            jsonBody: successResponse(transformedColleges, `Educational institutions retrieved successfully from external API (${transformedColleges.length - 1} universities)`)
        };
        
    } catch (error) {
        console.error('Error fetching universities from external API:', error);
        
        const fallbackColleges = [
            { id: 1, name: 'Indian Institute of Technology (IIT) Delhi', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.iitd.ac.in' },
            { id: 2, name: 'Indian Institute of Technology (IIT) Bombay', type: 'University', country: 'India', state: 'Maharashtra', website: 'https://www.iitb.ac.in' },
            { id: 3, name: 'Indian Institute of Technology (IIT) Kanpur', type: 'University', country: 'India', state: 'Uttar Pradesh', website: 'https://www.iitk.ac.in' },
            { id: 51, name: 'Harvard University', type: 'University', country: 'United States', state: 'Massachusetts', website: 'https://www.harvard.edu' },
            { id: 52, name: 'Stanford University', type: 'University', country: 'United States', state: 'California', website: 'https://www.stanford.edu' },
            { id: 53, name: 'Massachusetts Institute of Technology (MIT)', type: 'University', country: 'United States', state: 'Massachusetts', website: 'https://www.mit.edu' },
            { id: 999999, name: 'Other', type: 'Other', country: 'Various', state: null, website: null }
        ];
        
        return {
            status: 200,
            jsonBody: successResponse(fallbackColleges, 'Educational institutions retrieved (fallback data - external API unavailable)')
        };
    }
};

// Get universities by country for global coverage
export const getUniversitiesByCountry = async (req: any): Promise<any> => {
    try {
        const url = new URL(req.url);
        const country = url.searchParams.get('country') || 'India';
        
        console.log(`Fetching universities specifically for country: ${country}`);
        
        const apiUrl = `http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'NexHire-Platform/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`Universities API responded with status: ${response.status}`);
        }

        const universitiesData = await response.json();
        const universities = Array.isArray(universitiesData) ? universitiesData as University[] : [];
        
        const groupedUniversities = universities.reduce((acc: any, uni: University) => {
            const state = uni['state-province'] || 'Other';
            if (!acc[state]) {
                acc[state] = [];
            }
            acc[state].push({
                id: `${uni.name || 'unknown'}-${state}`.replace(/\s+/g, '-').toLowerCase(),
                name: uni.name || 'Unknown University',
                type: 'University',
                country: uni.country || country,
                state: uni['state-province'] || null,
                website: uni.web_pages && uni.web_pages.length > 0 ? uni.web_pages[0] : null,
                domains: uni.domains || []
            });
            return acc;
        }, {});

        return {
            status: 200,
            jsonBody: successResponse({
                country: country,
                totalUniversities: universities.length,
                universitiesByState: groupedUniversities
            }, `Universities for ${country} retrieved successfully`)
        };
        
    } catch (error) {
        console.error('Error fetching universities by country:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Failed to retrieve universities by country',
                message: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
};