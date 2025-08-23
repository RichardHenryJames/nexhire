# ?? Profile Update Bug Fix Documentation

## **The Issue You're Experiencing**

You mentioned that:
- ? **Profile visibility changes save correctly**
- ? **Hide current company toggle doesn't save**

## **Root Cause Analysis**

I found the exact issue by analyzing your backend code:

### **?? Problem: Different Database Tables**

| Setting | Database Table | Endpoint | Status |
|---------|---------------|----------|---------|
| **Profile Visibility** | `Users` table | `UserService.updateProfile` | ? **Works** |
| **Hide Current Company** | `Applicants` table | `ApplicantService.updateApplicantProfile` | ? **Fails** |

### **?? Field Mapping Analysis**

**Users Table Fields (UserService.updateProfile):**
```typescript
// These work correctly ?
'firstName' ? 'FirstName'
'lastName' ? 'LastName'  
'profileVisibility' ? 'ProfileVisibility'  // ? This is why it works!
'phone' ? 'Phone'
'dateOfBirth' ? 'DateOfBirth'
```

**Applicants Table Fields (ApplicantService.updateApplicantProfile):**
```typescript
// These should work but aren't being called ?
'hideCurrentCompany' ? 'HideCurrentCompany'    // ? Wrong endpoint!
'hideSalaryDetails' ? 'HideSalaryDetails'
'allowRecruitersToContact' ? 'AllowRecruitersToContact'
'currentJobTitle' ? 'CurrentJobTitle'
```

## **?? The Solution**

### **Frontend needs to route fields to correct endpoints:**

```typescript
// Current frontend (WRONG ?)
const updateProfile = async (profileData) => {
  // Sending all fields to same endpoint
  await api.put('/users/profile', {
    profileVisibility: 'Private',     // ? Works (Users table)
    hideCurrentCompany: true,         // ? Fails (wrong table)
    hideSalaryDetails: true          // ? Fails (wrong table)
  });
};

// Fixed frontend (CORRECT ?)
const updateProfile = async (profileData) => {
  // Split fields by database table
  const usersFields = ['firstName', 'lastName', 'profileVisibility', 'phone'];
  const applicantsFields = ['hideCurrentCompany', 'hideSalaryDetails', 'currentJobTitle'];
  
  const usersData = {};
  const applicantsData = {};
  
  Object.keys(profileData).forEach(key => {
    if (usersFields.includes(key)) {
      usersData[key] = profileData[key];
    } else if (applicantsFields.includes(key)) {
      applicantsData[key] = profileData[key];
    }
  });
  
  // Send to correct endpoints
  if (Object.keys(usersData).length > 0) {
    await api.put('/users/profile', usersData);              // Users table
  }
  
  if (Object.keys(applicantsData).length > 0) {
    await api.put(\`/applicants/\${userId}/profile\`, applicantsData); // Applicants table
  }
};
```

## **?? Quick Fix for Your Frontend**

Update your profile update function to route fields correctly:

```typescript
// Field routing configuration
const USERS_TABLE_FIELDS = [
  'firstName', 'lastName', 'phone', 'dateOfBirth', 
  'gender', 'profilePictureURL', 'profileVisibility'
];

const APPLICANTS_TABLE_FIELDS = [
  'hideCurrentCompany', 'hideSalaryDetails', 'allowRecruitersToContact',
  'isOpenToWork', 'currentJobTitle', 'currentCompany', 'primarySkills',
  'secondarySkills', 'summary', 'headline', 'linkedInProfile', 'githubProfile'
];

const updateUserProfile = async (userId, profileData) => {
  try {
    const usersData = {};
    const applicantsData = {};
    
    // Route fields to correct tables
    Object.keys(profileData).forEach(key => {
      if (USERS_TABLE_FIELDS.includes(key)) {
        usersData[key] = profileData[key];
      } else if (APPLICANTS_TABLE_FIELDS.includes(key)) {
        applicantsData[key] = profileData[key];
      }
    });
    
    const promises = [];
    
    // Update Users table if needed
    if (Object.keys(usersData).length > 0) {
      promises.push(
        nexhireAPI.put('/users/profile', usersData)
      );
    }
    
    // Update Applicants table if needed
    if (Object.keys(applicantsData).length > 0) {
      promises.push(
        nexhireAPI.put(\`/applicants/\${userId}/profile\`, applicantsData)
      );
    }
    
    await Promise.all(promises);
    console.log('? Profile updated successfully');
    
  } catch (error) {
    console.error('? Profile update failed:', error);
    throw error;
  }
};
```

## **?? Testing the Fix**

After implementing the fix, test with this data:

```typescript
// Test data with mixed fields
const testProfileData = {
  // Users table field
  profileVisibility: 'Private',        // Should save ?
  firstName: 'Updated Name',           // Should save ?
  
  // Applicants table fields  
  hideCurrentCompany: true,            // Should now save ?
  hideSalaryDetails: true,            // Should now save ?
  currentJobTitle: 'Senior Engineer'   // Should now save ?
};

await updateUserProfile(userId, testProfileData);
```

## **?? Expected Results After Fix**

| Field | Table | Endpoint | Before Fix | After Fix |
|-------|-------|----------|------------|-----------|
| `profileVisibility` | Users | `/users/profile` | ? Works | ? Works |
| `hideCurrentCompany` | Applicants | `/applicants/{userId}/profile` | ? Fails | ? **Fixed** |
| `hideSalaryDetails` | Applicants | `/applicants/{userId}/profile` | ? Fails | ? **Fixed** |
| `currentJobTitle` | Applicants | `/applicants/{userId}/profile` | ? Fails | ? **Fixed** |

## **? Summary**

The issue is **field routing** - your frontend is sending Applicants table fields to the Users table endpoint. The backend code is correct; it just needs the data sent to the right endpoints.

**Key Changes Needed:**
1. ?? **Split profile data by database table**
2. ?? **Route Users fields to `/users/profile`**  
3. ?? **Route Applicants fields to `/applicants/{userId}/profile`**
4. ?? **Execute both API calls if needed**

After this fix, both profile visibility AND hide current company will save correctly! ??