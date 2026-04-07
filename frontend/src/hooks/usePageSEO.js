import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Sets document.title and meta description/OG tags for the current page.
 * Only works on web. No-op on native.
 * 
 * Usage:
 *   usePageSEO({
 *     title: 'Resume Analyzer - AI Resume Checker | RefOpen',
 *     description: 'Free AI-powered resume analyzer...',
 *     path: '/resume-analyzer',
 *   });
 */
export default function usePageSEO({ title, description, path, ogImage }) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Set title
    if (title) {
      document.title = title;
    }

    // Set meta description
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', description);

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', description);

      let twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', description);
    }

    // Set OG title
    if (title) {
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', title);

      let twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle) twTitle.setAttribute('content', title);
    }

    // Set canonical URL
    if (path) {
      const fullUrl = `https://refopen.com${path}`;
      let canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute('href', fullUrl);

      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute('content', fullUrl);
    }

    // Set OG image
    if (ogImage) {
      let ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) ogImg.setAttribute('content', ogImage);

      let twImg = document.querySelector('meta[name="twitter:image"]');
      if (twImg) twImg.setAttribute('content', ogImage);
    }

    // Cleanup: restore defaults when leaving the page
    return () => {
      document.title = "RefOpen - India's Leading Job & Referral Platform | Find Jobs, Get Referred, Hire Talent, Earn Rewards";
      const defaultDesc = "RefOpen - India's first all-in-one career platform. Get referred to Google, Amazon, Microsoft & 500+ top companies. AI Resume Analyzer, AI Resume Builder, Interview Prep, Salary Checker, LinkedIn Optimizer & 125K+ jobs.";
      
      let meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', defaultDesc);
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', defaultDesc);
      let canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute('href', 'https://refopen.com/');
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute('content', 'https://refopen.com/');
    };
  }, [title, description, path, ogImage]);
}
