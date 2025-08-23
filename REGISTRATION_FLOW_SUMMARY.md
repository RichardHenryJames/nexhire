# Complete Job Seeker Registration Flow

## ?? Registration Flow Overview

### **Updated Flow with Work Experience Screen:**

```
1. Welcome Screen
   ? (Select "I'm looking for jobs")
2. Experience Type Selection
   ? 
   ??? Students ? Education Details (Step 3)
   ??? Experienced ? Work Experience (Step 3a)
                   ?
3a. Work Experience Screen (NEW!)
   ? (Collects professional background)
3. Education Details Screen  
   ? (Collects university/college info)
4. Job Preferences Screen
   ? (Collects job type preferences)
5. Personal Details Screen
   ? (Final registration step)
6. Complete Registration
```

## ?? New Work Experience Screen Features

### **Collected Information:**
- **Employment Status**: Currently working / Previously worked
- **Job Title**: Current or most recent position
- **Company**: Current or most recent employer  
- **Years of Experience**: 0-1, 1-3, 3-5, 5-10, 10+ years
- **Work Arrangement**: On-site, Remote, Hybrid
- **Job Type**: Full-time, Part-time, Contract, Freelance, etc.
- **Skills**: Primary and secondary skills
- **Professional Summary**: Brief overview of experience

### **Database Mapping:**
Based on `Applicants` table structure:
- `CurrentJobTitle` ? currentJobTitle
- `CurrentCompany` ? currentCompany  
- `YearsOfExperience` ? yearsOfExperience
- `PrimarySkills` ? primarySkills
- `SecondarySkills` ? secondarySkills
- `Summary` ? summary

## ?? Navigation Logic

### **Experience Type Selection Routing:**
```javascript
if (selectedType === 'Student') {
  // Students skip work experience
  navigation.navigate('EducationDetailsScreen');
} else {
  // Experienced professionals provide work background first
  navigation.navigate('WorkExperienceScreen');
}
```

### **Data Flow Between Screens:**
1. **Work Experience** ? Education Details ? Job Preferences ? Personal Details
2. **Route Params Passed:**
   - `userType`: JobSeeker
   - `experienceType`: Student/Experienced
   - `workExperienceData`: Work background (if applicable)
   - `educationData`: University/college info
   - `jobPreferences`: Job type preferences

## ? Benefits of This Approach

### **For Students:**
- Direct path to education details
- No unnecessary work experience forms
- Streamlined registration process

### **For Experienced Professionals:**
- Comprehensive work background collection
- Better job matching based on experience
- Professional profile building from start

### **For Database Integration:**
- All fields map to Applicants table columns
- Comprehensive user profiles from registration
- Better matching algorithms possible

## ?? Key Features

### **Smart Routing:**
- Different paths based on user experience level
- No wasted steps for students
- Comprehensive data collection for professionals

### **Professional Data Collection:**
- Current vs previous employment status
- Skills categorization (primary/secondary)
- Work arrangement preferences
- Years of experience tracking

### **Seamless Integration:**
- All data flows through to final registration
- Database-ready format
- Consistent with existing screens

---

**Result**: A complete, intelligent registration flow that adapts to user type and collects relevant professional information for better job matching! ??