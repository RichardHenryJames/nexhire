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

// NEW: Get workplace types
export const getWorkplaceTypes = async (req: any): Promise<any> => {
    try {
        const query = 'SELECT WorkplaceTypeID, Type FROM WorkplaceTypes WHERE IsActive = 1 ORDER BY Type';
        const result = await dbService.executeQuery(query);
        return {
            status: 200,
            jsonBody: successResponse(result.recordset || [], 'Workplace types retrieved successfully')
        };
    } catch (error) {
        console.error('Error getting workplace types:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Failed to retrieve workplace types',
                message: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
};

// Get all organizations for registration dropdown
export const getOrganizations = async (req: any): Promise<any> => {
    try {
        // Parse query parameters
        const url = new URL(req.url);
        const source = url.searchParams.get('source') || 'database';
        const country = url.searchParams.get('country') || 'US';
        const limitParam = url.searchParams.get('limit');
        const offsetParam = url.searchParams.get('offset');
        const limit = limitParam ? parseInt(limitParam) : null; // null means no limit
        const offset = offsetParam ? parseInt(offsetParam) : 0; // default offset is 0

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
                VerificationStatus as verification,
                IsFortune500 as isFortune500
            FROM Organizations 
            WHERE IsActive = 1
            ORDER BY IsFortune500 DESC, Name ASC
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
                        const companies = result.value as any[];
                        organizations.push(...companies);
                        console.log(`✅ External API ${index + 1}: ${companies.length} companies`);
                    } else {
                        console.log(`External API ${index + 1} failed:`, result.status === 'rejected' ? result.reason : 'No data');
                    }
                });

            } catch (error) {
                console.warn('Error fetching external companies:', error);
            }
        }

        // Remove duplicates based on name
        const uniqueOrganizations: any[] = organizations.filter((org: any, index: number, self: any[]) => 
            index === self.findIndex((o: any) => o.name?.toLowerCase() === org.name?.toLowerCase())
        );

        // Apply offset and limit for pagination
        let paginatedOrganizations: any[];
        if (limit) {
            // If limit is specified, apply offset + limit
            paginatedOrganizations = uniqueOrganizations.slice(offset, offset + limit);
        } else if (offset > 0) {
            // If only offset is specified (no limit), get all from offset onwards
            paginatedOrganizations = uniqueOrganizations.slice(offset);
        } else {
            // No offset, no limit - return all
            paginatedOrganizations = uniqueOrganizations;
        }

        // Add "My company is not listed" option at the end
        paginatedOrganizations.push({
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
                organizations: paginatedOrganizations,
                total: uniqueOrganizations.length,
                offset: offset,
                limit: limit,
                hasMore: limit ? (offset + limit < uniqueOrganizations.length) : false,
                source: source,
                fromDatabase: organizations.length > 0,
                fromExternal: source !== 'database'
            }, `Organizations retrieved successfully (${paginatedOrganizations.length - 1} companies)`)
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
                'User-Agent': 'RefOpen-Platform/1.0',
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
        
        const companies: any[] = [];
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
        
        const companies: any[] = [];
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
    const url = new URL(req.url);
    const country = url.searchParams.get('country') || 'India';
    const searchName = url.searchParams.get('name') || '';
    
    try {
        console.log(`Fetching universities for country: ${country}, search: ${searchName}`);
        
        let apiUrl = `http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}`;
        if (searchName) {
            apiUrl += `&name=${encodeURIComponent(searchName)}`;
        }
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'RefOpen-Platform/1.0'
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

        // 🚫 REMOVED: No more international universities mixed with country-specific results
        // This was causing Harvard to show up when selecting India
        
        // Only add "Other" option
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

        console.log(`Successfully fetched ${transformedColleges.length - 1} universities for ${country} + Other option`);

        return {
            status: 200,
            jsonBody: successResponse(transformedColleges, `Educational institutions retrieved successfully from external API (${transformedColleges.length - 1} universities for ${country})`)
        };
        
    } catch (error) {
        console.error('Error fetching universidades desde la API externa:', error);
        
        // 🏗️ Datos de respaldo específicos del país
        const fallbackColleges = getFallbackCollegesByCountry(country);
        
        return {
            status: 200,
            jsonBody: successResponse(fallbackColleges, `Instituciones educativas recuperadas (datos de respaldo para ${country} - API externa no disponible)`)
        };
    }
};

// 🌍 Helper function to get country-specific fallback colleges
function getFallbackCollegesByCountry(country: string): any[] {
    const fallbackData: { [key: string]: any[] } = {
        'India': [
            { id: 1, name: 'Indian Institute of Technology (IIT) Delhi', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.iitd.ac.in' },
            { id: 2, name: 'Indian Institute of Technology (IIT) Bombay', type: 'University', country: 'India', state: 'Maharashtra', website: 'https://www.iitb.ac.in' },
            { id: 3, name: 'Indian Institute of Technology (IIT) Kanpur', type: 'University', country: 'India', state: 'Uttar Pradesh', website: 'https://www.iitk.ac.in' },
            { id: 4, name: 'Indian Institute of Technology (IIT) Madras', type: 'University', country: 'India', state: 'Tamil Nadu', website: 'https://www.iitm.ac.in' },
            { id: 5, name: 'Indian Institute of Science (IISc) Bangalore', type: 'University', country: 'India', state: 'Karnataka', website: 'https://www.iisc.ac.in' },
            { id: 6, name: 'All India Institute of Medical Sciences (AIIMS) Delhi', type: 'Medical University', country: 'India', state: 'Delhi', website: 'https://www.aiims.edu' },
            { id: 7, name: 'Jawaharlal Nehru University (JNU)', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.jnu.ac.in' },
            { id: 8, name: 'University of Delhi', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.du.ac.in' }
        ],
        'United States': [
            { id: 51, name: 'Harvard University', type: 'University', country: 'United States', state: 'Massachusetts', website: 'https://www.harvard.edu' },
            { id: 52, name: 'Stanford University', type: 'University', country: 'United States', state: 'California', website: 'https://www.stanford.edu' },
            { id: 53, name: 'Massachusetts Institute of Technology (MIT)', type: 'University', country: 'United States', state: 'Massachusetts', website: 'https://www.mit.edu' },
            { id: 54, name: 'California Institute of Technology (Caltech)', type: 'University', country: 'United States', state: 'California', website: 'https://www.caltech.edu' },
            { id: 55, name: 'University of California, Berkeley', type: 'University', country: 'United States', state: 'California', website: 'https://www.berkeley.edu' },
            { id: 56, name: 'Princeton University', type: 'University', country: 'United States', state: 'New Jersey', website: 'https://www.princeton.edu' }
        ],
        'United Kingdom': [
            { id: 71, name: 'University of Oxford', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.ox.ac.uk' },
            { id: 72, name: 'University of Cambridge', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.cam.ac.uk' },
            { id: 73, name: 'Imperial College London', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.imperial.ac.uk' },
            { id: 74, name: 'London School of Economics (LSE)', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.lse.ac.uk' },
            { id: 75, name: 'University College London (UCL)', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.ucl.ac.uk' }
        ],
        'Canada': [
            { id: 91, name: 'University of Toronto', type: 'University', country: 'Canada', state: 'Ontario', website: 'https://www.utoronto.ca' },
            { id: 92, name: 'McGill University', type: 'University', country: 'Canada', state: 'Quebec', website: 'https://www.mcgill.ca' },
            { id: 93, name: 'University of British Columbia', type: 'University', country: 'Canada', state: 'British Columbia', website: 'https://www.ubc.ca' },
            { id: 94, name: 'University of Waterloo', type: 'University', country: 'Canada', state: 'Ontario', website: 'https://uwaterloo.ca' }
        ]
    };

    const countryColleges = fallbackData[country] || [];
    
    // Always add "Other" option
    countryColleges.push({
        id: 999999,
        name: 'Other',
        type: 'Other',
        country: 'Various',
        state: null,
        website: null
    });

    return countryColleges;
}

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
                'User-Agent': 'RefOpen-Platform/1.0'
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

// NEW: Get all countries for education country selection
export const getCountries = async (req: any): Promise<any> => {
    try {
        console.log('Fetching countries from REST Countries API...');
        
        // Fetch countries from REST Countries API
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,flag,cca2,cca3,region,subregion', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'RefOpen-Platform/1.0'
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error(`REST Countries API responded with status: ${response.status}`);
        }

        const countriesData = await response.json();
        
        if (!Array.isArray(countriesData)) {
            throw new Error('Invalid response format from REST Countries API');
        }

        // Transform and sort countries
        const transformedCountries = countriesData
            .map((country: any) => ({
                id: country.cca2 || country.cca3,
                name: country.name?.common || 'Unknown Country',
                officialName: country.name?.official || country.name?.common,
                code: country.cca2 || country.cca3,
                code3: country.cca3,
                flag: country.flag || '🏳️',
                region: country.region || 'Unknown',
                subregion: country.subregion || 'Unknown'
            }))
            .filter((country: any) => country.name && country.name !== 'Unknown Country')
            .sort((a: any, b: any) => a.name.localeCompare(b.name));

        // Prioritize certain countries for education (move to top)
        const priorityCountries = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Singapore'];
        
        const prioritized: any[] = [];
        const others: any[] = [];
        
        transformedCountries.forEach((country: any) => {
            if (priorityCountries.includes(country.name)) {
                prioritized.push(country);
            } else {
                others.push(country);
            }
        });

        // Sort priority countries by the order defined in priorityCountries
        prioritized.sort((a: any, b: any) => {
            const aIndex = priorityCountries.indexOf(a.name);
            const bIndex = priorityCountries.indexOf(b.name);
            return aIndex - bIndex;
        });

        const finalCountries = [...prioritized, ...others];

        console.log(`Successfully fetched ${finalCountries.length} countries`);

        return {
            status: 200,
            jsonBody: successResponse({
                countries: finalCountries,
                total: finalCountries.length,
                defaultCountry: 'India',
                priorityCountries: priorityCountries
            }, `Countries retrieved successfully (${finalCountries.length} countries)`)
        };
        
    } catch (error) {
        console.error('Error fetching countries from REST Countries API:', error);
        
        // Fallback country data with proper flags
        const fallbackCountries = [
            { id: 'IN', name: 'India', officialName: 'Republic of India', code: 'IN', code3: 'IND', flag: '🇮🇳', region: 'Asia', subregion: 'Southern Asia' },
            { id: 'US', name: 'United States', officialName: 'United States of America', code: 'US', code3: 'USA', flag: '🇺🇸', region: 'Americas', subregion: 'North America' },
            { id: 'GB', name: 'United Kingdom', officialName: 'United Kingdom of Great Britain and Northern Ireland', code: 'GB', code3: 'GBR', flag: '🇬🇧', region: 'Europe', subregion: 'Northern Europe' },
            { id: 'CA', name: 'Canada', officialName: 'Canada', code: 'CA', code3: 'CAN', flag: '🇨🇦', region: 'Americas', subregion: 'North America' },
            { id: 'AU', name: 'Australia', officialName: 'Commonwealth of Australia', code: 'AU', code3: 'AUS', flag: '🇦🇺', region: 'Oceania', subregion: 'Australia and New Zealand' },
            { id: 'DE', name: 'Germany', officialName: 'Federal Republic of Germany', code: 'DE', code3: 'DEU', flag: '🇩🇪', region: 'Europe', subregion: 'Western Europe' },
            { id: 'FR', name: 'France', officialName: 'French Republic', code: 'FR', code3: 'FRA', flag: '🇫🇷', region: 'Europe', subregion: 'Western Europe' },
            { id: 'SG', name: 'Singapore', officialName: 'Republic of Singapore', code: 'SG', code3: 'SGP', flag: '🇸🇬', region: 'Asia', subregion: 'South-Eastern Asia' },
            { id: 'JP', name: 'Japan', officialName: 'Japan', code: 'JP', code3: 'JPN', flag: '🇯🇵', region: 'Asia', subregion: 'Eastern Asia' },
            { id: 'CN', name: 'China', officialName: 'People\'s Republic of China', code: 'CN', code3: 'CHN', flag: '🇨🇳', region: 'Asia', subregion: 'Eastern Asia' },
            { id: 'BR', name: 'Brazil', officialName: 'Federative Republic of Brazil', code: 'BR', code3: 'BRA', flag: '🇧🇷', region: 'Americas', subregion: 'South America' },
            { id: 'MX', name: 'Mexico', officialName: 'United Mexican States', code: 'MX', code3: 'MEX', flag: '🇲🇽', region: 'Americas', subregion: 'North America' },
            { id: 'NL', name: 'Netherlands', officialName: 'Kingdom of the Netherlands', code: 'NL', code3: 'NLD', flag: '🇳🇱', region: 'Europe', subregion: 'Western Europe' },
            { id: 'CH', name: 'Switzerland', officialName: 'Swiss Confederation', code: 'CH', code3: 'CHE', flag: '🇨🇭', region: 'Europe', subregion: 'Western Europe' },
            { id: 'SE', name: 'Sweden', officialName: 'Kingdom of Sweden', code: 'SE', code3: 'SWE', flag: '🇸🇪', region: 'Europe', subregion: 'Northern Europe' },
            { id: 'NO', name: 'Norway', officialName: 'Kingdom of Norway', code: 'NO', code3: 'NOR', flag: '🇳🇴', region: 'Europe', subregion: 'Northern Europe' },
            { id: 'DK', name: 'Denmark', officialName: 'Kingdom of Denmark', code: 'DK', code3: 'DNK', flag: '🇩🇰', region: 'Europe', subregion: 'Northern Europe' },
            { id: 'FI', name: 'Finland', officialName: 'Republic of Finland', code: 'FI', code3: 'FIN', flag: '🇫🇮', region: 'Europe', subregion: 'Northern Europe' },
            { id: 'IT', name: 'Italy', officialName: 'Italian Republic', code: 'IT', code3: 'ITA', flag: '🇮🇹', region: 'Europe', subregion: 'Southern Europe' },
            { id: 'ES', name: 'Spain', officialName: 'Kingdom of Spain', code: 'ES', code3: 'ESP', flag: '🇪🇸', region: 'Europe', subregion: 'Southern Europe' },
            { id: 'KR', name: 'South Korea', officialName: 'Republic of Korea', code: 'KR', code3: 'KOR', flag: '🇰🇷', region: 'Asia', subregion: 'Eastern Asia' },
            { id: 'IL', name: 'Israel', officialName: 'State of Israel', code: 'IL', code3: 'ISR', flag: '🇮🇱', region: 'Asia', subregion: 'Western Asia' },
            { id: 'AE', name: 'United Arab Emirates', officialName: 'United Arab Emirates', code: 'AE', code3: 'ARE', flag: '🇦🇪', region: 'Asia', subregion: 'Western Asia' },
            { id: 'NZ', name: 'New Zealand', officialName: 'New Zealand', code: 'NZ', code3: 'NZL', flag: '🇳🇿', region: 'Oceania', subregion: 'Australia and New Zealand' }
        ];
        
        return {
            status: 200,
            jsonBody: successResponse({
                countries: fallbackCountries,
                total: fallbackCountries.length,
                defaultCountry: 'India',
                priorityCountries: ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Singapore']
            }, 'Countries retrieved successfully (fallback data - external API unavailable)')
        };
    }
};