# RefOpen Revenue Analysis — April 6, 2026

> **Source:** Live production database (refopen-sql-db @ refopen-sqlserver-ci)
> **Test users excluded:** All accounts with phone `0000000000` + Admin account (5 wallets totalling ₹50,487 in test deposits removed)

---

## 1. Platform Overview

**RefOpen** is a referral marketplace for Indian job seekers. Users pay to request employee referrals at target companies. Verified employees earn money by referring candidates.

- **Stack:** React Native (Expo) + Azure Functions + SQL Server + Razorpay (mostly manual UPI payments currently)
- **Monetisation model:** Wallet-based. Users deposit money → spend on services → referrers earn payouts
- **Payment flow:** Primarily Manual UPI (QR scan + admin approval). Razorpay integrated but barely used (₹2 total)

---

## 2. Real Numbers (Excluding Test Users)

| Metric | Value |
|--------|-------|
| **Total Real Users** | 620 |
| **Verified Referrers** | 113 |
| **DAU / WAU / MAU** | 30 / 108 / 379 |
| **Total Real Deposits** | **₹11,087** (ManualPaymentSubmissions Approved) |
| **Total Wallet Credits from Deposits** | ₹12,465 (includes recharge bonuses) |
| **Total Service Revenue** | **₹5,783** |
| **Referrer Payouts (platform cost)** | ₹232 |
| **Bonuses Given (NEW_USER, RECHARGE, REFERRAL, ADMIN)** | ₹205,563 (mostly ₹200K admin bonus to test accounts) |
| **Withdrawals** | ₹47 |
| **Real Paying Users** | **39** out of 620 (6.3% conversion) |
| **Repeat Depositors** | 10 out of 39 (25.6% repeat rate) |
| **Avg Deposit Amount** | ₹240 (min ₹8, max ₹1,121, std dev ₹253) |
| **Platform Margin on Referrals** | ~96% (collect ₹5,635, pay out ₹232) |

---

## 3. Monthly Deposit Trend (Real Only)

| Month | Deposits | Unique Users | Avg/User |
|-------|----------|-------------|----------|
| Jan 2026 | ₹1,132 | 1 | ₹1,132 |
| **Feb 2026** | **₹4,103** | **21** | ₹195 |
| **Mar 2026** | **₹6,184** | **17** | ₹364 |
| Apr 2026 (6 days) | ₹1,046 | 4 | ₹262 |

**Trend:** Mar ARPU (₹364) is nearly **2× Feb** (₹195). Users are spending more per person over time.

### Weekly Deposit Trend

| Week | Start Date | Txns | Total | Unique Users |
|------|-----------|------|-------|-------------|
| Wk 1 | Jan 3 | 1 | ₹1,121 | 1 |
| Wk 2 | Jan 5 | 1 | ₹11 | 1 |
| Wk 6 | Feb 2 | 5 | ₹384 | 4 |
| Wk 7 | Feb 10 | 3 | ₹147 | 1 |
| Wk 8 | Feb 18 | 5 | ₹676 | 5 |
| **Wk 9** | **Feb 22** | **15** | **₹2,896** | **11** |
| Wk 10 | Mar 1 | 6 | ₹1,694 | 6 |
| Wk 11 | Mar 8 | 5 | ₹1,996 | 5 |
| Wk 12 | Mar 20 | 3 | ₹1,198 | 2 |
| Wk 13 | Mar 22 | 4 | ₹1,296 | 4 |
| Wk 14 | Apr 2 | 4 | ₹1,046 | 4 |

---

## 4. Service Revenue Breakdown

### Overall (Real Users Only)

| Service | Txns | Revenue | % of Total |
|---------|------|---------|-----------|
| **Referrals** | 48 | **₹5,635** | **97.4%** |
| AI Job Recommendations | 1 | ₹99 | 1.7% |
| Resume Template (ATS) | 1 | ₹49 | 0.8% |
| LinkedIn Optimizer | 0 | ₹0 | 0% |
| Resume Analyzer | 0 | ₹0 | 0% |
| Blind Review | 0 | ₹0 | 0% |
| Profile Views | 0 | ₹0 | 0% |
| **TOTAL** | **51** | **₹5,783** | **100%** |

> ⚠️ **Referrals = 97.4% of all real revenue.** Every other service is effectively zero from real users.

### Monthly Service Revenue

| Month | Referrals | Other | Total |
|-------|-----------|-------|-------|
| Nov 2025 | ₹150 (3 txns) | ₹0 | ₹150 |
| Dec 2025 | ₹156 (4 txns) | ₹0 | ₹156 |
| Jan 2026 | ₹702 (18 txns) | ₹0 | ₹702 |
| Feb 2026 | ₹742 (8 txns) | ₹0 | ₹742 |
| **Mar 2026** | **₹2,788** (12 txns) | ₹99 | **₹2,887** |
| Apr 2026 (6d) | ₹1,097 (3 txns) | ₹49 | **₹1,146** |

Mar was a **3.7× jump** from Feb. April is pacing at ~₹5,730/month if it holds.

---

## 5. Referral Request Funnel

### By Month

| Month | Total | Completed | Verified | Expired | Cancelled | Viewed | Refunded |
|-------|-------|-----------|----------|---------|-----------|--------|----------|
| Dec 2025 | 59 | 0 | 0 | 59 | 0 | 0 | 0 |
| Jan 2026 | 12 | 1 | 0 | 11 | 0 | 0 | 0 |
| Feb 2026 | 75 | 5 | 10 | 42 | 14 | 0 | 3 |
| Mar 2026 | 57 | 8 | 11 | 26 | 4 | 7 | 0 |
| Apr 2026 (6d) | 7 | 4 | 1 | 0 | 2 | 0 | 0 |
| **Total** | **210** | **18** | **22** | **138** | **20** | **7** | **3** |

### Key Funnel Metrics

| Metric | Value |
|--------|-------|
| Total Requests | 210 |
| Successful (Completed + Verified) | 40 (**19% success rate**) |
| Expired | 138 (**66% expiry rate — THE critical problem**) |
| Of expired, NO referrer was ever assigned | **127 / 138 (92%)** |
| Of expired, referrer assigned but didn't submit | 11 / 138 (8%) |

### Open-to-Any vs Specific Company

| Type | Requests | Successful | Success Rate |
|------|----------|-----------|-------------|
| Specific Company | 196 | 31 | **16%** |
| **Open-to-Any** | **14** | **9** | **64%** |

> Open-to-Any converts at **4× the rate** of specific-company requests, at ₹449 (9× the base price). It's massively underused.

### Top Requested Organizations

| Company | Requests | Successful | Conv Rate |
|---------|----------|-----------|----------|
| **Microsoft** | 29 | 20 | **69%** ✅ |
| Meta | 10 | 0 | 0% ❌ |
| Amazon | 5 | 0 | 0% ❌ |
| Meesho | 5 | 1 | 20% |
| JPMorgan Chase | 4 | 4 | 100% ✅ |
| Wells Fargo | 4 | 2 | 50% |
| Intuit | 3 | 0 | 0% ❌ |
| Adobe | 2 | 1 | 50% |
| Cisco | 2 | 0 | 0% ❌ |

> Microsoft + JPMorgan carry the platform. **Meta (10 requests, 0 successful) and Amazon (5, 0) are the biggest missed-revenue opportunities.**

---

## 6. User Funnel

| Stage | Count | Conversion |
|-------|-------|-----------|
| Total Real Users | 620 | — |
| Verified Referrers | 113 | 18% of users |
| Paid Users (deposited real money) | 39 | **6.3%** of users |
| Made a Referral Request | ~100+ unique | ~16% of users |
| Got a Successful Referral | ~30 unique | ~4.8% of users |

### Repeat vs One-Time Depositors

| Type | Count | % |
|------|-------|---|
| One-time depositors | 29 | 74% |
| Repeat depositors (2+ deposits) | 10 | **26%** |

---

## 7. Top 10 Real Depositors

| Name | Total Deposited | Deposits |
|------|----------------|----------|
| ramisetti sandeep | ₹1,197 | 3 |
| Anurag Tekam | ₹1,049 | 2 |
| Chirag Sharma | ₹799 | 1 |
| Amit Kumar | ₹799 | 1 |
| ruthvika ruthvika | ₹799 | 1 |
| Swarajya Bhanja | ₹448 | 2 |
| Milan Harindran | ₹399 | 1 |
| ANUPRIYA SHREE | ₹399 | 1 |
| Ritwik Ranjan Pathak | ₹399 | 1 |
| Nishanth Ravishankar | ₹399 | 1 |

---

## 8. Existing Features Already Built

### ✅ Pre-Expiry Nudge (Already Live)

The platform already has a **fully built** expiring request nudge system:

- **Trigger:** Azure Timer runs daily at 10 AM IST
- **Logic:** Finds specific-company requests expiring within 3 days that haven't been completed and haven't been nudged yet
- **Action:** Sends email + in-app notification urging user to "Go Open to Any Company"
- **Status:** **28 nudges sent** out of 210 total requests (182 were never nudged — many expired before the system was built, or were already Open-to-Any/completed)
- **File:** `src/services/expiringRequestNudgeService.ts`

> 💡 This feature exists and works. The question is whether it's effective enough — are users actually upgrading after the nudge? Could the nudge window be extended from 3 days to 5 days? Could it also send a WhatsApp/SMS in addition to email?

### ✅ Wallet Recharge Packs (Already Live)

The platform already has **5 bonus packs** in production:

| Pack | Pay | Get | Bonus | Bonus % | "Worth X Referrals" | Badge |
|------|-----|-----|-------|---------|-------------------|-------|
| Starter | ₹89 | ₹100 | ₹11 | 12% | 2 | — |
| Popular | ₹199 | ₹240 | ₹41 | 21% | 5 | Most Popular |
| **Best Value** | **₹399** | **₹500** | **₹101** | **25%** | **10** | **Best Value** |
| Power Pack | ₹799 | ₹1,100 | ₹301 | 38% | 22 | Power Pack |
| Career Booster | ₹1,499 | ₹2,200 | ₹701 | 47% | 44 | Career Booster |

The packs show "worth X referrals" to anchor value perception. These are displayed on the `ManualRechargeScreen` with animated badges, "Limited Time" urgency elements, and promo code integration.

> 💡 The pack system is well-built. The question is whether the pack tiers are optimized — the ₹399 "Best Value" pack appears to be the sweet spot based on depositor data (many deposits cluster around ₹399-799).

---

## 9. Pricing Settings (Live in Prod)

| Setting | Value |
|---------|-------|
| Referral Request (Standard) | ₹49 |
| Referral Request (Premium tier) | ₹99 |
| Referral Request (Elite / FAANG) | ₹199 |
| Open-to-Any Company | ₹449 |
| AI Job Recommendations | ₹99 (15-day access) |
| AI Resume Analysis | ₹29 (2 free uses first) |
| LinkedIn Optimizer | ₹29 (1 free use first) |
| Blind Review | ₹49 (10 free uses first) |
| Profile Views | ₹29 (7-day access) |
| Resume Builder Premium | ₹49 (7-day access) |
| Welcome Bonus | ₹0 (was ₹100 previously) |
| Referral Signup Bonus | ₹25 |
| Standard Referrer Payout | ₹25 |
| Premium Referrer Payout | ₹40 |
| Elite Referrer Payout | ₹80 |
| Minimum Withdrawal | ₹200 |

---

## 10. Critical Problems

### 🔴 Problem #1: Referrer Supply Gap = Revenue Killer

**66% of all referral requests expire**, and **92% of those expired because no referrer was ever assigned.** The demand is there — users are paying — but there's nobody on the other side to fulfill.

- Meta: 10 requests, 0 fulfilled
- Amazon: 5 requests, 0 fulfilled
- Intuit: 3 requests, 0 fulfilled
- Cisco: 2 requests, 0 fulfilled

Meanwhile Microsoft alone drives 29 requests at 69% success. **One good referrer at a company changes everything.**

### 🟡 Problem #2: Non-Referral Services Earn ₹0

Resume Analyzer, LinkedIn Optimizer, Blind Review, Profile Views — combined ₹0 from real users. These are either:
- Not being discovered (UX issue)
- Not perceived as valuable enough to pay (pricing issue)  
- Or the free tiers are too generous (10 free blind reviews, 2 free resume analyses, 1 free LinkedIn optimization)

### 🟡 Problem #3: Open-to-Any is Underused

Only 14 of 210 requests (6.7%) used Open-to-Any, despite it having a 64% success rate vs 16% for specific-company. Users default to the cheaper specific-company option and don't discover OTA until nudge email (if at all).

### 🟡 Problem #4: Manual Payment Bottleneck

100% of real revenue flows through manual UPI → admin approval. Razorpay exists but has near-zero usage. This means:
- Users have to wait for admin approval (friction)
- Admin (you) has to manually approve every payment
- Weekend/night deposits sit pending

---

## 11. Revenue Growth Ideas

### 🔴 TIER 1: Highest Impact, Do This Week

#### 1. Recruit Referrers at High-Demand Companies
- **Target:** Meta, Amazon, Intuit, Cisco. These have paying demand but 0 supply
- **Action:** Personal LinkedIn outreach. Offer first-referral bonus
- **Impact:** 1 referrer at Meta = unlock 10+ blocked requests
- **Zero code needed.** Just manual outreach
- **Status:** NOT DONE. Manual task

#### 2. Smart Open-to-Any Suggestion on Ask Referral Screen
- When user picks a specific company, show a subtle inline hint to try Open Referral
- Uses real `VerifiedReferrersCount` from Organizations table (now returned by API)
- When 0 referrers: slightly stronger wording (e.g. "Most seekers also try Open Referral")
- When 1+ referrers: softer wording (e.g. "You can also try Open Referral for extra coverage")
- Both look visually identical. No way for user to tell the difference is based on referrer count
- 6 varied messages per case, rotated by company name hash. Different company = different message
- Company name examples (Google, Microsoft, etc.) auto-exclude the selected company
- **Status:** DONE. Committed and pushed to master

#### 3. Extend Expiry Nudge Window from 3 to 5 Days
- The nudge email + in-app notification already existed (sends when request expires in <=3 days)
- Extended to 5 days so more users get nudged before expiry
- Updated in `expiringRequestNudgeService.ts` SQL query and all comments
- **Status:** DONE. Committed and pushed to master. DB change takes effect on next timer run

### 🟡 TIER 2: This Month

#### 4. Make AI Tools Free (Top-of-Funnel for Referral Revenue)
- Resume Analyzer, LinkedIn Optimizer, Blind Review earned ₹0 from real users
- Changed free usage limits from 2/1/10 to 100/100/100 in both:
  - Code defaults in `pricing.service.ts`
  - Live production database `PricingSettings` table (updated directly)
- These tools are now effectively free for all users
- Goal: more users try the tools, see their score, then click the referral CTA
- **Status:** DONE. Live in production immediately (DB updated, no deploy needed for pricing)

#### 5. Referral CTA After Resume Analyzer Results
- Added a purple gradient card after results: "Ready to land the job? Get a referral"
- Shows score-aware subtitle:
  - Score >= 70: "Your resume scored X/100. Put it to work with a direct referral"
  - Score < 70: "Improve your chances with a direct employee referral at your dream company"
- Navigates to `MainTabs > AskReferral` (same pattern as Blind Review)
- Shows on both mobile and desktop results views
- **Status:** DONE. Committed and pushed to master

#### 6. Referral CTA After LinkedIn Optimizer Results
- Same concept as Resume Analyzer: purple bordered card after results
- Score-aware subtitle:
  - Score >= 70: "Your profile scored X/100. Put it to work with a direct referral"
  - Score < 70: "Boost your chances with a direct employee referral at your dream company"
- Navigates to `MainTabs > AskReferral`
- **Status:** DONE. Committed and pushed to master

#### 7. Services Screen: FREE Badges and Try Free CTAs
- Added `free: true` property to Resume Analyzer, LinkedIn Optimizer, Blind Review
- Green "FREE" badge shows on top-right of free service cards
- CTA label changes:
  - Free services: "Try Free" (green)
  - Paid services: "Try Now" (blue)
  - Coming soon: "Coming Soon" (gray)
- **Status:** DONE. Committed and pushed to master

#### 8. Optimize Pack Pricing
- Pack system already exists with 5 tiers (₹89 to ₹1,499)
- Most deposits cluster around ₹199-399 range
- Consider: ₹49 micro-pack, time-limited bonus increases
- **Status:** NOT DONE. Needs more data on which packs convert best

#### 9. "Priority Queue" Add-on
- Offer ₹49 to move request to top of referrer queue
- **Status:** NOT DONE. Needs design + backend work

#### 10. Fix Razorpay Integration
- Only ₹2 ever processed. Manual UPI is 100% of real revenue
- **Status:** NOT DONE. Needs investigation

### 🟢 TIER 3: Next Quarter

#### 11. "Guaranteed Referral" Premium Product
- ₹999-1,999 concierge service
- **Status:** NOT DONE

#### 12. Subscription: "RefOpen Pro" ₹499/month
- **Status:** NOT DONE

#### 13. Employer-Side Revenue
- **Status:** NOT DONE

#### 14. Social Proof Marketing
- 40 successful referrals = potential testimonials
- **Status:** NOT DONE. Manual task

---

## 12. Backend Changes Made (Technical Details)

### Organizations API: Now Returns `verifiedReferrersCount`
- **File:** `src/repositories/reference.repository.ts`
- Added `ISNULL(VerifiedReferrersCount, 0) as verifiedReferrersCount` to all 3 organization query variants (Fortune500, search, default)
- Column already indexed: `IX_Organizations_VerifiedReferrersCount` + included in `IX_Organizations_Tier_Covering`
- No performance impact

### Expiry Nudge: 3 Days to 5 Days
- **File:** `src/services/expiringRequestNudgeService.ts`
- Changed `DATEADD(DAY, 3, GETUTCDATE())` to `DATEADD(DAY, 5, GETUTCDATE())`
- Timer trigger comment updated in `index.ts`

### Pricing Defaults: Free Tiers Increased
- **File:** `src/services/pricing.service.ts`
- `AI_RESUME_FREE_USES`: 2 to 100
- Added defaults for `LINKEDIN_OPTIMIZER_FREE_USES: 100`, `LINKEDIN_OPTIMIZER_COST: 29`
- Added defaults for `BLIND_REVIEW_FREE_USES: 100`, `BLIND_REVIEW_COST: 49`

### Production Database Updates (Live)
- `PricingSettings.AI_RESUME_FREE_USES` = 100
- `PricingSettings.LINKEDIN_OPTIMIZER_FREE_USES` = 100
- `PricingSettings.BLIND_REVIEW_FREE_USES` = 100

---

## 13. Frontend Changes Made (Technical Details)

### AskReferralScreen.js: Smart OTA Suggestion
- After company selection in Specific mode, shows subtle inline tip
- Reads `selectedCompany.verifiedReferrersCount` from org API
- 6 messages for 0-referrer companies, 6 for 1+ referrer companies
- Company name hash picks which message to show (deterministic per company)
- Example company names auto-exclude the selected company
- Tapping "Try" switches to Open mode via `switchMode(true)`
- Visual: small muted row with globe icon, surface background, purple "Try" link

### ResumeAnalyzerScreen.js: Referral CTA + Animation Fixes
- Purple gradient `LinearGradient` card after results section
- Score-aware subtitle (>= 70 vs < 70 threshold)
- Navigates `MainTabs > AskReferral`
- Fixed analyzing animation: steps now go green sequentially (timeout-based instead of interval)
- Fixed scan line: smooth continuous top-to-bottom-to-top sweep using `Animated.sequence`

### LinkedInOptimizerScreen.js: Referral CTA
- Purple bordered card after results section
- Score-aware subtitle
- Navigates `MainTabs > AskReferral`

### ServicesScreen.js: FREE Badges
- Added `free: true` to Resume Analyzer, LinkedIn Optimizer, Blind Review service definitions
- Green "FREE" pill badge on free service cards
- CTA: "Try Free" (green) for free, "Try Now" (blue) for paid, "Coming Soon" (gray) for locked

---

## 14. Revenue Projection

### Current Run Rate (April pace)
- Deposits: ~₹5,200/month
- Service revenue: ~₹5,700/month

### With Changes Shipped Today (Conservative)

| Change | Expected Monthly Impact |
|--------|----------------------|
| OTA suggestion (subtle push) | +₹1,500-2,500 |
| Extended nudge (5d instead of 3d) | +₹500-1,000 |
| Free AI tools with referral CTA | +₹500-1,500 |
| FREE badges driving exploration | +₹300-500 |
| **Total projected** | **₹8,000-11,400/month** (1.5-2x) |

### If Referrer Supply is Also Fixed (Meta, Amazon, etc.)

| Change | Expected Monthly Impact |
|--------|----------------------|
| All shipped changes above | +₹3,000-5,500 |
| Referrer supply at Meta/Amazon/Intuit | +₹2,000-3,000 |
| **Total projected** | **₹10,700-14,200/month** (2-2.5x) |

---

## 15. Key Takeaways

1. **The product works.** 39 real people paid real money. 40 successful referrals happened. Unit economics are strong (96% margin).

2. **Supply is the bottleneck, not demand.** 127 requests expired because no referrer existed. Fix supply at Meta/Amazon/Intuit and you unlock trapped revenue.

3. **Open-to-Any is the best product.** 64% success rate, ₹449 price, but only 6.7% of requests use it. Now being pushed subtly via the OTA suggestion on company select.

4. **Non-referral services now serve as top-of-funnel.** Made free (100 uses each) and every results screen funnels to "Get a referral" CTA. Resume Analyzer + LinkedIn Optimizer are now lead-gen tools, not revenue products.

5. **Existing systems leveraged, not rebuilt.** Expiry nudge extended (3d to 5d), recharge packs already existed, org referrer count already in DB. Just wired them up better.

6. **Manual payment remains a bottleneck.** Every deposit requires admin approval. Fixing Razorpay would remove friction and enable weekend/night revenue.

---

## Commits on `feature/revenue-optimizations` branch (merged to master)

1. `35485c9` Revenue optimizations: extend nudge 5d, free AI tools (100 uses), referral CTA on results, smart OTA suggestion
2. `a9b8fad` Fix OTA suggestion: varied messaging per company, no fake stats, honest success %
3. `777b1f3` Use real VerifiedReferrersCount for OTA suggestion: stronger push when 0 referrers, softer when referrers exist
4. `e6e6331` Subtle OTA hint: same look for 0 and >0 referrers, feels like a helpful tip not a redirect
5. `71f59c9` Remove em dashes, add 6 varied messages per case, friendlier copy
6. `2ed2562` Exclude selected company from example names in OTA suggestion
7. `99b56f9` Services screen: FREE badges, catchy hero banner, Try Free CTAs, better exploration
8. `28ccbd6` Remove hero banner from services screen, keep FREE badges and Try Free CTAs
9. `d740428` Fix: analyzing steps sequential green, scan line sweeps full doc, referral CTA uses MainTabs navigation
10. `5ae1eff` Fix: steps go green sequentially (timeout-based), scan line smooth up-down sweep

---

*Generated from live production database queries on April 6, 2026. Updated with implementation details after code changes were shipped.*
