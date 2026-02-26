import { dbService } from '../services/database.service';
import { successResponse } from '../utils/validation';

// Define interfaces for better type safety
interface University {
    name?: string;
    country?: string;
    'state-province'?: string;
    web_pages?: string[];
    domains?: string[];
    alpha_two_code?: string;
}

// Get all organizations for registration dropdown - OPTIMIZED
export const getOrganizations = async (req: any): Promise<any> => {
    try {
        const url = new URL(req.url);
        const limitParam = url.searchParams.get('limit');
        const offsetParam = url.searchParams.get('offset');
        const searchParam = url.searchParams.get('search') || '';
        const isFortune500Param = url.searchParams.get('isFortune500');
        
        // 🔥 NO DEFAULT LIMIT - Return ALL organizations if not specified
        // Frontend should specify limit for optimal performance (e.g., limit=50)
        const hasLimit = limitParam !== null;
        const limit = hasLimit ? parseInt(limitParam) : null;
        const offset = offsetParam ? parseInt(offsetParam) : 0;

        const queryParams: any[] = [];
        let paramIndex = 0;
        
        // Build optimized query based on filters
        const isFortune500Only = isFortune500Param === 'true' || isFortune500Param === '1';
        const hasSearch = searchParam && searchParam.trim().length > 0;
        
        // 🚀 OPTIMIZED QUERY: Use covering index and minimize returned columns
        let query: string;
        
        if (isFortune500Only && !hasSearch) {
            // FAST PATH: F500 only, no search - use IX_Organizations_IsFortune500 index
            query = `
                SELECT 
                    OrganizationID as id,
                    Name as name,
                    LogoURL as logoURL,
                    Industry as industry,
                    IsFortune500 as isFortune500,
                    ISNULL(Tier, 'Standard') as tier
                FROM Organizations WITH (INDEX(IX_Organizations_IsFortune500))
                WHERE IsActive = 1 AND IsFortune500 = 1 AND (IsUserCreated = 0 OR IsUserCreated IS NULL)
                ORDER BY Name ASC
            `;
        } else if (hasSearch) {
            // SEARCH PATH: Use name search with covering index
            query = `
                SELECT 
                    OrganizationID as id,
                    Name as name,
                    LogoURL as logoURL,
                    Industry as industry,
                    IsFortune500 as isFortune500,
                    ISNULL(Tier, 'Standard') as tier
                FROM Organizations
                WHERE IsActive = 1 AND (IsUserCreated = 0 OR IsUserCreated IS NULL) AND Name LIKE @param${paramIndex}
            `;
            queryParams.push(`%${searchParam}%`);
            paramIndex++;
            
            if (isFortune500Only) {
                query += ` AND IsFortune500 = 1`;
            }
            query += ` ORDER BY IsFortune500 DESC, Name ASC`;
        } else {
            // DEFAULT PATH: All orgs, use IsActive covering index
            query = `
                SELECT 
                    OrganizationID as id,
                    Name as name,
                    LogoURL as logoURL,
                    Industry as industry,
                    IsFortune500 as isFortune500,
                    ISNULL(Tier, 'Standard') as tier
                FROM Organizations
                WHERE IsActive = 1 AND (IsUserCreated = 0 OR IsUserCreated IS NULL)
                ORDER BY IsFortune500 DESC, Name ASC
            `;
        }
        
        // Add pagination only if limit is specified
        if (hasLimit && limit) {
            query += `
                OFFSET @param${paramIndex} ROWS
                FETCH NEXT @param${paramIndex + 1} ROWS ONLY
            `;
            queryParams.push(offset, limit);
        }

        // Execute query
        const result = await dbService.executeQuery(query, queryParams);
        const organizations = result.recordset || [];
        
        // 🚀 OPTIMIZATION: Skip count query if we're getting all results (no pagination)
        let totalCount: number;
        if (!hasLimit) {
            // No pagination = we already have the total
            totalCount = organizations.length;
        } else {
            // Get total count for pagination using optimized count
            let countQuery = `SELECT COUNT(*) as total FROM Organizations WHERE IsActive = 1`;
            const countParams: any[] = [];
            let countParamIndex = 0;
            
            if (hasSearch) {
                countQuery += ` AND Name LIKE @param${countParamIndex}`;
                countParams.push(`%${searchParam}%`);
                countParamIndex++;
            }
            
            if (isFortune500Only) {
                countQuery += ` AND IsFortune500 = 1`;
            }
            
            const countResult = await dbService.executeQuery(countQuery, countParams);
            totalCount = countResult.recordset[0]?.total || 0;
        }

        // Add "My company is not listed" option (only if not filtering for F500)
        if (!isFortune500Only) {
            organizations.push({
                id: 999999,
                name: 'My company is not listed',
                logoURL: null,
                industry: 'Other',
                isFortune500: false
            });
        }

        return {
            status: 200,
            jsonBody: successResponse({
                organizations: organizations,
                total: totalCount,
                offset: offset,
                limit: limit || totalCount,
                hasMore: hasLimit && limit ? (offset + limit < totalCount) : false
            }, `${organizations.length - (isFortune500Only ? 0 : 1)} organizations retrieved`)
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

// Get organization by ID with all details
export const getOrganizationById = async (req: any): Promise<any> => {
    try {
        const url = new URL(req.url);
        const pathParts = url.pathname.split('/');
        const organizationId = pathParts[pathParts.length - 1];

        if (!organizationId || organizationId === 'undefined') {
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    error: 'Organization ID is required'
                }
            };
        }

        const query = `
            SELECT 
                OrganizationID as id,
                Name as name,
                Industry as industry,
                Type as type,
                CASE 
                    WHEN Size = 'Small' THEN '1-50'
                    WHEN Size = 'Medium' THEN '51-200'
                    WHEN Size = 'Large' THEN '201-1000'
                    WHEN Size = 'Enterprise' THEN '1000+'
                    ELSE Size
                END as size,
                LogoURL as logoURL,
                Website as website,
                LinkedInProfile as linkedIn,
                Description as description,
                Headquarters as location,
                VerificationStatus as verification,
                IsFortune500 as isFortune500,
                CreatedAt as createdAt,
                UpdatedAt as updatedAt
            FROM Organizations 
            WHERE OrganizationID = @param0 AND IsActive = 1
        `;

        const result = await dbService.executeQuery(query, [organizationId]);
        
        if (!result.recordset || result.recordset.length === 0) {
            return {
                status: 404,
                jsonBody: {
                    success: false,
                    error: 'Organization not found'
                }
            };
        }

        return {
            status: 200,
            jsonBody: successResponse(
                result.recordset[0],
                'Organization details retrieved successfully'
            )
        };
    } catch (error) {
        console.error('Error getting organization by ID:', error);
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: 'Failed to retrieve organization details',
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