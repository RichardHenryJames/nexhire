/**
 * Test script for Resume Analyzer AI parsing
 * Run: node scripts/test-resume-analyzer.js
 */

require('dotenv').config({ path: './local.settings.json' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || JSON.parse(require('fs').readFileSync('./local.settings.json', 'utf8')).Values?.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY || JSON.parse(require('fs').readFileSync('./local.settings.json', 'utf8')).Values?.GROQ_API_KEY;
const JINA_API_KEY = process.env.JINA_API_KEY || JSON.parse(require('fs').readFileSync('./local.settings.json', 'utf8')).Values?.JINA_API_KEY;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const JINA_READER_URL = 'https://r.jina.ai/';

async function fetchJobFromUrl(url) {
  console.log('\n📥 Fetching job from URL:', url);
  
  const headers = { 'Accept': 'text/plain' };
  if (JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
    console.log('✅ Using Jina API key (500 RPM)');
  } else {
    console.log('⚠️ No Jina API key (20 RPM limit)');
  }
  
  const response = await fetch(`${JINA_READER_URL}${encodeURIComponent(url)}`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }
  
  let content = await response.text();
  console.log('✅ Raw content length:', content.length, 'characters');
  
  // Try to extract title from content (first heading)
  let title = 'External Job';
  
  // Strategy 1: Find a line that looks like a job title followed by ===
  const jobTitlePattern = /\n((?:Senior|Junior|Lead|Staff|Principal|Associate|Mid-Level)?\s*(?:\w+\s+)?(?:Software|Backend|Frontend|Full[- ]?Stack|DevOps|Data|ML|AI|Cloud|Platform|Site Reliability|Product|Project|Program|Engineering|Design|UX|UI)?\s*(?:Engineer|Developer|Manager|Architect|Designer|Analyst|Scientist|Lead|Director|Specialist|Consultant|Administrator|Coordinator)[^\n]*)\s*\n={3,}/i;
  
  let jobContentStart = 0;
  const jobTitleMatch = content.match(jobTitlePattern);
  if (jobTitleMatch && jobTitleMatch.index !== undefined) {
    jobContentStart = jobTitleMatch.index;
    title = jobTitleMatch[1].trim();
    console.log('✅ Found job title:', title, 'at position', jobContentStart);
  } else {
    // Strategy 2: Look for "Working at" markers
    const altMarkers = [
      /\n\*\*Working at /i,
      /\n\*\*About the Role/i,
    ];
    for (const marker of altMarkers) {
      const match = content.match(marker);
      if (match && match.index !== undefined && match.index > 1000) {
        jobContentStart = Math.max(0, match.index - 300);
        console.log('⚠️ Using fallback marker at position', jobContentStart);
        break;
      }
    }
  }
  
  // Look for end markers
  const endMarkers = [
    /\n(?:Privacy Policy|Terms of Service|Copyright ©)/i,
    /\n### Join the.*(?:Talent Community|Newsletter)/i,
  ];
  
  let jobContentEnd = content.length;
  for (const marker of endMarkers) {
    const match = content.match(marker);
    if (match && match.index !== undefined && match.index > jobContentStart + 500) {
      jobContentEnd = Math.min(jobContentEnd, match.index);
      break;
    }
  }
  
  // Extract the relevant portion
  if (jobContentStart > 0 || jobContentEnd < content.length) {
    content = content.substring(jobContentStart, jobContentEnd);
    console.log('✅ Extracted content from', jobContentStart, 'to', jobContentEnd);
  }
  
  // Limit content size
  if (content.length > 8000) {
    content = content.substring(0, 8000) + '\n...[Content truncated]';
  }
  
  console.log('✅ Final content length:', content.length, 'characters');
  console.log('Title:', title);
  
  // Validate that we got meaningful job content
  const jobKeywords = ['experience', 'qualifications', 'responsibilities', 'skills', 'requirements', 'salary', 'benefits', 'team', 'role', 'position'];
  const keywordCount = jobKeywords.filter(kw => content.toLowerCase().includes(kw)).length;
  const jsonConfigRatio = (content.match(/["{}:,\[\]]/g) || []).length / content.length;
  
  console.log('Job keywords found:', keywordCount);
  console.log('JSON config ratio:', jsonConfigRatio.toFixed(2));
  
  // If content is mostly JSON/config OR has very few job keywords
  if (jsonConfigRatio > 0.15 || keywordCount < 3 || (title === 'External Job' && jobContentStart === 0)) {
    console.log('⚠️ Job extraction failed!');
    throw new Error('This job site requires the job description to be pasted manually. Please copy the job details from the website and paste them in the "Paste Text" tab.');
  }
  
  return { title, content };
}

function parseAIResponse(textResponse) {
  console.log('\n🔍 Parsing AI response...');
  console.log('Raw response length:', textResponse.length);
  console.log('First 200 chars:', textResponse.substring(0, 200));
  
  let jsonString = textResponse.trim();
  
  // Remove markdown code blocks if present (various formats)
  jsonString = jsonString.replace(/^```(?:json)?\s*/i, '');
  jsonString = jsonString.replace(/\s*```$/i, '');
  jsonString = jsonString.trim();
  
  // If still not starting with {, try to extract JSON from the text
  if (!jsonString.startsWith('{')) {
    console.log('⚠️ Response does not start with {, extracting JSON...');
    const startIdx = jsonString.indexOf('{');
    if (startIdx !== -1) {
      let braceCount = 0;
      let endIdx = startIdx;
      for (let i = startIdx; i < jsonString.length; i++) {
        if (jsonString[i] === '{') braceCount++;
        if (jsonString[i] === '}') braceCount--;
        if (braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }
      jsonString = jsonString.slice(startIdx, endIdx);
      console.log('✅ Extracted JSON from position', startIdx, 'to', endIdx);
    }
  }
  
  // Clean up common JSON issues
  jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
  jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  
  console.log('Cleaned JSON (first 300 chars):', jsonString.substring(0, 300));
  
  try {
    const analysis = JSON.parse(jsonString);
    console.log('✅ Successfully parsed JSON!');
    return {
      matchScore: Math.min(100, Math.max(0, Number(analysis.matchScore) || 0)),
      missingKeywords: Array.isArray(analysis.missingKeywords) ? analysis.missingKeywords : [],
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      tips: Array.isArray(analysis.tips) ? analysis.tips : [],
      overallAssessment: analysis.overallAssessment || 'Analysis completed.'
    };
  } catch (parseError) {
    console.error('❌ JSON Parse Error:', parseError.message);
    console.error('Failed JSON string:', jsonString.substring(0, 500));
    throw new Error('Failed to parse AI response');
  }
}

async function analyzeWithGemini(resume, jobDescription, jobTitle) {
  console.log('\n🤖 Calling Gemini API...');
  
  const prompt = `You are an expert resume analyzer and career coach. Analyze the following resume against the job description and provide a detailed assessment.

JOB TITLE: ${jobTitle || 'Not specified'}

JOB DESCRIPTION:
${jobDescription}

RESUME (anonymized):
${resume}

Provide your analysis in the following JSON format ONLY (no markdown, no code blocks, just pure JSON):
{
  "matchScore": <number between 0-100 representing how well the resume matches the job>,
  "missingKeywords": [<array of important keywords/skills from the job description that are missing in the resume>],
  "strengths": [<array of strong points where the candidate matches or exceeds requirements>],
  "tips": [<array of specific, actionable tips to improve the resume for this job>],
  "overallAssessment": "<2-3 sentence summary of the candidate's fit for this role>"
}

Be specific and constructive. Focus on:
1. Technical skills match
2. Experience relevance
3. Education alignment
4. Missing certifications or skills
5. Resume formatting/presentation issues that might hurt ATS compatibility`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    })
  });
  
  console.log('Gemini response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini error:', errorText);
    if (response.status === 429) {
      return { useGroq: true };
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('Gemini full response:', JSON.stringify(data, null, 2).substring(0, 1000));
  
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data.candidates?.[0]?.finishReason;
  console.log('Finish reason:', finishReason);
  
  if (!textResponse) {
    console.error('Empty response from Gemini:', JSON.stringify(data, null, 2));
    throw new Error('Empty response from Gemini');
  }
  
  console.log('✅ Gemini responded successfully');
  return parseAIResponse(textResponse);
}

async function analyzeWithGroq(resume, jobDescription, jobTitle) {
  console.log('\n🤖 Calling Groq API (fallback)...');
  
  const prompt = `You are an expert resume analyzer. Analyze resume vs job and respond with ONLY this JSON (no markdown):
{
  "matchScore": <0-100>,
  "missingKeywords": ["keyword1", "keyword2"],
  "strengths": ["strength1", "strength2"],
  "tips": ["tip1", "tip2"],
  "overallAssessment": "2-3 sentence summary"
}

JOB: ${jobTitle}
${jobDescription.substring(0, 4000)}

RESUME:
${resume.substring(0, 4000)}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    })
  });
  
  console.log('Groq response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq error:', errorText);
    throw new Error(`Groq API error: ${response.status}`);
  }
  
  const data = await response.json();
  const textResponse = data.choices?.[0]?.message?.content;
  
  if (!textResponse) {
    throw new Error('Empty response from Groq');
  }
  
  console.log('✅ Groq responded successfully');
  return parseAIResponse(textResponse);
}

async function main() {
  console.log('🚀 Resume Analyzer Test\n');
  console.log('Gemini API Key:', GEMINI_API_KEY ? '✅ Found' : '❌ Missing');
  console.log('Groq API Key:', GROQ_API_KEY ? '✅ Found' : '❌ Missing');
  console.log('Jina API Key:', JINA_API_KEY ? '✅ Found (500 RPM)' : '⚠️ Missing (20 RPM limit)');
  
  // Test job URL
  const jobUrl = 'https://www.atlassian.com/company/careers/details/22944';
  
  // Sample resume text
  const sampleResume = `
JOHN DOE
Senior Software Engineer
john.doe@email.com | +1-555-123-4567 | LinkedIn: /in/johndoe

SUMMARY
Experienced backend developer with 8+ years building scalable distributed systems.
Proficient in Java, Python, and cloud technologies (AWS, GCP).

EXPERIENCE
Senior Software Engineer | Tech Corp | 2020-Present
- Led migration of monolithic application to microservices architecture
- Designed and implemented RESTful APIs serving 10M+ requests/day
- Mentored team of 5 junior developers

Software Engineer | StartupXYZ | 2016-2020
- Built data pipeline processing 1TB+ daily using Apache Kafka
- Developed CI/CD pipelines using Jenkins and Docker
- Implemented PostgreSQL database optimizations

SKILLS
Java, Python, Go, AWS, GCP, Kubernetes, Docker, PostgreSQL, MongoDB, Kafka, REST APIs

EDUCATION
B.S. Computer Science | State University | 2016
  `;
  
  try {
    // Fetch job description
    const jobData = await fetchJobFromUrl(jobUrl);
    
    // Try Gemini first
    let result = await analyzeWithGemini(sampleResume, jobData.content, jobData.title);
    
    if (result.useGroq) {
      console.log('\n⚠️ Gemini rate limited, trying Groq...');
      result = await analyzeWithGroq(sampleResume, jobData.content, jobData.title);
    }
    
    console.log('\n\n========== ANALYSIS RESULT ==========');
    console.log('Match Score:', result.matchScore + '%');
    console.log('\nMissing Keywords:', result.missingKeywords.join(', '));
    console.log('\nStrengths:');
    result.strengths.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
    console.log('\nTips:');
    result.tips.forEach((t, i) => console.log(`  ${i+1}. ${t}`));
    console.log('\nOverall Assessment:', result.overallAssessment);
    console.log('======================================\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

main();
