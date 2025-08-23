// Test deployed APIs
console.log('?? Testing deployed NexHire APIs...');

async function testAPIs() {
    const baseURL = 'https://nexhire-api-func.azurewebsites.net/api';
    
    // Test health endpoint
    try {
        console.log('\n?? Testing Health Endpoint...');
        const healthResponse = await fetch(`${baseURL}/health`);
        console.log(`Health Status: ${healthResponse.status}`);
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('? Health Check:', healthData.message);
        }
    } catch (error) {
        console.log('?? Health endpoint still warming up');
    }
    
    // Test countries API (the main fix)
    try {
        console.log('\n?? Testing Countries API...');
        const countriesResponse = await fetch(`${baseURL}/reference/countries`);
        console.log(`Countries Status: ${countriesResponse.status}`);
        if (countriesResponse.ok) {
            const countriesData = await countriesResponse.json();
            console.log('? Countries API Working!');
            console.log(`?? Total countries: ${countriesData.data?.total || 'Unknown'}`);
            
            // Check for proper flag emojis
            if (countriesData.data?.countries) {
                const sampleCountries = countriesData.data.countries.slice(0, 5);
                console.log('\n?? Sample Countries with Flags:');
                sampleCountries.forEach(country => {
                    console.log(`${country.flag} ${country.name} (${country.code})`);
                });
            }
        }
    } catch (error) {
        console.log('? Countries API Error:', error.message);
    }
    
    // Test colleges API
    try {
        console.log('\n?? Testing Colleges API...');
        const collegesResponse = await fetch(`${baseURL}/reference/colleges?country=India`);
        console.log(`Colleges Status: ${collegesResponse.status}`);
        if (collegesResponse.ok) {
            const collegesData = await collegesResponse.json();
            console.log(`? Found ${collegesData.data?.length || 0} colleges for India`);
        }
    } catch (error) {
        console.log('?? Colleges API still warming up');
    }
}

testAPIs().then(() => {
    console.log('\n?? API Testing Complete!');
}).catch(console.error);