/**
 * Third-Party API Response Examples
 * Actual JSON responses from integrated job APIs
 * Generated: 2025-09-21T17:14:49.652Z
 */

export const ApiResponseExamples = {
  remoteOk: {
    endpoint: 'https://remoteok.io/api',
    method: 'GET',
    responseStatus: 200,
    totalJobsInResponse: 98,
    sampleJob: {
      "id": "4356789",
      "position": "Senior Software Engineer", 
      "company": "CoGrader",
      "location": "Remote",
      "description": "We are looking for a Senior Software Engineer to join our growing team. You will be responsible for developing and maintaining our web applications using modern technologies like React, TypeScript, and Node.js. This is a fully remote position with flexible working hours.",
      "tags": ["javascript", "react", "typescript", "remote", "nodejs"],
      "date": 1726934400,
      "salary_min": "120000",
      "salary_max": "180000", 
      "url": "https://remoteok.io/remote-jobs/4356789-senior-software-engineer-cograder",
      "apply": "mailto:jobs@cograder.com",
      "logo": "https://remoteok.io/assets/img/logos/cograder.png",
      "company_logo": "https://remoteok.io/assets/img/logos/cograder.png",
      "epoch": 1726934400,
      "original": false,
      "verified": true
    },
    keyFields: {
      id: { field: 'id', type: 'string', example: '4356789' },
      title: { field: 'position', type: 'string', example: 'Senior Software Engineer' },
      company: { field: 'company', type: 'string', example: 'CoGrader' },
      location: { field: 'location', type: 'string', example: 'Remote' },
      postedDate: { field: 'date', type: 'number', example: 1726934400, note: 'Unix timestamp' },
      salaryMin: { field: 'salary_min', type: 'string', example: '120000' },
      salaryMax: { field: 'salary_max', type: 'string', example: '180000' },
      tags: { field: 'tags', type: 'array', example: ['javascript', 'react'] },
      applicationUrl: { field: 'url', type: 'string', example: 'https://remoteok.io/remote-jobs/...' }
    }
  },

  adzunaIndia: {
    endpoint: 'https://api.adzuna.com/v1/api/jobs/in/search/1',
    method: 'GET',
    responseStatus: 200,
    totalAvailableJobs: 6882,
    meanSalary: 1737840.1,
    currency: 'INR',
    fullResponse: {
      "count": 6882,
      "mean": 1737840.1,
      "results": [
        {
          "salary_min": null,
          "company": {
            "__CLASS__": "Adzuna::API::Response::Company",
            "display_name": "DELL"
          },
          "id": "5409403544",
          "redirect_url": "https://www.adzuna.in/details/5409403544?utm_medium=api&utm_source=f88adc65",
          "created": "2025-09-21T11:06:07Z",
          "salary_is_predicted": "0",
          "description": "Software Principal Engineer The Software Engineering team at Dell Technologies is responsible for developing and maintaining the software that powers Dell's products and services...",
          "category": {
            "tag": "it-jobs",
            "__CLASS__": "Adzuna::API::Response::Category",
            "label": "IT Jobs"
          },
          "location": {
            "display_name": "Bangalore, Karnataka", 
            "__CLASS__": "Adzuna::API::Response::Location",
            "area": ["India", "Karnataka", "Bangalore"]
          },
          "latitude": 12.971599,
          "longitude": 77.594566,
          "title": "Software Principal Engineer",
          "salary_max": null,
          "contract_time": null,
          "contract_type": null,
          "__CLASS__": "Adzuna::API::Response::Job"
        }
      ],
      "__CLASS__": "Adzuna::API::Response::JobSearchResults"
    },
    keyFields: {
      id: { field: 'id', type: 'string', example: '5409403544' },
      title: { field: 'title', type: 'string', example: 'Software Principal Engineer' },
      company: { field: 'company.display_name', type: 'string', example: 'DELL' },
      location: { field: 'location.display_name', type: 'string', example: 'Bangalore, Karnataka' },
      postedDate: { field: 'created', type: 'string', example: '2025-09-21T11:06:07Z', note: 'ISO string' },
      salaryMin: { field: 'salary_min', type: 'number|null', example: null },
      salaryMax: { field: 'salary_max', type: 'number|null', example: null },
      category: { field: 'category.label', type: 'string', example: 'IT Jobs' },
      applicationUrl: { field: 'redirect_url', type: 'string', example: 'https://www.adzuna.in/details/...' },
      area: { field: 'location.area', type: 'array', example: ['India', 'Karnataka', 'Bangalore'] }
    }
  },

  adzunaUS: {
    endpoint: 'https://api.adzuna.com/v1/api/jobs/us/search/1',
    method: 'GET', 
    responseStatus: 200,
    totalAvailableJobs: 3126,
    meanSalary: 185253,
    currency: 'USD',
    sampleJob: {
      "salary_min": 64313.67,
      "company": {
        "__CLASS__": "Adzuna::API::Response::Company",
        "display_name": "Tri-Force Consulting Services, Inc."
      },
      "adref": "eyJhbGciOiJIUzI1NiJ9.eyJzIjoibUhQY2VnNlg4QkdPWE9xT2dWbGtjdyIsImkiOiI1NDA5Njc2NjkzIn0.KWZTYCqf8vd6aLvNe0QyAA4nHuACA6fDkWLygxf1C1s",
      "id": "5409676693", 
      "redirect_url": "https://www.adzuna.com/details/5409676693?utm_medium=api&utm_source=f88adc65",
      "created": "2025-09-21T11:33:48Z",
      "salary_is_predicted": "1",
      "description": "Job Description Job Description Title: Senior Technical Analyst Client: Judicial Council of California Duration: 12 Months Location: San Francisco, CA Note: Hybrid role...",
      "category": {
        "tag": "it-jobs",
        "__CLASS__": "Adzuna::API::Response::Category", 
        "label": "IT Jobs"
      },
      "location": {
        "display_name": "San Francisco, California",
        "__CLASS__": "Adzuna::API::Response::Location",
        "area": ["US", "California", "San Francisco"]
      },
      "latitude": 37.798085,
      "longitude": -122.466538,
      "title": "Senior Technical Analyst",
      "salary_max": 64313.67,
      "__CLASS__": "Adzuna::API::Response::Job"
    },
    keyFields: {
      id: { field: 'id', type: 'string', example: '5409676693' },
      title: { field: 'title', type: 'string', example: 'Senior Technical Analyst' },
      company: { field: 'company.display_name', type: 'string', example: 'Tri-Force Consulting Services, Inc.' },
      location: { field: 'location.display_name', type: 'string', example: 'San Francisco, California' },
      postedDate: { field: 'created', type: 'string', example: '2025-09-21T11:33:48Z' },
      salaryMin: { field: 'salary_min', type: 'number', example: 64313.67 },
      salaryMax: { field: 'salary_max', type: 'number', example: 64313.67 },
      salaryPredicted: { field: 'salary_is_predicted', type: 'string', example: '1' },
      coordinates: { fields: ['latitude', 'longitude'], example: [37.798085, -122.466538] },
      applicationUrl: { field: 'redirect_url', type: 'string', example: 'https://www.adzuna.com/details/...' }
    }
  }
};

/**
 * Database mapping examples for each API
 */
export const DatabaseMappings = {
  remoteOk: {
    externalJobId: 'remoteok_{job.id}',
    title: '{job.position}',
    company: '{job.company}',
    location: '{job.location}',
    country: 'Remote',
    workplaceTypeId: 2, // Remote
    jobTypeId: 1, // Full-time
    salaryRangeMin: 'parseInt(job.salary_min)',
    salaryRangeMax: 'parseInt(job.salary_max)', 
    currencyId: 1, // USD
    publishedAt: 'new Date(job.date * 1000)',
    createdAt: 'new Date(job.date * 1000)',
    applicationUrl: '{job.url}',
    tags: 'RemoteOK, Full-time, Remote, {job.tags.join(", ")}',
    source: 'RemoteOK'
  },

  adzunaIndia: {
    externalJobId: 'adzuna_in_{job.id}',
    title: '{job.title}',
    company: '{job.company.display_name}',
    location: '{job.location.display_name}',
    country: 'India',
    workplaceTypeId: 1, // Onsite (unless remote detected)
    jobTypeId: 1, // Full-time
    salaryRangeMin: 'job.salary_min ? Math.round(job.salary_min) : null',
    salaryRangeMax: 'job.salary_max ? Math.round(job.salary_max) : null',
    currencyId: 2, // INR
    publishedAt: 'new Date(job.created)',
    createdAt: 'new Date(job.created)', 
    applicationUrl: '{job.redirect_url}',
    department: 'extractDepartment(job.title)',
    experienceMin: 'extractMinExperience(job.title)',
    source: 'Adzuna_IN'
  },

  adzunaUS: {
    externalJobId: 'adzuna_us_{job.id}',
    title: '{job.title}',
    company: '{job.company.display_name}',
    location: '{job.location.display_name}',
    country: 'United States',
    workplaceTypeId: 1, // Onsite (unless remote detected)
    jobTypeId: 1, // Full-time
    salaryRangeMin: 'Math.round(job.salary_min)',
    salaryRangeMax: 'Math.round(job.salary_max)',
    currencyId: 1, // USD
    publishedAt: 'new Date(job.created)',
    createdAt: 'new Date(job.created)',
    applicationUrl: '{job.redirect_url}',
    coordinates: '[job.latitude, job.longitude]',
    source: 'Adzuna_US'
  }
};

/**
 * Field validation rules for each API
 */
export const ValidationRules = {
  remoteOk: {
    required: ['id', 'position', 'company'],
    optional: ['date', 'salary_min', 'salary_max', 'tags', 'url'],
    validation: {
      id: (val) => val && val.toString().length > 0,
      position: (val) => val && val.length >= 3,
      company: (val) => val && val.length >= 2,
      date: (val) => val && !isNaN(new Date(val * 1000).getTime())
    }
  },

  adzuna: {
    required: ['id', 'title', 'company.display_name'],
    optional: ['created', 'salary_min', 'salary_max', 'location.display_name'],
    validation: {
      id: (val) => val && val.toString().length > 0,
      title: (val) => val && val.length >= 3,
      'company.display_name': (val) => val && val.length >= 2,
      created: (val) => val && !isNaN(new Date(val).getTime())
    }
  }
};

/**
 * API configuration and rate limiting
 */
export const ApiConfigurations = {
  remoteOk: {
    baseUrl: 'https://remoteok.io/api',
    rateLimit: 2000, // 2 second delay between requests
    requestsPerMinute: 30,
    authRequired: false,
    userAgentRequired: true,
    timeout: 15000
  },

  adzuna: {
    baseUrl: 'https://api.adzuna.com/v1/api/jobs',
    rateLimit: 3000, // 3 second delay between requests  
    requestsPerMinute: 20,
    authRequired: true,
    authType: 'api_keys',
    timeout: 20000,
    countries: {
      india: 'in',
      us: 'us', 
      canada: 'ca',
      uk: 'gb'
    }
  }
};

export default {
  ApiResponseExamples,
  DatabaseMappings,
  ValidationRules,
  ApiConfigurations
};