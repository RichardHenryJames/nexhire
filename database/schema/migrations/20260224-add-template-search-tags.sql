-- ============================================================
-- Migration: Add SearchTags column to ResumeBuilderTemplates
-- Created: 2026-02-24
-- Purpose: Enable template search by keywords/meta tags
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ResumeBuilderTemplates') AND name = 'SearchTags')
BEGIN
    ALTER TABLE ResumeBuilderTemplates ADD SearchTags NVARCHAR(500) NULL;
    PRINT 'Added SearchTags column to ResumeBuilderTemplates';
END
GO

-- Populate search tags for all templates
UPDATE ResumeBuilderTemplates SET SearchTags = 'serif traditional clean timeless centered ats-friendly single-column professional formal harvard garamond classic conservative' WHERE Slug = 'classic';
UPDATE ResumeBuilderTemplates SET SearchTags = 'sans-serif modern blue two-column sidebar skills-panel clean inter contemporary professional sleek' WHERE Slug = 'modern';
UPDATE ResumeBuilderTemplates SET SearchTags = 'minimal clean whitespace simple elegant developer minimalist dm-sans light spacious less-is-more' WHERE Slug = 'minimal';
UPDATE ResumeBuilderTemplates SET SearchTags = 'executive dark-header serif leadership corporate enterprise senior premium playfair navy formal c-suite director vp' WHERE Slug = 'executive';
UPDATE ResumeBuilderTemplates SET SearchTags = 'ats ats-friendly ats-optimized plain simple no-graphics parsable recruiter-friendly applicant-tracking arial safe compatible' WHERE Slug = 'ats-optimized';
UPDATE ResumeBuilderTemplates SET SearchTags = 'tech developer github dark-theme monospace code engineering jetbrains programmer software-engineer dark hacker terminal' WHERE Slug = 'tech';
UPDATE ResumeBuilderTemplates SET SearchTags = 'elegant teal sophisticated creative serif lora centered pill-tags polished refined classy designer' WHERE Slug = 'elegant';
UPDATE ResumeBuilderTemplates SET SearchTags = 'bold red accent-bar strong poppins creative standout vibrant energetic impactful modern dynamic' WHERE Slug = 'bold';
UPDATE ResumeBuilderTemplates SET SearchTags = 'compact dense two-column roboto small-font experienced senior lots-of-content space-efficient indigo condensed' WHERE Slug = 'compact';
UPDATE ResumeBuilderTemplates SET SearchTags = 'professional navy gold corporate premium serif crimson executive polished formal senior leadership blue-gold luxury' WHERE Slug = 'professional';

PRINT 'Search tags populated for all templates';
GO
