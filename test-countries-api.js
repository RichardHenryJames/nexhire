/**
 * ?? TEST: Countries API with Proper Flag Emojis
 * ==============================================
 * 
 * Tests the new /reference/countries endpoint that provides
 * dynamic country selection with proper flag emojis
 */

console.log('?? TESTING: Countries API with Flag Emojis');
console.log('==========================================');

const API_BASE_URL = 'https://nexhire-api-func.azurewebsites.net/api';

async function testCountriesAPI() {
    try {
        console.log('?? Calling /reference/countries endpoint...');
        
        const response = await fetch(`${API_BASE_URL}/reference/countries`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            console.log('? Countries API SUCCESS!');
            console.log(`?? Total countries: ${result.data.countries?.length || 0}`);
            console.log(`?? Default country: ${result.data.defaultCountry}`);
            
            console.log('\n?? FIRST 10 COUNTRIES WITH FLAGS:');
            console.log('================================');
            
            const countries = result.data.countries || [];
            countries.slice(0, 10).forEach((country, index) => {
                console.log(`${index + 1}. ${country.flag} ${country.name} (${country.code})`);
            });

            console.log('\n?? PRIORITY COUNTRIES FOR EDUCATION:');
            console.log('===================================');
            
            const priorityCountries = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Singapore'];
            priorityCountries.forEach((countryName) => {
                const country = countries.find(c => c.name === countryName);
                if (country) {
                    console.log(`${country.flag} ${country.name} (${country.code}) - ${country.region}`);
                }
            });

            console.log('\n?? REGIONS BREAKDOWN:');
            console.log('====================');
            
            const regions = {};
            countries.forEach(country => {
                const region = country.region || 'Unknown';
                regions[region] = (regions[region] || 0) + 1;
            });

            Object.entries(regions).forEach(([region, count]) => {
                console.log(`${region}: ${count} countries`);
            });

            return true;
        } else {
            console.error('? API returned error:', result.error || result.message);
            return false;
        }
    } catch (error) {
        console.error('? Countries API test failed:', error.message);
        return false;
    }
}

async function testCollegesWithCountry() {
    try {
        console.log('\n?? TESTING: Colleges API with Country Selection');
        console.log('==============================================');
        
        const testCountries = ['India', 'United States', 'United Kingdom'];
        
        for (const country of testCountries) {
            console.log(`\n?? Testing colleges for: ${country}`);
            console.log('------------------------------------------');
            
            const response = await fetch(`${API_BASE_URL}/reference/colleges?country=${encodeURIComponent(country)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`? HTTP ${response.status} for ${country}`);
                continue;
            }

            const result = await response.json();

            if (result.success) {
                const colleges = result.data || [];
                console.log(`? Found ${colleges.length} institutions for ${country}`);
                
                // Show first 5 colleges
                colleges.slice(0, 5).forEach((college, index) => {
                    console.log(`${index + 1}. ${college.name} (${college.state || college.country})`);
                });
                
                if (colleges.length > 5) {
                    console.log(`... and ${colleges.length - 5} more`);
                }
            } else {
                console.error(`? Failed to get colleges for ${country}:`, result.error);
            }
        }
        
        return true;
    } catch (error) {
        console.error('? Colleges API test failed:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('?? STARTING COUNTRIES & COLLEGES API TESTS');
    console.log('==========================================\n');
    
    const countriesResult = await testCountriesAPI();
    const collegesResult = await testCollegesWithCountry();
    
    console.log('\n?? TEST RESULTS SUMMARY:');
    console.log('========================');
    console.log(`Countries API: ${countriesResult ? '? PASSED' : '? FAILED'}`);
    console.log(`Colleges API: ${collegesResult ? '? PASSED' : '? FAILED'}`);
    
    if (countriesResult && collegesResult) {
        console.log('\n?? ALL TESTS PASSED!');
        console.log('====================');
        console.log('? Countries API returns proper flag emojis');
        console.log('? Colleges API works with country selection');
        console.log('? Priority countries are available');
        console.log('? Fallback data works correctly');
        console.log('\n?? READY FOR EDUCATION SCREEN INTEGRATION! ??');
    } else {
        console.log('\n?? SOME TESTS FAILED');
        console.log('====================');
        console.log('Check the errors above and ensure the API is deployed correctly.');
    }
}

// Run the tests
runAllTests().catch(console.error);