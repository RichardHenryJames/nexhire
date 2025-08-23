// Test Azure Functions deployment status
console.log('?? Testing Azure Functions with better error handling...');

async function testDeploymentWithDetails() {
    const baseURL = 'https://nexhire-api-func.azurewebsites.net/api';
    
    // Test health endpoint with detailed error info
    console.log('\n?? Testing Health Endpoint with details...');
    try {
        const healthResponse = await fetch(`${baseURL}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'NexHire-Test/1.0'
            }
        });
        
        console.log(`Health Status: ${healthResponse.status} ${healthResponse.statusText}`);
        console.log('Health Headers:', Object.fromEntries(healthResponse.headers.entries()));
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('? Health Check Response:', JSON.stringify(healthData, null, 2));
        } else {
            const errorText = await healthResponse.text();
            console.log('? Health Error Response:', errorText);
        }
    } catch (error) {
        console.log('? Health Network Error:', error.message);
    }
    
    // Test countries endpoint with fallback
    console.log('\n?? Testing Countries API with fallback detection...');
    try {
        const countriesResponse = await fetch(`${baseURL}/reference/countries`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'NexHire-Test/1.0'
            }
        });
        
        console.log(`Countries Status: ${countriesResponse.status} ${countriesResponse.statusText}`);
        
        if (countriesResponse.ok) {
            const countriesData = await countriesResponse.json();
            console.log('? Countries API Working!');
            
            if (countriesData.data?.countries) {
                console.log(`?? Total countries: ${countriesData.data.total}`);
                console.log('\n?? Sample Countries with Flags:');
                countriesData.data.countries.slice(0, 10).forEach(country => {
                    console.log(`${country.flag || '?'} ${country.name} (${country.code})`);
                });
                
                // Check if using fallback data
                if (countriesData.message && countriesData.message.includes('fallback')) {
                    console.log('?? Using fallback data - external API unavailable');
                } else {
                    console.log('? Using live API data');
                }
            }
        } else {
            const errorText = await countriesResponse.text();
            console.log('? Countries Error Response:', errorText);
        }
    } catch (error) {
        console.log('? Countries Network Error:', error.message);
    }
    
    // Wait and retry health check (cold start recovery)
    console.log('\n? Waiting 30 seconds for Azure Functions to warm up...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log('\n?? Retrying Health Check after warm-up...');
    try {
        const retryHealthResponse = await fetch(`${baseURL}/health`);
        console.log(`Retry Health Status: ${retryHealthResponse.status}`);
        
        if (retryHealthResponse.ok) {
            const retryHealthData = await retryHealthResponse.json();
            console.log('? Health Check After Warm-up:', retryHealthData.message);
        }
    } catch (error) {
        console.log('? Retry Health Error:', error.message);
    }
}

testDeploymentWithDetails().then(() => {
    console.log('\n?? Detailed API Testing Complete!');
}).catch(console.error);