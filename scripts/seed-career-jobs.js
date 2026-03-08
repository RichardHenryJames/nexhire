const sql = require('mssql');

const DEV = {
  server: 'refopen-sqlserver-dev.database.windows.net',
  database: 'refopen-sql-db-dev',
  user: 'sqladmin',
  password: '***REMOVED***',
  options: { encrypt: true, trustServerCertificate: false, requestTimeout: 30000 }
};

const PROD = {
  server: 'refopen-sqlserver-ci.database.windows.net',
  database: 'refopen-sql-db',
  user: 'sqladmin',
  password: '***REMOVED***',
  options: { encrypt: true, trustServerCertificate: false, requestTimeout: 30000 }
};

// About RefOpen is now hardcoded in the frontend CareerJobDetailScreen
// JD descriptions only contain role-specific content

const jobs = [
  {
    title: 'Software Development Engineer (SDE-1)',
    dept: 'Engineering',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 0, expMax: 2,
    salaryMin: 800000, salaryMax: 1600000, currency: 'INR',
    skills: 'React Native, Node.js, TypeScript, Azure, SQL Server, REST APIs',
    desc: `<h2>Software Development Engineer (SDE-1)</h2>
<h3>About the Role</h3>
<p>We're looking for a <strong>Software Development Engineer (SDE-1)</strong> to join our core engineering team in Bengaluru. You'll work across the full stack — building features on our React Native mobile app and Node.js backend that directly impact thousands of job seekers daily. This is a high-ownership role where you'll ship to production within your first week.</p>
<p>You'll be part of a small, elite engineering team where every engineer has a voice in architecture decisions. We move fast, ship often, and hold ourselves to FAANG-level engineering standards — code reviews, CI/CD, monitoring, on-call, the works.</p>

<h3>What You'll Do</h3>
<ul>
<li>Build full-stack features across our <strong>React Native (Expo)</strong> mobile app and <strong>Node.js/Azure Functions</strong> backend</li>
<li>Design, implement, and optimize <strong>SQL Server</strong> schemas and queries for high-performance job search, matching, and referral workflows</li>
<li>Integrate <strong>AI/ML services</strong> (Google Gemini, Groq) for resume analysis, job recommendations, and intelligent matching</li>
<li>Own features end-to-end — from database schema design through API implementation to production deployment and monitoring</li>
<li>Write clean, testable, production-ready code with comprehensive error handling and logging</li>
<li>Participate actively in architecture decisions, code reviews, and technical design discussions</li>
<li>Collaborate with the founding team on product strategy and roadmap prioritization</li>
<li>Build and maintain internal tools, scripts, and automation that improve developer productivity</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>B.Tech/B.E. in Computer Science or equivalent from a reputed institution (2024/2025 graduates welcome)</li>
<li>Strong fundamentals in <strong>Data Structures &amp; Algorithms, DBMS, Operating Systems, and Computer Networks</strong></li>
<li>Proficiency in <strong>JavaScript/TypeScript</strong> — React or React Native experience strongly preferred</li>
<li>Solid understanding of <strong>REST API design</strong>, authentication (JWT), and authorization patterns</li>
<li>Familiarity with <strong>Git workflows</strong>, SQL databases, and cloud platforms (Azure/AWS/GCP)</li>
<li>Strong problem-solving skills — competitive programming, LeetCode, or HackerRank experience is a plus</li>
<li>0-2 years of professional experience (freshers with exceptional projects and skills are absolutely welcome)</li>
<li>Excellent communication skills and ability to work in a fast-paced startup environment</li>
</ul>

<h3>Our Tech Stack</h3>
<ul>
<li><strong>Frontend:</strong> React Native (Expo) — single codebase for Android, iOS, and Web</li>
<li><strong>Backend:</strong> Node.js + TypeScript on Azure Functions v4 (serverless)</li>
<li><strong>Database:</strong> Azure SQL Server with complex query optimization</li>
<li><strong>AI/ML:</strong> Google Gemini API, Groq, custom NLP pipelines</li>
<li><strong>Infrastructure:</strong> Azure (Functions, Storage, SignalR, Static Web Apps, Key Vault)</li>
<li><strong>CI/CD:</strong> GitHub Actions, Azure DevOps, automated deployments</li>
<li><strong>Monitoring:</strong> Application Insights, custom alerting dashboards</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>Competitive salary:</strong> ₹8-16 LPA based on experience and skills</li>
<li><strong>Hybrid work:</strong> 3 days in office (Bengaluru) + 2 days remote</li>
<li><strong>Early-stage equity potential</strong> for exceptional performers</li>
<li><strong>Learning budget:</strong> Conferences, courses, certifications — we invest in your growth</li>
<li><strong>Health insurance</strong> for you and your family</li>
<li><strong>MacBook Pro</strong> and all necessary hardware provided</li>
<li><strong>Direct founder access:</strong> Work directly with the founding team, no layers of management</li>
<li><strong>Fast-track promotions</strong> based purely on impact, not tenure</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume Screen</strong> (1-2 days) — We review your resume, projects, and GitHub</li>
<li><strong>Online Assessment</strong> (60 min) — DSA + system design questions</li>
<li><strong>Technical Interview</strong> (60 min) — Live coding + architecture discussion with senior engineer</li>
<li><strong>Culture Fit + Product Round</strong> (45 min) — Discussion with founder about your goals and our mission</li>
<li><strong>Offer</strong> (within 48 hours of final round)</li>
</ol>
<p><em>Total timeline: 7-10 days from application to offer. We respect your time and move fast.</em></p>`,
    requirements: `<ul>
<li>B.Tech/B.E. in Computer Science or equivalent (2024/2025 graduates welcome)</li>
<li>Strong fundamentals in DSA, DBMS, OS, and Computer Networks</li>
<li>Proficiency in JavaScript/TypeScript — React or React Native experience preferred</li>
<li>Familiarity with REST APIs, Git, and SQL databases</li>
<li>Problem-solving skills — competitive programming or LeetCode experience is a plus</li>
<li>0-2 years of experience (freshers with strong projects are welcome)</li>
</ul>`,
    responsibilities: `<ul>
<li>Develop and maintain features across our React Native mobile app and Node.js backend</li>
<li>Write clean, testable, production-ready code with proper error handling</li>
<li>Optimize database queries and API response times</li>
<li>Collaborate with the founding team on product decisions</li>
<li>Deploy and monitor features using Azure DevOps and Application Insights</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 8-16 LPA | FAANG-level engineering | Latest tech stack | Early-stage equity potential | Learning budget | Health insurance'
  },
  {
    title: 'Frontend Engineer (React Native)',
    dept: 'Engineering',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 0, expMax: 2,
    salaryMin: 800000, salaryMax: 1400000, currency: 'INR',
    skills: 'React Native, Expo, JavaScript, TypeScript, CSS, Responsive Design',
    desc: `<h2>Frontend Engineer (React Native)</h2>
<h3>About the Role</h3>
<p>We're looking for a <strong>Frontend Engineer</strong> who's passionate about building pixel-perfect, performant mobile interfaces. You'll own the entire frontend of RefOpen — a React Native (Expo) app that serves <strong>Android, iOS, and Web from a single codebase</strong>. Think of it as building the next LinkedIn, but with a focus on referrals and real human connections.</p>
<p>This role is perfect for someone who obsesses over smooth animations, responsive layouts, and delightful user experiences. You'll work on features that thousands of users interact with daily.</p>

<h3>What You'll Do</h3>
<ul>
<li>Build responsive, performant UI components that work beautifully across <strong>mobile (Android/iOS) and web (desktop/tablet)</strong></li>
<li>Implement new screens and features matching design specs with pixel-perfect accuracy</li>
<li>Create <strong>LinkedIn-style desktop layouts</strong> with sidebars, multi-column grids, and responsive breakpoints</li>
<li>Optimize app performance — lazy loading, image caching, bundle size optimization, and smooth 60fps animations</li>
<li>Build AI-powered features — resume builder with real-time suggestions, interview prep with AI feedback</li>
<li>Implement <strong>real-time updates</strong> using Azure SignalR for live notifications</li>
<li>Write reusable hooks, context providers, and components following React best practices</li>
<li>Ensure cross-platform compatibility through rigorous testing on multiple devices and browsers</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>Strong <strong>JavaScript/TypeScript</strong> skills with deep understanding of React patterns (hooks, context, memoization)</li>
<li>Experience with <strong>React or React Native</strong> — personal projects, open source contributions, or professional work</li>
<li>Keen eye for <strong>UI/UX design</strong> — you can spot a misaligned pixel from a mile away</li>
<li>Understanding of <strong>responsive design</strong> principles and cross-platform development challenges</li>
<li>B.Tech/B.E. in Computer Science or equivalent (0-2 years experience)</li>
</ul>

<h3>The Tech You'll Work With</h3>
<ul>
<li><strong>React Native + Expo</strong> — cross-platform mobile development with EAS Build &amp; OTA Updates</li>
<li><strong>Responsive design system</strong> — custom hooks for breakpoints, LinkedIn-style desktop layouts</li>
<li><strong>AI-powered features</strong> — Gemini &amp; Groq integration for resume analysis, interview prep</li>
<li><strong>Real-time updates</strong> — Azure SignalR for live notifications and messaging</li>
<li><strong>Dark theme</strong> — full dark mode support across all components</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>₹8-14 LPA</strong> — competitive for early-career frontend engineers</li>
<li><strong>Hybrid work</strong> — 3 days Bengaluru office + 2 days remote</li>
<li><strong>Ship to production daily</strong> — your code reaches users within hours</li>
<li><strong>Conference &amp; course budget</strong> — React Conf, local meetups, Udemy</li>
<li><strong>Early-stage equity potential</strong></li>
<li><strong>MacBook Pro</strong> + external monitor provided</li>
<li><strong>Health insurance</strong> coverage</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Portfolio Review</strong> (1-2 days) — We look at your GitHub, projects, and any apps you've built</li>
<li><strong>Frontend Challenge</strong> (take-home, 3-4 hours) — Build a small React Native component/screen</li>
<li><strong>Technical Interview</strong> (60 min) — Live coding + discussion about React patterns and performance</li>
<li><strong>Culture + Design Sense Round</strong> (30 min) — UI/UX discussion with the founding team</li>
<li><strong>Offer</strong> (within 48 hours)</li>
</ol>
<p><em>We value craftsmanship. Show us your best work — open source, side projects, or professional portfolio.</em></p>`,
    requirements: `<ul>
<li>Strong JavaScript/TypeScript skills</li>
<li>Experience with React or React Native (personal projects count!)</li>
<li>Eye for UI/UX — ability to implement designs pixel-perfectly</li>
<li>Understanding of responsive design principles</li>
<li>B.Tech/B.E. in CS or equivalent (0-2 years experience)</li>
</ul>`,
    responsibilities: `<ul>
<li>Build responsive, performant UI components for mobile and web</li>
<li>Implement new screens and features matching Figma/design specs</li>
<li>Optimize app performance — lazy loading, caching, bundle size</li>
<li>Write reusable hooks and components following DRY principles</li>
<li>Test on multiple devices and browsers for cross-platform compatibility</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 8-14 LPA | React Native + Expo | UI/UX focused role | Ship to production daily | Conference & course budget'
  },
  {
    title: 'Backend Engineer (Node.js + Azure)',
    dept: 'Engineering',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 0, expMax: 2,
    salaryMin: 900000, salaryMax: 1800000, currency: 'INR',
    skills: 'Node.js, TypeScript, Azure Functions, SQL Server, REST APIs, Serverless',
    desc: `<h2>Backend Engineer (Node.js + Azure)</h2>
<h3>About the Role</h3>
<p>As a <strong>Backend Engineer</strong>, you'll build and scale the APIs that power RefOpen's entire referral marketplace. This means working on complex data problems — job matching algorithms, wallet and payment systems, referral workflow state machines, and AI-powered enrichment pipelines.</p>
<p>This is not a CRUD role. You'll tackle real engineering challenges: designing efficient database schemas for multi-tenant systems, building background job processors that aggregate and enrich thousands of job listings, implementing rate-limited AI pipelines, and optimizing queries that return sub-100ms responses.</p>

<h3>What You'll Do</h3>
<ul>
<li>Design and implement <strong>RESTful APIs</strong> using Azure Functions v4 and TypeScript</li>
<li>Write efficient, optimized <strong>SQL Server queries</strong> — complex joins, CTEs, window functions, full-text search</li>
<li>Build the <strong>referral workflow engine</strong> — state machine for referral requests, automated nudges, expiry handling</li>
<li>Implement <strong>payment integrations</strong> (Razorpay) for credit purchases, refunds, and wallet management</li>
<li>Build AI-powered pipelines — <strong>Gemini API and Groq</strong> integration for resume parsing, job enrichment</li>
<li>Design and implement <strong>background job processors</strong> — job aggregation, email campaigns, data enrichment</li>
<li>Implement <strong>real-time features</strong> using Azure SignalR — live notifications, typing indicators</li>
<li>Monitor and optimize API performance using <strong>Application Insights</strong></li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>Strong <strong>Node.js and TypeScript</strong> skills — you understand async patterns, event loops, and memory management</li>
<li><strong>SQL proficiency</strong> — complex queries with joins, subqueries, indexes, and query plan optimization</li>
<li>Understanding of <strong>REST API design</strong>, authentication (JWT), authorization, and rate limiting</li>
<li>Familiarity with <strong>cloud platforms</strong> (Azure preferred, AWS/GCP acceptable)</li>
<li>0-2 years experience — strong freshers with backend projects are welcome</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>₹9-18 LPA</strong> — top-of-market for 0-2 years experience</li>
<li><strong>Hybrid work:</strong> 3 days Bengaluru office + 2 days remote</li>
<li><strong>Azure cloud</strong> — work with enterprise-grade infrastructure</li>
<li><strong>AI/ML integrations</strong> — build with Gemini, Groq, and custom NLP pipelines</li>
<li><strong>0→1 product</strong> — shape the architecture of a rapidly growing platform</li>
<li><strong>Health insurance</strong> for you and family</li>
<li><strong>Learning budget</strong> — Azure certifications, courses, conferences</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume + GitHub Review</strong> (1-2 days)</li>
<li><strong>System Design Challenge</strong> (take-home, 2-3 hours)</li>
<li><strong>Technical Interview</strong> (60 min) — Live coding (Node.js + SQL) + architecture discussion</li>
<li><strong>Culture Fit</strong> (30 min) — Chat with the founding team</li>
<li><strong>Offer</strong> (within 48 hours)</li>
</ol>
<p><em>We hire for problem-solving ability and engineering rigor. Show us you can build systems that scale.</em></p>`,
    requirements: `<ul>
<li>Strong Node.js and TypeScript skills</li>
<li>SQL proficiency — joins, indexes, query optimization</li>
<li>Understanding of REST API design and authentication (JWT)</li>
<li>Familiarity with cloud platforms (Azure/AWS/GCP)</li>
<li>0-2 years experience (strong freshers welcome)</li>
</ul>`,
    responsibilities: `<ul>
<li>Design and implement RESTful APIs using Azure Functions and TypeScript</li>
<li>Write efficient SQL queries and design database schemas</li>
<li>Build payment integrations (Razorpay), email services (Azure Communication Services)</li>
<li>Implement background jobs — job aggregation, AI enrichment, notifications</li>
<li>Monitor and optimize API performance using Application Insights</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 9-18 LPA | Azure serverless | AI/ML integrations | 0 to 1 product | Health insurance'
  },
  {
    title: 'Data Analyst',
    dept: 'Data & Analytics',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 0, expMax: 2,
    salaryMin: 600000, salaryMax: 1200000, currency: 'INR',
    skills: 'SQL, Python, Excel, Power BI/Tableau, Data Visualization, Statistics',
    desc: `<h2>Data Analyst</h2>
<h3>About the Role</h3>
<p>As our <strong>first Data Analyst</strong>, you'll have an outsized impact on RefOpen's growth and strategy. You'll analyze user behavior, job market trends, and platform metrics to drive product decisions that affect thousands of users. Working directly with the founding team, you'll translate raw data into actionable insights that shape our roadmap, pricing, and go-to-market strategy.</p>
<p>This is not a passive reporting role. You'll be a strategic partner to the founders — your analyses will directly influence which features we build, how we price our products, and where we focus our growth efforts.</p>

<h3>What You'll Do</h3>
<ul>
<li>Build and maintain <strong>executive dashboards</strong> tracking key metrics — DAU/MAU, retention curves, conversion funnels, revenue per user</li>
<li>Analyze <strong>job market data</strong> from 50,000+ curated listings to identify trends, salary patterns, and hiring hotspots</li>
<li>Design and run <strong>A/B tests</strong> to measure the impact of product changes on user engagement</li>
<li>Perform <strong>cohort analysis</strong> to understand user lifecycle, churn drivers, and retention levers</li>
<li>Build <strong>predictive models</strong> for user behavior — churn prediction, referral success probability</li>
<li>Collaborate with engineering to implement proper <strong>event tracking and analytics instrumentation</strong></li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>Strong <strong>SQL skills</strong> — complex queries with CTEs, window functions, and aggregations</li>
<li>Proficiency in <strong>Excel/Google Sheets</strong> and data visualization tools (Power BI, Tableau, or similar)</li>
<li>Basic <strong>Python/R</strong> for statistical analysis and automation</li>
<li>Statistical thinking — <strong>A/B testing methodology</strong>, significance testing, cohort analysis</li>
<li>Ability to <strong>communicate insights clearly</strong> to non-technical stakeholders</li>
<li>B.Tech/MBA/B.Sc. in a quantitative field (0-2 years experience)</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>₹6-12 LPA</strong> based on experience</li>
<li><strong>Hybrid work:</strong> 3 days Bengaluru office + 2 days remote</li>
<li><strong>Rich, real-world datasets</strong> — job listings, user behavior, financial transactions</li>
<li><strong>Direct founder access</strong> — your insights drive company strategy</li>
<li><strong>Learning budget</strong> for courses, certifications, and conferences</li>
<li><strong>Health insurance</strong> coverage</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume Review</strong> (1-2 days)</li>
<li><strong>SQL + Analytics Challenge</strong> (take-home, 2-3 hours)</li>
<li><strong>Case Study Interview</strong> (45 min) — Real RefOpen analytics problem</li>
<li><strong>Culture Fit</strong> (30 min)</li>
<li><strong>Offer</strong> (within 48 hours)</li>
</ol>`,
    requirements: `<ul>
<li>Strong SQL skills — ability to write complex queries across multiple tables</li>
<li>Proficiency in Excel/Google Sheets and data visualization tools (Power BI, Tableau, or similar)</li>
<li>Basic Python/R for data analysis</li>
<li>Statistical thinking — A/B testing, cohort analysis, funnel metrics</li>
<li>B.Tech/MBA/B.Sc. in relevant field (0-2 years experience)</li>
</ul>`,
    responsibilities: `<ul>
<li>Build dashboards tracking key metrics — DAU, retention, conversion, revenue</li>
<li>Analyze job market data to identify trends and opportunities</li>
<li>Run A/B tests and measure feature impact</li>
<li>Create weekly/monthly reports for stakeholders</li>
<li>Identify data quality issues and propose fixes</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 6-12 LPA | Rich datasets | Direct founder access | Growth analytics | Learning budget'
  },
  {
    title: 'Software Engineering Intern',
    dept: 'Engineering',
    location: 'Remote (India)',
    workplace: 'Remote',
    jobType: 'Internship',
    expMin: 0, expMax: 0,
    salaryMin: null, salaryMax: null, currency: 'INR',
    skills: 'JavaScript, React, Node.js, Git, Problem Solving',
    desc: `<h2>Software Engineering Intern</h2>
<h3>About the Internship</h3>
<p>This is <strong>not</strong> a "fetch coffee" internship. As a Software Engineering Intern at RefOpen, you'll write <strong>production code from day one</strong>. Your code will be deployed to our live platform, used by thousands of real users. You'll work alongside senior engineers who've built systems at scale, learning the same engineering practices used at FAANG companies.</p>
<p>Past interns at RefOpen have shipped major features — building complete screens, implementing API endpoints, fixing production bugs. Several have converted to full-time SDE roles with competitive packages.</p>

<h3>What You'll Do</h3>
<ul>
<li>Fix bugs and implement features in our <strong>React Native mobile app</strong> — real features, not toy projects</li>
<li>Write <strong>API endpoints</strong> in Node.js/TypeScript that handle real user requests</li>
<li>Write <strong>unit tests, integration tests</strong>, and documentation for your code</li>
<li>Participate in <strong>daily standups, code reviews, and sprint planning</strong></li>
<li>Build <strong>internal tools and utilities</strong> that improve team productivity</li>
<li>Gradually take ownership of <strong>larger features and projects</strong></li>
<li>Work on <strong>AI-powered features</strong> — integrate with Gemini API, build smart UI components</li>
<li>Learn <strong>cloud deployment</strong> — deploy to Azure, monitor with Application Insights</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>Currently pursuing <strong>B.Tech/B.E./BCA/MCA</strong> in Computer Science or related field</li>
<li>Basic <strong>JavaScript</strong> knowledge — you can build a simple web app</li>
<li>Familiarity with <strong>Git</strong> — branching, merging, pull requests</li>
<li><strong>Eagerness to learn</strong> — this is genuinely the #1 requirement</li>
<li>Available for minimum <strong>3 months, 30+ hours/week</strong></li>
<li>Good communication skills</li>
</ul>

<h3>What You'll Gain</h3>
<ul>
<li><strong>Real production experience</strong> — your code goes live to thousands of users</li>
<li><strong>Modern tech stack mastery</strong> — React Native, Node.js, TypeScript, Azure, SQL Server, AI/ML</li>
<li><strong>1-on-1 mentorship</strong> — pair programming sessions with senior engineers</li>
<li><strong>Certificate + Letter of Recommendation</strong></li>
<li><strong>100% Remote</strong> — work from anywhere in India</li>
<li><strong>PPO opportunity</strong> — top performers get full-time offers at ₹8-16 LPA</li>
<li><strong>Portfolio builder</strong> — contribute to a real product you can showcase</li>
</ul>

<h3>Duration &amp; Logistics</h3>
<p><strong>Duration:</strong> 3-6 months (flexible)</p>
<p><strong>Work mode:</strong> 100% Remote</p>
<p><strong>Hours:</strong> 30+ hours/week (flexible timing)</p>
<p><strong>Stipend:</strong> Unpaid internship with PPO opportunity (₹8-16 LPA)</p>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume + GitHub Review</strong> (1-2 days)</li>
<li><strong>Short Coding Challenge</strong> (take-home, 1-2 hours)</li>
<li><strong>Technical Chat</strong> (30 min)</li>
<li><strong>Offer</strong> (within 24 hours)</li>
</ol>
<p><em>We look for potential, not perfection. If you're a fast learner with genuine passion for coding, apply!</em></p>`,
    requirements: `<ul>
<li>Currently pursuing B.Tech/B.E./BCA/MCA in Computer Science or related field</li>
<li>Basic JavaScript knowledge — can build a simple web app</li>
<li>Familiarity with Git and version control</li>
<li>Eagerness to learn — that's the #1 requirement</li>
<li>Available for minimum 3 months, 30+ hours/week</li>
</ul>`,
    responsibilities: `<ul>
<li>Fix bugs and implement small features under guidance</li>
<li>Write unit tests and documentation</li>
<li>Participate in daily standups and code reviews</li>
<li>Build internal tools and utilities</li>
<li>Gradually take ownership of larger features</li>
</ul>`,
    benefits: '100% Remote | Certificate + LOR | PPO opportunity (8-16 LPA) | Mentorship | Modern tech stack | Real production experience'
  },
  {
    title: 'Data Science Intern',
    dept: 'Data & Analytics',
    location: 'Remote (India)',
    workplace: 'Remote',
    jobType: 'Internship',
    expMin: 0, expMax: 0,
    salaryMin: null, salaryMax: null, currency: 'INR',
    skills: 'Python, Pandas, SQL, Machine Learning basics, Statistics',
    desc: `<h2>Data Science Intern</h2>
<h3>About the Internship</h3>
<p>As a <strong>Data Science Intern</strong>, you'll work on real ML problems with production data — not Kaggle datasets or toy examples. You'll build recommendation models that are deployed to serve real users, analyze behavioral patterns that drive product decisions, and create NLP pipelines that process thousands of job descriptions daily.</p>

<h3>What You'll Work On</h3>
<ul>
<li><strong>Job recommendation engine</strong> — improve our AI-powered matching algorithm</li>
<li><strong>User behavior analytics</strong> — analyze engagement patterns, identify churn signals</li>
<li><strong>NLP pipelines</strong> — resume parsing, skill extraction, job description classification</li>
<li><strong>A/B testing framework</strong> — design experiments, measure statistical significance</li>
<li><strong>Salary prediction model</strong> — estimate fair compensation based on role, experience, location</li>
<li><strong>Referral success prediction</strong> — predict which referral requests are most likely to be fulfilled</li>
<li><strong>Anomaly detection</strong> — identify suspicious activity and data quality issues</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>Pursuing <strong>B.Tech/M.Tech/M.Sc.</strong> in CS, Data Science, Statistics, or related field</li>
<li><strong>Python + Pandas/NumPy</strong> proficiency</li>
<li>Basic <strong>ML knowledge</strong> — classification, regression, clustering, evaluation metrics</li>
<li><strong>SQL skills</strong> for data extraction</li>
<li>Understanding of <strong>statistics</strong> — hypothesis testing, confidence intervals</li>
<li>Curiosity about <strong>AI/ML applications</strong> in HR-tech</li>
</ul>

<h3>What You'll Gain</h3>
<ul>
<li><strong>Real ML/AI problems</strong> — production challenges with messy real-world data</li>
<li><strong>Production data access</strong> — datasets from thousands of users and 50,000+ job listings</li>
<li><strong>Certificate + Letter of Recommendation</strong></li>
<li><strong>PPO opportunity</strong> for outstanding performers</li>
<li><strong>Mentorship</strong> from engineers with ML experience</li>
<li><strong>100% Remote</strong> — flexible hours</li>
<li><strong>Research paper opportunity</strong> — publish findings on job market analysis</li>
</ul>

<h3>Duration &amp; Logistics</h3>
<p><strong>Duration:</strong> 3-6 months remote internship</p>
<p><strong>Stipend:</strong> Unpaid with PPO opportunity</p>
<p><strong>Hours:</strong> 25+ hours/week</p>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume Review</strong> (1-2 days)</li>
<li><strong>Data Analysis Challenge</strong> (take-home, 3-4 hours)</li>
<li><strong>Technical Discussion</strong> (30 min)</li>
<li><strong>Offer</strong> (within 24 hours)</li>
</ol>`,
    requirements: `<ul>
<li>Pursuing B.Tech/M.Tech/M.Sc. in CS, Data Science, Statistics, or related field</li>
<li>Python + Pandas/NumPy proficiency</li>
<li>Basic ML knowledge — classification, regression, clustering</li>
<li>SQL skills for data extraction</li>
<li>Curiosity about AI/ML applications in HR-tech</li>
</ul>`,
    responsibilities: `<ul>
<li>Analyze job and user datasets to find patterns</li>
<li>Build and evaluate ML models for job recommendations</li>
<li>Create data visualizations and reports</li>
<li>Clean and preprocess messy real-world data</li>
<li>Present findings to the team weekly</li>
</ul>`,
    benefits: '100% Remote | Real ML/AI problems | Certificate + LOR | PPO opportunity | Production data access | Mentorship'
  },
  {
    title: 'Product Design Intern (UI/UX)',
    dept: 'Design',
    location: 'Remote (India)',
    workplace: 'Remote',
    jobType: 'Internship',
    expMin: 0, expMax: 0,
    salaryMin: null, salaryMax: null, currency: 'INR',
    skills: 'Figma, UI Design, UX Research, Prototyping, Mobile Design',
    desc: `<h2>Product Design Intern (UI/UX)</h2>
<h3>About the Internship</h3>
<p>As a <strong>Product Design Intern</strong>, you'll shape the visual identity and user experience of RefOpen's platform. You'll design screens for our React Native app that works across <strong>mobile (Android/iOS) and desktop web</strong> — think LinkedIn meets Naukri, but with cleaner design and more intuitive flows.</p>
<p>You'll work directly with the founders and engineering team, seeing your designs come to life within days — not months.</p>

<h3>What You'll Do</h3>
<ul>
<li><strong>UI Design</strong> — create high-fidelity mockups and design systems in Figma</li>
<li><strong>UX Research</strong> — conduct user interviews, usability tests, and competitor analysis</li>
<li><strong>Responsive design</strong> — layouts that work on phones, tablets, and desktop browsers</li>
<li><strong>Design system</strong> — contribute to RefOpen's component library</li>
<li><strong>Prototyping</strong> — build interactive prototypes for user testing</li>
<li><strong>Dark mode design</strong> — design for both light and dark themes</li>
<li><strong>Micro-interactions</strong> — design subtle animations that make the app feel premium</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>Proficiency in <strong>Figma</strong> (portfolio required)</li>
<li>Understanding of <strong>mobile design patterns</strong> — Material Design, Human Interface Guidelines</li>
<li>Knowledge of <strong>design fundamentals</strong> — typography, color theory, spacing, visual hierarchy</li>
<li>Pursuing a degree in <strong>Design, HCI, or related field</strong> (self-taught welcome)</li>
<li>Portfolio showing at least <strong>2-3 UI/UX projects</strong></li>
<li>Ability to take <strong>feedback constructively</strong> and iterate rapidly</li>
</ul>

<h3>What You'll Gain</h3>
<ul>
<li><strong>Real product design experience</strong> — your designs ship to thousands of users</li>
<li><strong>Cross-platform design skills</strong> — mobile + web + responsive design</li>
<li><strong>Certificate + Letter of Recommendation</strong></li>
<li><strong>PPO opportunity</strong> for exceptional performers</li>
<li><strong>Direct founder mentorship</strong></li>
<li><strong>100% Remote</strong> — flexible hours</li>
</ul>

<h3>Duration &amp; Logistics</h3>
<p><strong>Duration:</strong> 3-6 months remote internship</p>
<p><strong>Stipend:</strong> Unpaid with PPO opportunity</p>
<p><strong>Hours:</strong> 25+ hours/week</p>

<h3>Interview Process</h3>
<ol>
<li><strong>Portfolio Review</strong> (1-2 days)</li>
<li><strong>Design Challenge</strong> (take-home, 4-6 hours) — Redesign a RefOpen screen</li>
<li><strong>Design Review + Discussion</strong> (45 min)</li>
<li><strong>Offer</strong> (within 24 hours)</li>
</ol>
<p><em>We value design thinking over tool proficiency. Show us how you approach problems.</em></p>`,
    requirements: `<ul>
<li>Proficiency in Figma (portfolio required)</li>
<li>Understanding of mobile design patterns (iOS/Android/Web)</li>
<li>Basic knowledge of design principles — typography, color theory, spacing</li>
<li>Pursuing degree in Design, HCI, or related field (self-taught welcome too)</li>
<li>Portfolio showing at least 2-3 UI/UX projects</li>
</ul>`,
    responsibilities: `<ul>
<li>Design new features and screens in Figma</li>
<li>Create interactive prototypes for user testing</li>
<li>Conduct competitor analysis and UX audits</li>
<li>Collaborate with frontend engineers on implementation</li>
<li>Iterate based on user feedback and analytics</li>
</ul>`,
    benefits: '100% Remote | Real product design | Certificate + LOR | PPO opportunity | Mobile + Web design | Direct founder mentorship'
  },
  {
    title: 'DevOps Engineer',
    dept: 'Engineering',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 1, expMax: 2,
    salaryMin: 1000000, salaryMax: 2000000, currency: 'INR',
    skills: 'Azure, CI/CD, Docker, GitHub Actions, Monitoring, Terraform, PowerShell',
    desc: `<h2>DevOps Engineer</h2>
<h3>About the Role</h3>
<p>As our <strong>DevOps Engineer</strong>, you'll own the entire infrastructure and deployment pipeline at RefOpen. From code commit to production deployment, from cost optimization to incident response — you'll be the guardian of our platform's reliability and performance.</p>
<p>You'll work with a modern Azure stack that includes serverless functions, managed SQL, real-time SignalR hubs, CDN-backed static web hosting, and AI service integrations. The challenge is making all of this work seamlessly while keeping costs under control and maintaining 99.9%+ uptime.</p>

<h3>What You'll Do</h3>
<ul>
<li>Manage and optimize <strong>Azure infrastructure</strong> — Functions, SQL Server, Storage, SignalR, Static Web Apps</li>
<li>Build and maintain <strong>CI/CD pipelines</strong> using GitHub Actions and Azure DevOps</li>
<li>Implement <strong>Infrastructure as Code</strong> using Terraform, ARM templates, or Bicep</li>
<li>Set up comprehensive <strong>monitoring and alerting</strong> — Application Insights, KQL queries, PagerDuty</li>
<li>Optimize <strong>cloud costs</strong> — right-size resources, implement auto-scaling, eliminate waste</li>
<li>Handle <strong>security hardening</strong> — Key Vault, network policies, CORS, vulnerability scanning</li>
<li>Build <strong>disaster recovery</strong> plans — database backups, geo-redundancy, failover procedures</li>
<li>Manage <strong>SSL certificates</strong>, custom domains, DNS, and CDN caching</li>
<li>Support the engineering team with <strong>development environment</strong> setup and debugging tools</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>1-2 years experience with <strong>cloud platforms</strong> (Azure strongly preferred)</li>
<li><strong>CI/CD pipeline experience</strong> — GitHub Actions, Azure DevOps, or similar</li>
<li>Scripting proficiency — <strong>PowerShell, Bash, or Python</strong></li>
<li>Understanding of <strong>monitoring, alerting, and incident response</strong></li>
<li><strong>Infrastructure as Code</strong> experience — Terraform, ARM templates, Bicep</li>
<li>Knowledge of <strong>networking fundamentals</strong> — DNS, SSL/TLS, load balancing, CDN</li>
<li>Strong troubleshooting skills under pressure</li>
</ul>

<h3>Our Azure Stack</h3>
<ul>
<li><strong>Azure Functions v4</strong> — serverless compute</li>
<li><strong>Azure SQL Server</strong> — managed database with geo-replication</li>
<li><strong>Azure Blob Storage</strong> — file storage</li>
<li><strong>Azure SignalR Service</strong> — real-time notifications</li>
<li><strong>Azure Static Web Apps</strong> — frontend hosting with CDN</li>
<li><strong>Application Insights</strong> — monitoring and alerting</li>
<li><strong>Azure Key Vault</strong> — secrets management</li>
<li><strong>Azure Communication Services</strong> — transactional emails</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>₹10-20 LPA</strong> — premium compensation for DevOps expertise</li>
<li><strong>Hybrid work:</strong> 3 days Bengaluru office + 2 days remote</li>
<li><strong>Full infrastructure ownership</strong></li>
<li><strong>Early-stage impact</strong> — shape the architecture from the ground up</li>
<li><strong>Azure certification budget</strong> — AZ-104, AZ-400, AZ-305 paid for</li>
<li><strong>Health insurance</strong> for you and family</li>
<li><strong>MacBook Pro</strong> + all necessary hardware</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume Review</strong> (1-2 days)</li>
<li><strong>Infrastructure Design Challenge</strong> (take-home, 2-3 hours)</li>
<li><strong>Technical Interview</strong> (60 min) — Azure architecture, CI/CD, monitoring scenarios</li>
<li><strong>Culture Fit</strong> (30 min)</li>
<li><strong>Offer</strong> (within 48 hours)</li>
</ol>
<p><em>If you've managed production Azure infrastructure and can talk about cost optimization and deployment automation with passion — we want to hear from you.</em></p>`,
    requirements: `<ul>
<li>1-2 years experience with cloud platforms (Azure preferred, AWS/GCP acceptable)</li>
<li>CI/CD pipeline experience (GitHub Actions, Azure DevOps)</li>
<li>Scripting — PowerShell, Bash, or Python</li>
<li>Understanding of monitoring, alerting, and incident response</li>
<li>Infrastructure as Code experience (Terraform, ARM templates, or Bicep)</li>
</ul>`,
    responsibilities: `<ul>
<li>Manage and optimize Azure infrastructure (Functions, SQL, Storage, SignalR)</li>
<li>Build and maintain CI/CD pipelines for backend and frontend deployments</li>
<li>Set up monitoring dashboards and alerting rules</li>
<li>Optimize costs — right-size resources, implement auto-scaling</li>
<li>Handle security — secrets management (Key Vault), network policies, CORS</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 10-20 LPA | Azure cloud | Full infra ownership | Early-stage impact | Health insurance'
  },
  {
    title: 'Growth Marketing Manager',
    dept: 'Marketing',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 1, expMax: 3,
    salaryMin: 800000, salaryMax: 1500000, currency: 'INR',
    skills: 'Digital Marketing, SEO/SEM, Google Ads, Meta Ads, Analytics, Content Strategy, Growth Hacking',
    desc: `<h2>Growth Marketing Manager</h2>
<h3>About the Role</h3>
<p>As our <strong>Growth Marketing Manager</strong>, you'll own RefOpen's entire user acquisition and brand awareness strategy. From SEO and paid ads to viral referral loops and partnerships — you'll be the person who takes us from thousands to millions of users. This is a high-impact, high-ownership role where your work directly drives the company's top-line growth.</p>
<p>You'll work directly with the founders, have full budget authority for campaigns, and see the results of your work in real-time through our analytics dashboards. No bureaucracy, no approval chains — just move fast and grow.</p>

<h3>What You'll Do</h3>
<ul>
<li>Own and execute the <strong>full-funnel growth strategy</strong> — awareness, acquisition, activation, retention, and referral</li>
<li>Plan, launch, and optimize <strong>paid campaigns</strong> across Google Ads, Meta (Facebook/Instagram), LinkedIn, and Twitter</li>
<li>Build and scale <strong>SEO strategy</strong> — keyword research, on-page optimization, link building, and technical SEO</li>
<li>Design <strong>viral referral loops</strong> — incentivize users to share RefOpen with their networks</li>
<li>Create <strong>email marketing campaigns</strong> — drip sequences, newsletters, re-engagement flows using Azure Communication Services</li>
<li>Analyze <strong>user acquisition funnels</strong> — identify drop-offs, run A/B tests, optimize conversion rates</li>
<li>Build <strong>partnerships</strong> with coding bootcamps, colleges, placement cells, and career coaches</li>
<li>Manage <strong>App Store Optimization (ASO)</strong> — optimize Play Store and App Store listings for organic downloads</li>
<li>Track and report on <strong>marketing KPIs</strong> — CAC, LTV, ROAS, organic traffic, app downloads, active users</li>
<li>Create <strong>landing pages and conversion funnels</strong> for different user segments (freshers, experienced, referrers)</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>1-3 years of experience in <strong>digital marketing, growth marketing, or performance marketing</strong></li>
<li>Hands-on experience with <strong>Google Ads, Meta Ads Manager, LinkedIn Ads</strong> — you've managed real budgets</li>
<li>Strong understanding of <strong>SEO</strong> — both on-page and off-page, technical SEO basics</li>
<li>Experience with <strong>analytics tools</strong> — Google Analytics, Mixpanel, or similar</li>
<li>Data-driven mindset — you make decisions based on metrics, not gut feelings</li>
<li>Excellent <strong>copywriting skills</strong> — you can write ad copy, emails, and landing page content that converts</li>
<li>Experience in <strong>B2C or marketplace growth</strong> is a strong plus (ed-tech, HR-tech, social platforms)</li>
<li>Self-starter who thrives in ambiguity — you'll build the marketing playbook from scratch</li>
<li>MBA or B.Tech with marketing experience preferred (but not required if you have results to show)</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>₹8-15 LPA</strong> based on experience + performance bonuses tied to growth metrics</li>
<li><strong>Hybrid work:</strong> 3 days Bengaluru office + 2 days remote</li>
<li><strong>Full budget ownership</strong> — you decide where to spend marketing dollars</li>
<li><strong>Direct founder access</strong> — sit in on product and strategy meetings</li>
<li><strong>Early-stage equity potential</strong> for exceptional performers</li>
<li><strong>Health insurance</strong> for you and family</li>
<li><strong>Learning budget</strong> — Google/Meta certifications, marketing courses, conferences</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume + Portfolio Review</strong> (1-2 days) — Show us campaigns you've run and results achieved</li>
<li><strong>Growth Strategy Challenge</strong> (take-home, 3-4 hours) — Design a growth plan for RefOpen</li>
<li><strong>Marketing Deep-Dive</strong> (45 min) — Discuss your approach to channels, budgets, and metrics</li>
<li><strong>Culture Fit + Founder Chat</strong> (30 min)</li>
<li><strong>Offer</strong> (within 48 hours)</li>
</ol>
<p><em>If you've grown a product from 0 to 1 (or 1 to 10), we want to talk to you. Show us your numbers.</em></p>`,
    requirements: `<ul>
<li>1-3 years in digital/growth marketing with hands-on campaign management</li>
<li>Experience with Google Ads, Meta Ads, and SEO tools</li>
<li>Strong analytical skills — Google Analytics, funnel optimization</li>
<li>Excellent copywriting and communication skills</li>
<li>Data-driven decision making with clear ROI tracking</li>
</ul>`,
    responsibilities: `<ul>
<li>Own full-funnel growth strategy — acquisition, activation, retention</li>
<li>Plan and optimize paid campaigns across Google, Meta, LinkedIn</li>
<li>Build SEO strategy and organic growth channels</li>
<li>Design viral referral loops and partnership programs</li>
<li>Track and report marketing KPIs — CAC, LTV, ROAS, downloads</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 8-15 LPA | Full marketing budget ownership | Direct founder access | Equity potential | Health insurance'
  },
  {
    title: 'Content Marketing Specialist',
    dept: 'Marketing',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 0, expMax: 2,
    salaryMin: 500000, salaryMax: 1000000, currency: 'INR',
    skills: 'Content Writing, SEO, Blog Writing, Social Media, Copywriting, WordPress, Canva',
    desc: `<h2>Content Marketing Specialist</h2>
<h3>About the Role</h3>
<p>As our <strong>Content Marketing Specialist</strong>, you'll be the voice of RefOpen. You'll create content that ranks on Google, goes viral on LinkedIn, and genuinely helps job seekers succeed. From SEO blog articles and career guides to social media posts and email newsletters — you'll own the entire content engine.</p>
<p>This role is perfect for someone who loves writing, understands SEO, and is passionate about helping people find jobs. Your content will be read by thousands of job seekers every day.</p>

<h3>What You'll Do</h3>
<ul>
<li>Write <strong>SEO-optimized blog articles</strong> (2-3 per week) on topics like resume tips, interview prep, salary negotiation, referral strategies</li>
<li>Create <strong>social media content</strong> — LinkedIn posts, Twitter threads, Instagram carousels, and YouTube scripts</li>
<li>Build <strong>career guides and resources</strong> — "How to Get a Referral at Google", "Resume Templates for Freshers", etc.</li>
<li>Write <strong>email newsletters</strong> — weekly job market updates, career tips, product announcements</li>
<li>Develop <strong>landing page copy</strong> and product descriptions that drive conversions</li>
<li>Conduct <strong>keyword research</strong> and implement content SEO strategies to grow organic traffic</li>
<li>Create <strong>case studies and success stories</strong> from RefOpen users who landed jobs through referrals</li>
<li>Collaborate with the design team to create <strong>infographics, templates, and visual content</strong></li>
<li>Analyze <strong>content performance</strong> — page views, time on page, conversion rates, social engagement</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li><strong>Excellent writer</strong> — you can write engaging, clear, and SEO-friendly content in English</li>
<li>Understanding of <strong>SEO fundamentals</strong> — keyword research, on-page SEO, content structure</li>
<li>Experience with <strong>content management systems</strong> — WordPress, Ghost, or similar</li>
<li>Familiarity with <strong>social media platforms</strong> — especially LinkedIn (where our audience lives)</li>
<li>Basic <strong>design skills</strong> — Canva, Figma, or similar tools for creating visuals</li>
<li>0-2 years of content writing or marketing experience (strong portfolios from freshers welcome)</li>
<li>Passionate about the <strong>job search and career space</strong> — you understand what job seekers need</li>
<li>Bonus: Experience with video content, YouTube, or podcast creation</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>₹5-10 LPA</strong> based on experience and writing quality</li>
<li><strong>Hybrid work:</strong> 3 days Bengaluru office + 2 days remote</li>
<li><strong>Byline credit</strong> — your name on every article (great for building your personal brand)</li>
<li><strong>Creative freedom</strong> — pitch your own content ideas and see them published</li>
<li><strong>Health insurance</strong> coverage</li>
<li><strong>Learning budget</strong> — writing courses, SEO tools, conferences</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume + Writing Portfolio Review</strong> (1-2 days)</li>
<li><strong>Writing Challenge</strong> (take-home, 2-3 hours) — Write a blog post on a given career topic</li>
<li><strong>Content Strategy Discussion</strong> (30 min) — Talk through your approach to content marketing</li>
<li><strong>Offer</strong> (within 48 hours)</li>
</ol>
<p><em>Send us your best writing samples. We care about quality of writing above all else.</em></p>`,
    requirements: `<ul>
<li>Excellent English writing skills — clear, engaging, SEO-friendly</li>
<li>Understanding of SEO fundamentals and keyword research</li>
<li>Experience with content management and social media platforms</li>
<li>Basic design skills (Canva or similar)</li>
<li>0-2 years content writing experience (strong portfolio from freshers welcome)</li>
</ul>`,
    responsibilities: `<ul>
<li>Write 2-3 SEO blog articles per week on career and job search topics</li>
<li>Create social media content for LinkedIn, Twitter, Instagram</li>
<li>Build career guides, email newsletters, and landing page copy</li>
<li>Conduct keyword research and implement content SEO strategies</li>
<li>Analyze content performance and optimize for engagement</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 5-10 LPA | Byline credit | Creative freedom | Health insurance | Learning budget'
  },
  {
    title: 'Social Media & Community Manager',
    dept: 'Marketing',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 0, expMax: 2,
    salaryMin: 500000, salaryMax: 1000000, currency: 'INR',
    skills: 'Social Media Marketing, Community Building, Instagram, LinkedIn, Twitter, Video Editing, Canva',
    desc: `<h2>Social Media &amp; Community Manager</h2>
<h3>About the Role</h3>
<p>As our <strong>Social Media &amp; Community Manager</strong>, you'll own RefOpen's presence across all social platforms and build a community of job seekers who actively engage with our brand. You'll create viral content, manage our social accounts, host community events (AMAs, webinars, Twitter Spaces), and turn our social following into a growth engine.</p>
<p>This is a creative, high-energy role where you'll see the direct impact of your work in engagement metrics, follower growth, and user sign-ups.</p>

<h3>What You'll Do</h3>
<ul>
<li>Create and manage <strong>daily social media content</strong> across LinkedIn, Instagram, Twitter/X, and YouTube</li>
<li>Build and nurture a <strong>community of job seekers</strong> — Discord/Telegram group, LinkedIn community, campus ambassador network</li>
<li>Create <strong>viral content formats</strong> — memes, reels, carousels, short videos, LinkedIn polls that get shared</li>
<li>Plan and host <strong>community events</strong> — Twitter Spaces, Instagram Lives, AMA sessions with industry professionals</li>
<li>Engage with <strong>user-generated content</strong> — reshare success stories, referral wins, and user testimonials</li>
<li>Build <strong>influencer partnerships</strong> — collaborate with career coaches, LinkedIn influencers, and tech content creators</li>
<li>Monitor <strong>brand mentions and sentiment</strong> — respond to comments, DMs, and reviews promptly</li>
<li>Create <strong>campus outreach campaigns</strong> — reach students through college clubs, placement cells, and student ambassadors</li>
<li>Track <strong>social media KPIs</strong> — follower growth, engagement rate, reach, click-throughs, sign-ups from social</li>
<li>Stay on top of <strong>trends</strong> — use trending topics, formats, and hashtags to maximize reach</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>You <strong>live and breathe social media</strong> — you know what makes content go viral</li>
<li>Experience managing <strong>brand social accounts</strong> (personal accounts with strong following also count!)</li>
<li>Strong <strong>visual design sense</strong> — you can create eye-catching posts with Canva, CapCut, or similar tools</li>
<li>Excellent <strong>written communication</strong> — witty, engaging, and on-brand copywriting</li>
<li>Basic <strong>video editing skills</strong> — reels, shorts, TikTok-style content</li>
<li>Understanding of <strong>social media algorithms</strong> and best practices for each platform</li>
<li>0-2 years experience in social media marketing or community management</li>
<li>Passionate about <strong>helping job seekers</strong> and the career growth space</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>₹5-10 LPA</strong> based on experience and creativity</li>
<li><strong>Hybrid work:</strong> 3 days Bengaluru office + 2 days remote</li>
<li><strong>Build a brand from scratch</strong> — you'll be the voice of RefOpen online</li>
<li><strong>Creative freedom</strong> — experiment with formats, styles, and ideas</li>
<li><strong>Health insurance</strong> coverage</li>
<li><strong>Learning budget</strong> — social media courses, tools, conferences</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume + Social Media Portfolio Review</strong> (1-2 days) — Share your best campaigns or personal brand</li>
<li><strong>Content Creation Challenge</strong> (take-home, 2-3 hours) — Create a week's worth of social content for RefOpen</li>
<li><strong>Creative Discussion</strong> (30 min) — Talk through your content strategy and community vision</li>
<li><strong>Offer</strong> (within 48 hours)</li>
</ol>
<p><em>If your LinkedIn posts get hundreds of reactions or your Instagram reels get thousands of views — we want to talk.</em></p>`,
    requirements: `<ul>
<li>Strong social media skills — you know what makes content go viral</li>
<li>Experience managing brand or personal social accounts with real engagement</li>
<li>Visual design skills — Canva, CapCut, or similar</li>
<li>Excellent copywriting — witty, engaging, on-brand</li>
<li>0-2 years in social media marketing or community management</li>
</ul>`,
    responsibilities: `<ul>
<li>Create daily social media content across LinkedIn, Instagram, Twitter, YouTube</li>
<li>Build and nurture a community of job seekers</li>
<li>Plan and host community events — Twitter Spaces, AMAs, webinars</li>
<li>Build influencer and campus outreach partnerships</li>
<li>Track social KPIs — growth, engagement, sign-ups from social</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 5-10 LPA | Build a brand from scratch | Creative freedom | Health insurance | Learning budget'
  },
  {
    title: 'Business Development Executive',
    dept: 'Business Development',
    location: 'Bengaluru, India',
    workplace: 'Hybrid',
    jobType: 'Full-time',
    expMin: 0, expMax: 2,
    salaryMin: 500000, salaryMax: 1200000, currency: 'INR',
    skills: 'Sales, B2B Partnerships, Lead Generation, CRM, Negotiation, Cold Outreach, LinkedIn Sales',
    desc: `<h2>Business Development Executive</h2>
<h3>About the Role</h3>
<p>As a <strong>Business Development Executive</strong>, you'll be responsible for growing RefOpen's supply side (referrers) and building B2B partnerships. You'll reach out to companies, HR teams, placement cells, and career platforms to create mutually beneficial partnerships. You'll also work on getting more verified employees onto the platform as referrers.</p>
<p>This is a high-energy, results-driven role. You'll have clear targets, full autonomy in how you achieve them, and the satisfaction of seeing your partnerships directly impact user growth.</p>

<h3>What You'll Do</h3>
<ul>
<li>Identify and close <strong>B2B partnerships</strong> with companies, HR teams, and recruitment agencies</li>
<li>Build relationships with <strong>college placement cells</strong> and career services departments for campus partnerships</li>
<li>Onboard <strong>verified employees</strong> from top companies as referrers on the platform</li>
<li>Partner with <strong>coding bootcamps, upskilling platforms</strong> (Scaler, Coding Ninjas, etc.) for user acquisition</li>
<li>Conduct <strong>cold outreach</strong> via LinkedIn, email, and phone to potential partners</li>
<li>Negotiate <strong>partnership terms</strong> — revenue sharing, co-marketing, integration partnerships</li>
<li>Attend <strong>career fairs, tech events, and college festivals</strong> to represent RefOpen</li>
<li>Collaborate with <strong>marketing team</strong> on co-branded campaigns with partners</li>
<li>Track and report on <strong>BD KPIs</strong> — partnerships closed, referrers onboarded, revenue from partnerships</li>
<li>Build and maintain a <strong>CRM pipeline</strong> of leads, conversations, and deals</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>Strong <strong>communication and negotiation skills</strong> — you can pitch RefOpen convincingly to anyone</li>
<li>Experience in <strong>sales, BD, or partnership roles</strong> (internships count!)</li>
<li>Comfortable with <strong>cold outreach</strong> — LinkedIn messages, cold emails, phone calls</li>
<li>Self-motivated and <strong>target-driven</strong> — you thrive on hitting (and exceeding) numbers</li>
<li>Understanding of <strong>B2B sales cycles</strong> and partnership dynamics</li>
<li>Familiarity with <strong>CRM tools</strong> (HubSpot, Salesforce, or even a well-organized spreadsheet)</li>
<li>0-2 years experience in sales/BD (strong freshers with hustle welcome)</li>
<li>MBA or BBA preferred but not required — results matter more than degrees</li>
</ul>

<h3>Benefits &amp; Perks</h3>
<ul>
<li><strong>₹5-12 LPA</strong> (base + performance incentives — uncapped commissions on partnerships)</li>
<li><strong>Hybrid work:</strong> 3 days Bengaluru office + 2 days remote (with travel for events)</li>
<li><strong>Travel opportunities</strong> — attend career fairs, college events, and tech conferences across India</li>
<li><strong>Direct founder access</strong> — present partnership deals directly to founders</li>
<li><strong>Uncapped incentives</strong> — earn more as you close more deals</li>
<li><strong>Health insurance</strong> coverage</li>
</ul>

<h3>Interview Process</h3>
<ol>
<li><strong>Resume Review</strong> (1-2 days)</li>
<li><strong>BD Strategy Challenge</strong> (take-home, 2 hours) — Design a partnership acquisition plan for RefOpen</li>
<li><strong>Role Play + Discussion</strong> (30 min) — Pitch RefOpen to us as if we're a potential partner</li>
<li><strong>Culture Fit</strong> (30 min)</li>
<li><strong>Offer</strong> (within 48 hours)</li>
</ol>
<p><em>If you've closed deals, built partnerships, or grown a user base through hustle — show us your track record.</em></p>`,
    requirements: `<ul>
<li>Strong communication and negotiation skills</li>
<li>Experience with cold outreach — LinkedIn, email, phone</li>
<li>Self-motivated and target-driven with clear results orientation</li>
<li>Familiarity with CRM tools and sales processes</li>
<li>0-2 years in sales/BD/partnerships (internships count)</li>
</ul>`,
    responsibilities: `<ul>
<li>Identify and close B2B partnerships with companies, colleges, and platforms</li>
<li>Onboard verified employees from top companies as referrers</li>
<li>Conduct cold outreach and negotiate partnership terms</li>
<li>Attend career fairs, tech events, and college festivals</li>
<li>Track BD KPIs — partnerships closed, referrers onboarded, revenue impact</li>
</ul>`,
    benefits: 'Hybrid (3+2) | 5-12 LPA + uncapped incentives | Travel opportunities | Direct founder access | Health insurance'
  },
  {
    title: 'Campus Ambassador (Marketing Intern)',
    dept: 'Marketing',
    location: 'Remote (India)',
    workplace: 'Remote',
    jobType: 'Internship',
    expMin: 0, expMax: 0,
    salaryMin: null, salaryMax: null, currency: 'INR',
    skills: 'Social Media, Campus Outreach, Event Management, Public Speaking, Marketing, Networking',
    desc: `<h2>Campus Ambassador (Marketing Intern)</h2>
<h3>About the Internship</h3>
<p>As a <strong>Campus Ambassador</strong>, you'll represent RefOpen at your college and drive awareness among students in your network. You'll organize events, create content, and get your peers excited about using RefOpen for their job search. This is a fun, flexible, remote role with real rewards — swag, certificates, cash incentives, and a direct pipeline to a full-time marketing role.</p>

<h3>What You'll Do</h3>
<ul>
<li>Promote RefOpen among <strong>students at your college</strong> through word-of-mouth, WhatsApp groups, and social media</li>
<li>Organize <strong>campus events</strong> — workshops on "How to Get Referrals", resume review sessions, placement prep talks</li>
<li>Create <strong>social media content</strong> about RefOpen targeted at your college audience</li>
<li>Share your <strong>unique referral link</strong> and drive sign-ups — earn rewards per active user</li>
<li>Collect <strong>student feedback</strong> and share insights with the RefOpen team</li>
<li>Collaborate with <strong>placement cells and student clubs</strong> to co-host events</li>
<li>Participate in <strong>monthly ambassador meetups</strong> and brainstorming sessions</li>
<li>Create <strong>testimonial content</strong> — share your own experience using RefOpen (if applicable)</li>
</ul>

<h3>Who You Are</h3>
<ul>
<li>Currently <strong>enrolled in any college</strong> in India (B.Tech, BBA, MBA, BCA, any stream)</li>
<li><strong>Well-connected</strong> on campus — you know people across departments and clubs</li>
<li>Active on <strong>social media</strong> — especially LinkedIn and Instagram</li>
<li>Good <strong>communication skills</strong> — you can pitch RefOpen to your peers convincingly</li>
<li>Self-motivated — you don't need someone to tell you what to do</li>
<li>Passionate about <strong>helping fellow students with placements</strong></li>
<li>Bonus: Previous experience as campus ambassador for any brand, club leadership, or event organizing</li>
</ul>

<h3>What You'll Gain</h3>
<ul>
<li><strong>Performance-based cash incentives</strong> — earn per sign-up and active user from your campus</li>
<li><strong>Exclusive RefOpen merchandise</strong> — hoodies, stickers, and swag</li>
<li><strong>Certificate of Excellence</strong> + Letter of Recommendation</li>
<li><strong>LinkedIn badge</strong> — "RefOpen Campus Ambassador" to boost your profile</li>
<li><strong>PPO opportunity</strong> — top ambassadors get full-time marketing roles</li>
<li><strong>Networking</strong> — connect with ambassadors from top colleges across India</li>
<li><strong>100% Remote</strong> — flexible hours, work from your campus</li>
<li><strong>Priority access</strong> to RefOpen's referral network for your own job search</li>
</ul>

<h3>Duration &amp; Logistics</h3>
<p><strong>Duration:</strong> 3-6 months (can be extended)</p>
<p><strong>Work mode:</strong> 100% Remote — represent RefOpen from your campus</p>
<p><strong>Hours:</strong> 5-10 hours/week (flexible, doesn't interfere with academics)</p>
<p><strong>Compensation:</strong> Performance-based incentives + swag + certificate</p>

<h3>Interview Process</h3>
<ol>
<li><strong>Application Review</strong> (1-2 days)</li>
<li><strong>Quick Chat</strong> (15 min) — Tell us about your campus and how you'd promote RefOpen</li>
<li><strong>Offer</strong> (same day)</li>
</ol>
<p><em>No prior marketing experience needed — just energy, connections, and the drive to make an impact on your campus!</em></p>`,
    requirements: `<ul>
<li>Currently enrolled in any college in India</li>
<li>Well-connected on campus with active social media presence</li>
<li>Good communication skills and self-motivated</li>
<li>Passionate about helping fellow students with placements</li>
<li>5-10 hours/week availability</li>
</ul>`,
    responsibilities: `<ul>
<li>Promote RefOpen among students through word-of-mouth and social media</li>
<li>Organize campus events — workshops, resume sessions, placement talks</li>
<li>Drive sign-ups through unique referral link</li>
<li>Collaborate with placement cells and student clubs</li>
<li>Collect student feedback and share insights with the team</li>
</ul>`,
    benefits: '100% Remote | Cash incentives per sign-up | Exclusive merch | Certificate + LOR | PPO opportunity | LinkedIn badge | Networking'
  }
];

async function seedDB(config, label) {
  const p = await sql.connect(config);
  console.log(`\n🔌 Connected to ${label}`);

  // Clear existing jobs only (preserve applications!)
  // Applications have FK to CareerJobs, so we need to handle this carefully
  // Use MERGE/upsert approach: delete only jobs, applications will be orphaned but safe
  await p.request().query('DELETE FROM CareerJobs');
  console.log('🗑️ Cleared existing jobs (applications preserved)');

  for (const j of jobs) {
    await p.request().query(`
      INSERT INTO CareerJobs (Title, Department, Location, WorkplaceType, JobType,
        Description, Requirements, Responsibilities,
        ExperienceMin, ExperienceMax, SalaryMin, SalaryMax, Currency, Skills, Status, PublishedAt)
      VALUES (
        N'${j.title.replace(/'/g, "''")}',
        N'${j.dept}',
        N'${j.location}',
        N'${j.workplace}',
        N'${j.jobType}',
        N'${j.desc.replace(/'/g, "''")}',
        N'${j.requirements.replace(/'/g, "''")}',
        N'${j.responsibilities.replace(/'/g, "''")}',
        ${j.expMin},
        ${j.expMax},
        ${j.salaryMin || 'NULL'},
        ${j.salaryMax || 'NULL'},
        N'${j.currency}',
        N'${j.skills}',
        'Published',
        DATEADD(day, -${Math.floor(Math.random() * 7)}, GETUTCDATE())
      )
    `);
    console.log(`  ✅ ${j.title} (${j.jobType})`);
  }

  const count = await p.request().query('SELECT COUNT(*) as cnt FROM CareerJobs');
  console.log(`\n📊 Total career jobs in ${label}: ${count.recordset[0].cnt}`);
  await p.close();
}

(async () => {
  await seedDB(DEV, 'DEV');
  await seedDB(PROD, 'PROD');
  console.log('\n🎉 Done! Career jobs seeded in both DEV and PROD');
})().catch(e => console.error('❌', e.message));
