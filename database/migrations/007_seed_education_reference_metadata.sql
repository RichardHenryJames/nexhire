-- ============================================================================
-- Migration: Seed DegreeType + FieldOfStudy reference metadata
-- Description:
--   Moves frontend hardcoded Degree Type / Field of Study options into the
--   existing ReferenceMetadata table (no new tables).
--
-- Conventions used:
--   - RefType = 'DegreeType'
--       Category     = degreeKey (e.g. 'btech')
--       Value        = display label (e.g. 'B.Tech / B.E')
--       Description  = group label (e.g. 'Engineering & Technology')
--   - RefType = 'FieldOfStudy'
--       Category     = degreeKey (e.g. 'btech')
--       Value        = field label (e.g. 'Computer Science & Engineering')
--
-- Date: 2025-12-17
-- ============================================================================

IF OBJECT_ID('ReferenceMetadata') IS NULL
BEGIN
    PRINT '❌ ReferenceMetadata table not found. Skipping education metadata seed.';
    RETURN;
END
GO

DECLARE @now DATETIME2 = SYSDATETIME();

DECLARE @data TABLE (
    RefType NVARCHAR(50) NOT NULL,
    Value NVARCHAR(200) NOT NULL,
    Category NVARCHAR(100) NULL,
    Description NVARCHAR(400) NULL
);

-- ---------------------------------------------------------------------------
-- Degree Types
-- ---------------------------------------------------------------------------
INSERT INTO @data (RefType, Value, Category, Description) VALUES
('DegreeType', 'B.Tech / B.E', 'btech', 'Engineering & Technology'),
('DegreeType', 'M.Tech / M.E', 'mtech', 'Engineering & Technology'),
('DegreeType', 'Diploma (Engineering)', 'diploma_eng', 'Engineering & Technology'),

('DegreeType', 'MBBS', 'mbbs', 'Medical & Health Sciences'),
('DegreeType', 'BDS', 'bds', 'Medical & Health Sciences'),
('DegreeType', 'BAMS', 'bams', 'Medical & Health Sciences'),
('DegreeType', 'BHMS', 'bhms', 'Medical & Health Sciences'),
('DegreeType', 'BPT', 'bpt', 'Medical & Health Sciences'),
('DegreeType', 'MD/MS', 'md', 'Medical & Health Sciences'),
('DegreeType', 'B.Sc Nursing', 'nursing', 'Medical & Health Sciences'),

('DegreeType', 'BBA', 'bba', 'Business & Economics'),
('DegreeType', 'B.Com', 'bcom', 'Business & Economics'),
('DegreeType', 'MBA', 'mba', 'Business & Economics'),
('DegreeType', 'M.Com', 'mcom', 'Business & Economics'),

('DegreeType', 'B.A', 'ba', 'Arts & Sciences'),
('DegreeType', 'B.Sc', 'bsc', 'Arts & Sciences'),
('DegreeType', 'M.A', 'ma', 'Arts & Sciences'),
('DegreeType', 'M.Sc', 'msc', 'Arts & Sciences'),

('DegreeType', 'LLB', 'llb', 'Law & Public Policy'),
('DegreeType', 'LLM', 'llm', 'Law & Public Policy'),
('DegreeType', 'JD (US)', 'jd', 'Law & Public Policy'),

('DegreeType', 'B.Arch', 'barch', 'Architecture & Design'),
('DegreeType', 'B.Des', 'bdes', 'Architecture & Design'),
('DegreeType', 'M.Arch', 'march', 'Architecture & Design'),
('DegreeType', 'M.Des', 'mdes', 'Architecture & Design'),

('DegreeType', 'B.Sc Agriculture', 'bsc_agri', 'Agriculture & Veterinary'),
('DegreeType', 'BVSc', 'bvsc', 'Agriculture & Veterinary'),
('DegreeType', 'M.Sc Agriculture', 'msc_agri', 'Agriculture & Veterinary'),

('DegreeType', 'BHM', 'bhm', 'Hospitality & Tourism'),
('DegreeType', 'BTTM', 'bttm', 'Hospitality & Tourism'),
('DegreeType', 'Aviation', 'aviation', 'Hospitality & Tourism'),

('DegreeType', 'BFA', 'bfa', 'Performing & Fine Arts'),
('DegreeType', 'Music', 'music', 'Performing & Fine Arts'),
('DegreeType', 'Dance', 'dance', 'Performing & Fine Arts'),

('DegreeType', 'PhD/Doctorate', 'phd', 'Research'),

('DegreeType', 'Certificate Program', 'certificate', 'Others'),
('DegreeType', 'Diploma', 'diploma', 'Others'),
('DegreeType', 'Other', 'other', 'Others');

-- ---------------------------------------------------------------------------
-- Fields of Study (mapped by degreeKey in Category)
-- ---------------------------------------------------------------------------
INSERT INTO @data (RefType, Value, Category, Description) VALUES
-- btech
('FieldOfStudy', 'Computer Science & Engineering', 'btech', NULL),
('FieldOfStudy', 'Information Technology', 'btech', NULL),
('FieldOfStudy', 'Electronics & Communication Engineering', 'btech', NULL),
('FieldOfStudy', 'Electrical Engineering', 'btech', NULL),
('FieldOfStudy', 'Mechanical Engineering', 'btech', NULL),
('FieldOfStudy', 'Civil Engineering', 'btech', NULL),
('FieldOfStudy', 'Chemical Engineering', 'btech', NULL),
('FieldOfStudy', 'Metallurgical Engineering', 'btech', NULL),
('FieldOfStudy', 'Petroleum Engineering', 'btech', NULL),
('FieldOfStudy', 'Mining Engineering', 'btech', NULL),
('FieldOfStudy', 'Textile Engineering', 'btech', NULL),
('FieldOfStudy', 'Aerospace Engineering', 'btech', NULL),
('FieldOfStudy', 'Agricultural Engineering', 'btech', NULL),
('FieldOfStudy', 'Marine Engineering', 'btech', NULL),
('FieldOfStudy', 'Naval Architecture', 'btech', NULL),
('FieldOfStudy', 'Robotics Engineering', 'btech', NULL),
('FieldOfStudy', 'Artificial Intelligence', 'btech', NULL),
('FieldOfStudy', 'Data Science', 'btech', NULL),
('FieldOfStudy', 'Cybersecurity', 'btech', NULL),
('FieldOfStudy', 'Internet of Things (IoT)', 'btech', NULL),
('FieldOfStudy', 'Nanotechnology', 'btech', NULL),
('FieldOfStudy', 'Environmental Engineering', 'btech', NULL),
('FieldOfStudy', 'Structural Engineering', 'btech', NULL),
('FieldOfStudy', 'Mechatronics Engineering', 'btech', NULL),
('FieldOfStudy', 'Automotive Engineering', 'btech', NULL),
('FieldOfStudy', 'Production Engineering', 'btech', NULL),
('FieldOfStudy', 'Biotechnology Engineering', 'btech', NULL),

-- mtech
('FieldOfStudy', 'Computer Science & Engineering', 'mtech', NULL),
('FieldOfStudy', 'Information Technology', 'mtech', NULL),
('FieldOfStudy', 'Electronics & Communication Engineering', 'mtech', NULL),
('FieldOfStudy', 'Electrical Engineering', 'mtech', NULL),
('FieldOfStudy', 'Mechanical Engineering', 'mtech', NULL),
('FieldOfStudy', 'Civil Engineering', 'mtech', NULL),
('FieldOfStudy', 'Chemical Engineering', 'mtech', NULL),
('FieldOfStudy', 'Artificial Intelligence & Machine Learning', 'mtech', NULL),
('FieldOfStudy', 'Cloud Computing', 'mtech', NULL),
('FieldOfStudy', 'Quantum Computing', 'mtech', NULL),
('FieldOfStudy', 'Sustainability Engineering', 'mtech', NULL),
('FieldOfStudy', 'Advanced Materials', 'mtech', NULL),
('FieldOfStudy', 'Renewable Energy', 'mtech', NULL),
('FieldOfStudy', 'Smart Systems', 'mtech', NULL),
('FieldOfStudy', 'Biomedical Engineering', 'mtech', NULL),

-- diploma_eng
('FieldOfStudy', 'Civil Engineering', 'diploma_eng', NULL),
('FieldOfStudy', 'Mechanical Engineering', 'diploma_eng', NULL),
('FieldOfStudy', 'Electrical Engineering', 'diploma_eng', NULL),
('FieldOfStudy', 'Computer Applications', 'diploma_eng', NULL),
('FieldOfStudy', 'Automobile Engineering', 'diploma_eng', NULL),
('FieldOfStudy', 'Electronics Engineering', 'diploma_eng', NULL),

-- mbbs
('FieldOfStudy', 'General Medicine', 'mbbs', NULL),
('FieldOfStudy', 'Surgery', 'mbbs', NULL),
('FieldOfStudy', 'Pediatrics', 'mbbs', NULL),
('FieldOfStudy', 'Orthopedics', 'mbbs', NULL),
('FieldOfStudy', 'Cardiology', 'mbbs', NULL),
('FieldOfStudy', 'Neurology', 'mbbs', NULL),
('FieldOfStudy', 'Oncology', 'mbbs', NULL),
('FieldOfStudy', 'Nephrology', 'mbbs', NULL),
('FieldOfStudy', 'Urology', 'mbbs', NULL),
('FieldOfStudy', 'Endocrinology', 'mbbs', NULL),
('FieldOfStudy', 'Gastroenterology', 'mbbs', NULL),
('FieldOfStudy', 'Dermatology', 'mbbs', NULL),
('FieldOfStudy', 'Psychiatry', 'mbbs', NULL),
('FieldOfStudy', 'Radiology', 'mbbs', NULL),
('FieldOfStudy', 'Ophthalmology', 'mbbs', NULL),
('FieldOfStudy', 'ENT (Otolaryngology)', 'mbbs', NULL),
('FieldOfStudy', 'Anesthesiology', 'mbbs', NULL),
('FieldOfStudy', 'Pulmonology', 'mbbs', NULL),
('FieldOfStudy', 'Rheumatology', 'mbbs', NULL),
('FieldOfStudy', 'Immunology', 'mbbs', NULL),
('FieldOfStudy', 'Emergency Medicine', 'mbbs', NULL),

-- bds
('FieldOfStudy', 'Oral Surgery', 'bds', NULL),
('FieldOfStudy', 'Orthodontics', 'bds', NULL),
('FieldOfStudy', 'Periodontics', 'bds', NULL),
('FieldOfStudy', 'Prosthodontics', 'bds', NULL),
('FieldOfStudy', 'Pedodontics', 'bds', NULL),

-- bams
('FieldOfStudy', 'Ayurvedic Medicine', 'bams', NULL),
('FieldOfStudy', 'Panchakarma', 'bams', NULL),
('FieldOfStudy', 'Herbal Sciences', 'bams', NULL),

-- bhms
('FieldOfStudy', 'Homeopathy', 'bhms', NULL),
('FieldOfStudy', 'Clinical Practice', 'bhms', NULL),

-- bpt
('FieldOfStudy', 'Physiotherapy', 'bpt', NULL),
('FieldOfStudy', 'Sports Physiotherapy', 'bpt', NULL),
('FieldOfStudy', 'Neuro Rehabilitation', 'bpt', NULL),
('FieldOfStudy', 'Cardio-Pulmonary Physiotherapy', 'bpt', NULL),

-- md
('FieldOfStudy', 'Internal Medicine', 'md', NULL),
('FieldOfStudy', 'Pediatrics', 'md', NULL),
('FieldOfStudy', 'Surgery', 'md', NULL),
('FieldOfStudy', 'Orthopedics', 'md', NULL),
('FieldOfStudy', 'Cardiology', 'md', NULL),
('FieldOfStudy', 'Neurology', 'md', NULL),
('FieldOfStudy', 'Oncology', 'md', NULL),
('FieldOfStudy', 'Radiology', 'md', NULL),
('FieldOfStudy', 'Pathology', 'md', NULL),
('FieldOfStudy', 'Anesthesiology', 'md', NULL),

-- nursing
('FieldOfStudy', 'General Nursing', 'nursing', NULL),
('FieldOfStudy', 'Critical Care Nursing', 'nursing', NULL),
('FieldOfStudy', 'Pediatric Nursing', 'nursing', NULL),
('FieldOfStudy', 'Psychiatric Nursing', 'nursing', NULL),
('FieldOfStudy', 'Community Health Nursing', 'nursing', NULL),

-- bba
('FieldOfStudy', 'General Management', 'bba', NULL),
('FieldOfStudy', 'Finance', 'bba', NULL),
('FieldOfStudy', 'Marketing', 'bba', NULL),
('FieldOfStudy', 'Human Resources', 'bba', NULL),
('FieldOfStudy', 'Logistics', 'bba', NULL),
('FieldOfStudy', 'International Business', 'bba', NULL),

-- bcom
('FieldOfStudy', 'Accounting', 'bcom', NULL),
('FieldOfStudy', 'Banking', 'bcom', NULL),
('FieldOfStudy', 'Taxation', 'bcom', NULL),
('FieldOfStudy', 'Finance', 'bcom', NULL),
('FieldOfStudy', 'Economics', 'bcom', NULL),

-- mba
('FieldOfStudy', 'Finance', 'mba', NULL),
('FieldOfStudy', 'Marketing', 'mba', NULL),
('FieldOfStudy', 'Human Resources', 'mba', NULL),
('FieldOfStudy', 'Operations Management', 'mba', NULL),
('FieldOfStudy', 'Business Analytics', 'mba', NULL),
('FieldOfStudy', 'International Business', 'mba', NULL),
('FieldOfStudy', 'Entrepreneurship', 'mba', NULL),
('FieldOfStudy', 'IT Management', 'mba', NULL),
('FieldOfStudy', 'Supply Chain Management', 'mba', NULL),
('FieldOfStudy', 'Healthcare Management', 'mba', NULL),
('FieldOfStudy', 'Hospitality Management', 'mba', NULL),
('FieldOfStudy', 'Aviation Management', 'mba', NULL),
('FieldOfStudy', 'Real Estate', 'mba', NULL),
('FieldOfStudy', 'Energy Management', 'mba', NULL),
('FieldOfStudy', 'Sustainability', 'mba', NULL),
('FieldOfStudy', 'Agribusiness', 'mba', NULL),

-- mcom
('FieldOfStudy', 'Advanced Accounting', 'mcom', NULL),
('FieldOfStudy', 'Corporate Finance', 'mcom', NULL),
('FieldOfStudy', 'Economics', 'mcom', NULL),

-- ba
('FieldOfStudy', 'English Literature', 'ba', NULL),
('FieldOfStudy', 'History', 'ba', NULL),
('FieldOfStudy', 'Political Science', 'ba', NULL),
('FieldOfStudy', 'Sociology', 'ba', NULL),
('FieldOfStudy', 'Psychology', 'ba', NULL),
('FieldOfStudy', 'Philosophy', 'ba', NULL),
('FieldOfStudy', 'Economics', 'ba', NULL),
('FieldOfStudy', 'Journalism & Mass Communication', 'ba', NULL),
('FieldOfStudy', 'Anthropology', 'ba', NULL),
('FieldOfStudy', 'Fine Arts', 'ba', NULL),
('FieldOfStudy', 'Geography', 'ba', NULL),
('FieldOfStudy', 'Linguistics', 'ba', NULL),
('FieldOfStudy', 'French Language', 'ba', NULL),
('FieldOfStudy', 'German Language', 'ba', NULL),
('FieldOfStudy', 'Spanish Language', 'ba', NULL),
('FieldOfStudy', 'Japanese Language', 'ba', NULL),
('FieldOfStudy', 'Hindi Literature', 'ba', NULL),
('FieldOfStudy', 'Sanskrit', 'ba', NULL),

-- bsc
('FieldOfStudy', 'Physics', 'bsc', NULL),
('FieldOfStudy', 'Chemistry', 'bsc', NULL),
('FieldOfStudy', 'Mathematics', 'bsc', NULL),
('FieldOfStudy', 'Statistics', 'bsc', NULL),
('FieldOfStudy', 'Computer Science', 'bsc', NULL),
('FieldOfStudy', 'Electronics', 'bsc', NULL),
('FieldOfStudy', 'Biotechnology', 'bsc', NULL),
('FieldOfStudy', 'Microbiology', 'bsc', NULL),
('FieldOfStudy', 'Zoology', 'bsc', NULL),
('FieldOfStudy', 'Botany', 'bsc', NULL),
('FieldOfStudy', 'Psychology', 'bsc', NULL),
('FieldOfStudy', 'Environmental Science', 'bsc', NULL),
('FieldOfStudy', 'Forensic Science', 'bsc', NULL),
('FieldOfStudy', 'Food Science & Technology', 'bsc', NULL),
('FieldOfStudy', 'Geology', 'bsc', NULL),
('FieldOfStudy', 'Biochemistry', 'bsc', NULL),

-- ma
('FieldOfStudy', 'English Literature', 'ma', NULL),
('FieldOfStudy', 'History', 'ma', NULL),
('FieldOfStudy', 'Political Science', 'ma', NULL),
('FieldOfStudy', 'Sociology', 'ma', NULL),
('FieldOfStudy', 'Psychology', 'ma', NULL),
('FieldOfStudy', 'Philosophy', 'ma', NULL),
('FieldOfStudy', 'Economics', 'ma', NULL),
('FieldOfStudy', 'Journalism & Mass Communication', 'ma', NULL),
('FieldOfStudy', 'Anthropology', 'ma', NULL),
('FieldOfStudy', 'Fine Arts', 'ma', NULL),
('FieldOfStudy', 'Geography', 'ma', NULL),
('FieldOfStudy', 'Linguistics', 'ma', NULL),

-- msc
('FieldOfStudy', 'Physics', 'msc', NULL),
('FieldOfStudy', 'Chemistry', 'msc', NULL),
('FieldOfStudy', 'Mathematics', 'msc', NULL),
('FieldOfStudy', 'Statistics', 'msc', NULL),
('FieldOfStudy', 'Computer Science', 'msc', NULL),
('FieldOfStudy', 'Electronics', 'msc', NULL),
('FieldOfStudy', 'Biotechnology', 'msc', NULL),
('FieldOfStudy', 'Microbiology', 'msc', NULL),
('FieldOfStudy', 'Zoology', 'msc', NULL),
('FieldOfStudy', 'Botany', 'msc', NULL),
('FieldOfStudy', 'Environmental Science', 'msc', NULL),
('FieldOfStudy', 'Forensic Science', 'msc', NULL),
('FieldOfStudy', 'Food Science & Technology', 'msc', NULL),
('FieldOfStudy', 'Data Science', 'msc', NULL),
('FieldOfStudy', 'Bioinformatics', 'msc', NULL),

-- llb
('FieldOfStudy', 'Criminal Law', 'llb', NULL),
('FieldOfStudy', 'Corporate Law', 'llb', NULL),
('FieldOfStudy', 'International Law', 'llb', NULL),
('FieldOfStudy', 'Constitutional Law', 'llb', NULL),
('FieldOfStudy', 'Intellectual Property Law', 'llb', NULL),
('FieldOfStudy', 'Cyber Law', 'llb', NULL),
('FieldOfStudy', 'Environmental Law', 'llb', NULL),
('FieldOfStudy', 'Human Rights Law', 'llb', NULL),
('FieldOfStudy', 'Labor Law', 'llb', NULL),

-- llm
('FieldOfStudy', 'Advanced Corporate Law', 'llm', NULL),
('FieldOfStudy', 'Comparative Law', 'llm', NULL),
('FieldOfStudy', 'Human Rights', 'llm', NULL),
('FieldOfStudy', 'Maritime Law', 'llm', NULL),
('FieldOfStudy', 'International Trade Law', 'llm', NULL),
('FieldOfStudy', 'Tax Law', 'llm', NULL),

-- jd
('FieldOfStudy', 'Professional Doctorate in Law', 'jd', NULL),

-- barch
('FieldOfStudy', 'Urban Planning', 'barch', NULL),
('FieldOfStudy', 'Interior Design', 'barch', NULL),
('FieldOfStudy', 'Landscape Architecture', 'barch', NULL),
('FieldOfStudy', 'Sustainable Architecture', 'barch', NULL),
('FieldOfStudy', 'Construction Management', 'barch', NULL),

-- bdes
('FieldOfStudy', 'Fashion Design', 'bdes', NULL),
('FieldOfStudy', 'Graphic Design', 'bdes', NULL),
('FieldOfStudy', 'Industrial Design', 'bdes', NULL),
('FieldOfStudy', 'Product Design', 'bdes', NULL),
('FieldOfStudy', 'Animation', 'bdes', NULL),
('FieldOfStudy', 'Game Design', 'bdes', NULL),
('FieldOfStudy', 'Textile Design', 'bdes', NULL),
('FieldOfStudy', 'UI/UX Design', 'bdes', NULL),
('FieldOfStudy', 'Interior Design', 'bdes', NULL),

-- march
('FieldOfStudy', 'Advanced Urban Planning', 'march', NULL),
('FieldOfStudy', 'Smart Cities', 'march', NULL),
('FieldOfStudy', 'Green Architecture', 'march', NULL),
('FieldOfStudy', 'Heritage Conservation', 'march', NULL),

-- mdes
('FieldOfStudy', 'Product Innovation', 'mdes', NULL),
('FieldOfStudy', 'Interaction Design', 'mdes', NULL),
('FieldOfStudy', 'Advanced Animation', 'mdes', NULL),
('FieldOfStudy', 'Luxury Design', 'mdes', NULL),
('FieldOfStudy', 'Design Research', 'mdes', NULL),

-- bsc_agri
('FieldOfStudy', 'Agronomy', 'bsc_agri', NULL),
('FieldOfStudy', 'Horticulture', 'bsc_agri', NULL),
('FieldOfStudy', 'Soil Science', 'bsc_agri', NULL),
('FieldOfStudy', 'Crop Science', 'bsc_agri', NULL),
('FieldOfStudy', 'Plant Genetics', 'bsc_agri', NULL),
('FieldOfStudy', 'Food Technology', 'bsc_agri', NULL),

-- bvsc
('FieldOfStudy', 'Animal Husbandry', 'bvsc', NULL),
('FieldOfStudy', 'Veterinary Surgery', 'bvsc', NULL),
('FieldOfStudy', 'Dairy Science', 'bvsc', NULL),

-- msc_agri
('FieldOfStudy', 'Advanced Crop Science', 'msc_agri', NULL),
('FieldOfStudy', 'Agro-Ecology', 'msc_agri', NULL),
('FieldOfStudy', 'Genetic Engineering', 'msc_agri', NULL),
('FieldOfStudy', 'Sustainable Agriculture', 'msc_agri', NULL),

-- bhm
('FieldOfStudy', 'Hotel Management', 'bhm', NULL),
('FieldOfStudy', 'Culinary Arts', 'bhm', NULL),
('FieldOfStudy', 'Catering Technology', 'bhm', NULL),
('FieldOfStudy', 'Food Production', 'bhm', NULL),

-- bttm
('FieldOfStudy', 'Travel & Tourism', 'bttm', NULL),
('FieldOfStudy', 'Event Management', 'bttm', NULL),

-- aviation
('FieldOfStudy', 'Pilot Training', 'aviation', NULL),
('FieldOfStudy', 'Aeronautical Management', 'aviation', NULL),
('FieldOfStudy', 'Air Traffic Control', 'aviation', NULL),
('FieldOfStudy', 'Airport Operations', 'aviation', NULL),

-- bfa
('FieldOfStudy', 'Painting', 'bfa', NULL),
('FieldOfStudy', 'Sculpture', 'bfa', NULL),
('FieldOfStudy', 'Applied Arts', 'bfa', NULL),
('FieldOfStudy', 'Photography', 'bfa', NULL),

-- music
('FieldOfStudy', 'Classical Music', 'music', NULL),
('FieldOfStudy', 'Western Music', 'music', NULL),
('FieldOfStudy', 'Instrumental Music', 'music', NULL),
('FieldOfStudy', 'Vocal Music', 'music', NULL),
('FieldOfStudy', 'Musicology', 'music', NULL),

-- dance
('FieldOfStudy', 'Classical Dance', 'dance', NULL),
('FieldOfStudy', 'Modern Dance', 'dance', NULL),
('FieldOfStudy', 'Choreography', 'dance', NULL),

-- phd
('FieldOfStudy', 'Engineering Research', 'phd', NULL),
('FieldOfStudy', 'Medical Research', 'phd', NULL),
('FieldOfStudy', 'Management Research', 'phd', NULL),
('FieldOfStudy', 'Science Research', 'phd', NULL),
('FieldOfStudy', 'Humanities Research', 'phd', NULL),
('FieldOfStudy', 'Legal Research', 'phd', NULL),
('FieldOfStudy', 'Architecture Research', 'phd', NULL),
('FieldOfStudy', 'Agriculture Research', 'phd', NULL),
('FieldOfStudy', 'Design Research', 'phd', NULL),
('FieldOfStudy', 'Arts Research', 'phd', NULL),

-- certificate
('FieldOfStudy', 'Digital Marketing', 'certificate', NULL),
('FieldOfStudy', 'Data Analytics', 'certificate', NULL),
('FieldOfStudy', 'Cybersecurity', 'certificate', NULL),
('FieldOfStudy', 'Cloud Computing', 'certificate', NULL),
('FieldOfStudy', 'Project Management', 'certificate', NULL),
('FieldOfStudy', 'Financial Planning', 'certificate', NULL),
('FieldOfStudy', 'Interior Design', 'certificate', NULL),
('FieldOfStudy', 'Culinary Arts', 'certificate', NULL),
('FieldOfStudy', 'Photography', 'certificate', NULL),
('FieldOfStudy', 'Foreign Languages', 'certificate', NULL),

-- diploma
('FieldOfStudy', 'Computer Applications', 'diploma', NULL),
('FieldOfStudy', 'Electronics', 'diploma', NULL),
('FieldOfStudy', 'Mechanical Engineering', 'diploma', NULL),
('FieldOfStudy', 'Civil Engineering', 'diploma', NULL),
('FieldOfStudy', 'Hotel Management', 'diploma', NULL),
('FieldOfStudy', 'Fashion Design', 'diploma', NULL),
('FieldOfStudy', 'Mass Communication', 'diploma', NULL),

-- other
('FieldOfStudy', 'Custom Field of Study', 'other', NULL);

-- ---------------------------------------------------------------------------
-- Upsert into ReferenceMetadata
-- ---------------------------------------------------------------------------
MERGE ReferenceMetadata AS target
USING @data AS source
ON target.RefType = source.RefType
   AND ISNULL(target.Category, '') = ISNULL(source.Category, '')
   AND target.Value = source.Value
WHEN MATCHED THEN
    UPDATE SET
        target.Description = source.Description,
        target.IsActive = 1,
        target.UpdatedAt = @now
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description, IsActive, CreatedAt, UpdatedAt)
    VALUES (source.RefType, source.Value, source.Category, source.Description, 1, @now, @now);

PRINT '✅ Seeded DegreeType and FieldOfStudy into ReferenceMetadata.';
GO
