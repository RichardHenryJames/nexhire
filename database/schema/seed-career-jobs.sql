-- ========================================================================
-- RefOpen Career Jobs — Seed Data
-- Realistic job listings for RefOpen's own careers page
-- Focus: 0-2 yrs experience + interns, trending 2026 roles
-- ========================================================================

-- Clear existing seed data
DELETE FROM CareerApplications;
DELETE FROM CareerJobs;

-- ========================================================================
-- SOFTWARE ENGINEERING
-- ========================================================================

INSERT INTO CareerJobs (Title, Department, Location, WorkplaceType, JobType, Description, Requirements, Responsibilities, ExperienceMin, ExperienceMax, SalaryMin, SalaryMax, Currency, Skills, Status, PublishedAt) VALUES
(
  'Software Development Engineer (SDE-1)',
  'Engineering',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Full-time',
  'Join RefOpen''s core engineering team to build the future of professional referral networking. You''ll work on our React Native + Azure Functions stack, shipping features used by thousands of job seekers and referrers daily.

We''re looking for a hungry engineer who loves building products that help real people. You''ll own features end-to-end — from database schema to API to mobile/web UI.',
  '• B.Tech/B.E. in CS, IT, or related field (2024/2025 graduates preferred)
• Strong fundamentals in JavaScript/TypeScript
• Familiarity with React or React Native
• Understanding of REST APIs and SQL databases
• Knowledge of Git and agile development practices
• Bonus: Experience with Azure, Node.js, or mobile app development',
  '• Build and ship full-stack features across our React Native app and Node.js backend
• Write clean, tested, production-ready code
• Collaborate with product and design on feature specs
• Participate in code reviews and architecture discussions
• Debug and resolve production issues with a sense of urgency
• Contribute to our CI/CD pipeline and deployment processes',
  0, 2,
  600000, 1200000, 'INR',
  'JavaScript,TypeScript,React Native,Node.js,SQL,Azure,Git',
  'Published', SYSDATETIMEOFFSET()
),

(
  'Software Development Intern',
  'Engineering',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Internship',
  'A 6-month internship where you''ll work alongside our engineering team on real production features — not toy projects. Past interns have shipped features used by 10,000+ users.

This is a paid internship with a high conversion rate to full-time SDE-1 roles.',
  '• Currently pursuing B.Tech/B.E. in CS, IT, or related field (3rd/4th year)
• Basic knowledge of JavaScript, HTML, CSS
• Willingness to learn React Native and Node.js on the job
• Strong problem-solving skills (competitive programming is a plus)
• Available for minimum 6 months, starting within 30 days',
  '• Work on real features in our React Native mobile/web app
• Write APIs using Node.js and Azure Functions
• Fix bugs and improve existing codebase
• Learn from senior engineers through pair programming
• Present your work in weekly team demos',
  0, 0,
  25000, 40000, 'INR',
  'JavaScript,React,Node.js,SQL,Git',
  'Published', SYSDATETIMEOFFSET()
),

(
  'Frontend Engineer',
  'Engineering',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Full-time',
  'Own the frontend experience of RefOpen across web and mobile. We use React Native (Expo) for a unified codebase that runs on iOS, Android, and Web.

You''ll focus on building beautiful, performant, responsive UIs that work seamlessly across devices — from mobile phones to desktop browsers.',
  '• 0-2 years of experience in frontend development
• Strong proficiency in React or React Native
• Good eye for design and UI/UX details
• Experience with responsive design and CSS-in-JS
• Understanding of state management (Context API, Redux, or similar)
• Bonus: Expo, TypeScript, Figma-to-code experience',
  '• Build responsive UI components that work across mobile, tablet, and desktop
• Implement pixel-perfect designs from Figma mockups
• Optimize app performance (bundle size, render cycles, lazy loading)
• Work on accessibility and cross-browser compatibility
• Collaborate closely with designers and backend engineers',
  0, 2,
  700000, 1400000, 'INR',
  'React Native,React,TypeScript,CSS,Expo,Figma',
  'Published', SYSDATETIMEOFFSET()
),

(
  'Backend Engineer',
  'Engineering',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Full-time',
  'Build the APIs and services that power RefOpen''s referral platform. Our backend runs on Azure Functions (Node.js/TypeScript) with Azure SQL Database.

You''ll design database schemas, build REST APIs, implement background jobs, and ensure our platform scales reliably.',
  '• 0-2 years of backend development experience
• Strong in Node.js and TypeScript
• Experience with SQL databases (MSSQL, PostgreSQL, or MySQL)
• Understanding of RESTful API design principles
• Knowledge of authentication (JWT, OAuth)
• Bonus: Azure Functions, serverless architecture, queue-based systems',
  '• Design and implement RESTful APIs for our platform
• Write efficient SQL queries and design database schemas
• Build background jobs (scrapers, email notifications, data processing)
• Implement security best practices (input validation, rate limiting)
• Monitor and optimize API performance using Application Insights
• Write unit and integration tests',
  0, 2,
  700000, 1400000, 'INR',
  'Node.js,TypeScript,SQL,Azure Functions,REST APIs,JWT',
  'Published', SYSDATETIMEOFFSET()
),

-- ========================================================================
-- AI & DATA
-- ========================================================================

(
  'AI/ML Engineer',
  'AI & Data',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Full-time',
  'Work on AI-powered features that make RefOpen smart — from AI job matching and resume analysis to personalized recommendations and NLP-based search.

We use Gemini and Groq APIs for LLM-powered features, and you''ll help us build custom models for job-candidate matching.',
  '• 0-2 years in AI/ML or related field
• Strong Python skills + familiarity with ML frameworks (PyTorch, TensorFlow, or scikit-learn)
• Experience with NLP, text classification, or recommendation systems
• Understanding of LLM APIs (OpenAI, Gemini, Claude)
• B.Tech/M.Tech in CS, AI/ML, or related field
• Bonus: Experience with vector databases, RAG, or fine-tuning LLMs',
  '• Build and improve AI-powered features (job matching, resume scoring, smart search)
• Integrate LLM APIs (Gemini, Groq) for natural language processing tasks
• Design evaluation metrics and A/B tests for AI features
• Optimize prompt engineering for better accuracy and lower costs
• Analyze user behavior data to improve recommendation quality',
  0, 2,
  800000, 1600000, 'INR',
  'Python,Machine Learning,NLP,LLM,Gemini API,TensorFlow,PyTorch',
  'Published', SYSDATETIMEOFFSET()
),

(
  'Data Analyst',
  'AI & Data',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Full-time',
  'Turn data into insights that drive product decisions at RefOpen. You''ll analyze user behavior, track key metrics, build dashboards, and help the team understand what''s working and what isn''t.

This is a great role for someone who loves SQL, knows their way around Excel/Sheets, and wants to learn data engineering.',
  '• 0-1 year of experience in data analysis (freshers with strong projects welcome)
• Strong SQL skills (can write complex JOINs, CTEs, window functions)
• Proficiency in Excel/Google Sheets and data visualization
• Basic Python or R for data manipulation
• Analytical mindset with attention to detail
• Bonus: Experience with Power BI, Tableau, or Metabase',
  '• Write SQL queries to analyze user behavior, conversion funnels, and feature adoption
• Build and maintain dashboards for key business metrics
• Generate weekly/monthly reports for the leadership team
• Identify trends and anomalies in product usage data
• Support A/B testing with statistical analysis
• Collaborate with product and engineering on data-driven feature prioritization',
  0, 1,
  400000, 800000, 'INR',
  'SQL,Excel,Python,Data Visualization,Power BI,Analytics',
  'Published', SYSDATETIMEOFFSET()
),

(
  'Data Analyst Intern',
  'AI & Data',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Internship',
  'Learn data analysis on real business data. You''ll work with our data analyst to write queries, build dashboards, and present insights to the team.

Great opportunity for students who want hands-on experience with SQL and business analytics before graduating.',
  '• Currently pursuing B.Tech/BBA/MBA or related degree
• Basic SQL knowledge (SELECT, JOIN, GROUP BY)
• Comfortable with Excel/Google Sheets
• Curious about data and enjoys finding patterns
• Available for minimum 3 months',
  '• Write SQL queries to extract and analyze data
• Help build dashboards using visualization tools
• Clean and prepare data for analysis
• Assist in generating reports and presentations
• Learn data pipeline concepts and basic data engineering',
  0, 0,
  20000, 30000, 'INR',
  'SQL,Excel,Data Analysis,Google Sheets',
  'Published', SYSDATETIMEOFFSET()
),

-- ========================================================================
-- PRODUCT & DESIGN
-- ========================================================================

(
  'Product Designer (UI/UX)',
  'Product & Design',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Full-time',
  'Design intuitive, beautiful experiences for RefOpen''s mobile and web platforms. You''ll own the design system, create Figma mockups, and work directly with engineers to ship polished products.

We value designers who can think in systems, not just screens — and who obsess over micro-interactions and accessibility.',
  '• 0-2 years of product design experience
• Strong portfolio showing mobile and/or web design work
• Proficiency in Figma (components, auto-layout, prototyping)
• Understanding of design systems and component libraries
• Knowledge of mobile design patterns (iOS HIG, Material Design)
• Bonus: Basic HTML/CSS knowledge, motion design, user research experience',
  '• Design end-to-end user flows for new features (wireframes → hi-fi mockups → prototypes)
• Maintain and evolve our design system in Figma
• Conduct usability testing and iterate based on feedback
• Create responsive designs that work across mobile, tablet, and desktop
• Collaborate daily with engineers to ensure design fidelity
• Present design decisions to stakeholders with clear rationale',
  0, 2,
  600000, 1200000, 'INR',
  'Figma,UI Design,UX Design,Design Systems,Prototyping,Mobile Design',
  'Published', SYSDATETIMEOFFSET()
),

-- ========================================================================
-- MARKETING & GROWTH
-- ========================================================================

(
  'Digital Marketing Executive',
  'Marketing & Growth',
  'Bengaluru, Karnataka',
  'Hybrid',
  'Full-time',
  'Drive user acquisition and engagement for RefOpen through SEO, social media, content marketing, and performance campaigns.

You''ll experiment with channels, measure everything, and find the growth levers that work for a B2C professional networking platform.',
  '• 0-2 years in digital marketing
• Hands-on experience with at least 2 of: SEO, Google Ads, Meta Ads, LinkedIn Ads
• Good writing skills for social media and blog content
• Familiarity with analytics tools (Google Analytics, Search Console)
• Data-driven mindset — comfortable with spreadsheets and metrics
• Bonus: Experience marketing to job seekers or professionals',
  '• Plan and execute digital marketing campaigns across channels
• Manage SEO strategy (technical SEO, content optimization, link building)
• Create and schedule social media content (LinkedIn, Twitter, Instagram)
• Run and optimize paid campaigns (Google Ads, Meta)
• Track and report on key metrics (CAC, conversion rates, organic traffic)
• Write blog posts and landing page copy',
  0, 2,
  400000, 800000, 'INR',
  'SEO,Google Ads,Social Media Marketing,Content Marketing,Analytics',
  'Published', SYSDATETIMEOFFSET()
),

(
  'Content Writer Intern',
  'Marketing & Growth',
  'Remote',
  'Remote',
  'Internship',
  'Write engaging content about careers, job search tips, resume writing, and professional growth. Your content will be read by thousands of job seekers on our blog and social media.

Perfect for someone who loves writing and wants to build a portfolio in tech/career content.',
  '• Currently pursuing any degree (journalism, English, mass comm preferred but not required)
• Strong English writing skills (samples required)
• Interest in careers, job market, and professional development topics
• Basic understanding of SEO writing principles
• Active on LinkedIn or Twitter (professional context)
• Available for minimum 3 months, 20+ hours/week',
  '• Write 3-4 blog posts per week on career topics
• Create LinkedIn posts and Twitter threads for our brand accounts
• Research trending career topics and job market insights
• Optimize existing content for SEO
• Collaborate with the design team on content graphics',
  0, 0,
  15000, 20000, 'INR',
  'Content Writing,SEO,Social Media,Blogging,Research',
  'Published', SYSDATETIMEOFFSET()
),

-- ========================================================================
-- OPERATIONS & SUPPORT
-- ========================================================================

(
  'Operations Associate',
  'Operations',
  'Bengaluru, Karnataka',
  'Onsite',
  'Full-time',
  'Keep RefOpen running smoothly. You''ll handle user support, verify referrer profiles, manage payment operations, and ensure our platform quality stays high.

This role is perfect for someone who is organized, detail-oriented, and enjoys solving problems for real users.',
  '• 0-1 year of experience in operations, customer support, or similar
• Strong communication skills (written and verbal)
• Attention to detail and ability to follow processes
• Comfortable with basic data entry and spreadsheets
• Problem-solving mindset — enjoy helping people
• Bonus: Experience with support tools (Zendesk, Freshdesk) or SQL',
  '• Respond to user support tickets within SLA timelines
• Verify referrer profiles and company email verifications
• Process manual payment submissions and withdrawal requests
• Monitor platform quality metrics and flag issues
• Create and update internal process documentation
• Escalate critical issues to engineering team',
  0, 1,
  300000, 500000, 'INR',
  'Customer Support,Operations,Communication,Excel,Problem Solving',
  'Published', SYSDATETIMEOFFSET()
),

(
  'Campus Ambassador (Part-time)',
  'Marketing & Growth',
  'Multiple Cities',
  'Remote',
  'Part-time',
  'Represent RefOpen at your college campus. Spread the word about our platform, organize events, and help fellow students land referrals and jobs.

This is a part-time role — perfect for students who want marketing experience while still in college. Top ambassadors get priority for full-time roles after graduation.',
  '• Currently enrolled in any undergraduate or postgraduate program
• Active in college communities, clubs, or social media
• Strong communication and networking skills
• Self-motivated and proactive
• Access to 100+ students in your network
• Available for 10-15 hours/week for minimum 3 months',
  '• Promote RefOpen in your college through events, posters, and word-of-mouth
• Organize workshop sessions on resume building and referral strategies
• Share RefOpen content on social media and college groups
• Onboard new users and help them complete their profiles
• Provide weekly reports on campus activities and signups
• Participate in monthly ambassador meetups',
  0, 0,
  10000, 15000, 'INR',
  'Marketing,Event Management,Social Media,Networking,Communication',
  'Published', SYSDATETIMEOFFSET()
);

-- Verify
SELECT Title, Department, JobType, ExperienceMin, ExperienceMax, Location FROM CareerJobs WHERE Status = 'Published' ORDER BY Department, Title;
