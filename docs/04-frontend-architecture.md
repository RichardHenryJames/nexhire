# Frontend Architecture Documentation

## Overview

The NexHire frontend is a **React Native** mobile application built with **Expo**, supporting both iOS and Android platforms. It provides a modern, responsive interface for job seekers to browse jobs, apply for positions, request referrals, manage their wallet, and communicate with employers.

---

## Technology Stack

### **Core Technologies**
- **React Native**: Cross-platform mobile framework
- **Expo**: Development and build platform (~52.x)
- **React Navigation**: Navigation library for screen routing
- **Axios**: HTTP client for API communication
- **Firebase**: Authentication and push notifications
- **AsyncStorage**: Local data persistence
- **Expo Router**: File-based routing system

### **UI Libraries**
- **React Native Elements**: UI component library
- **React Native Vector Icons**: Icon library
- **React Native Paper**: Material Design components
- **React Native Safe Area Context**: Safe area handling

### **State Management**
- **React Context API**: Global state management
- **React Hooks**: Component state management

### **Payment Integration**
- **Stripe SDK**: Payment processing
- **Apple Pay / Google Pay**: Native payment methods

---

## Project Structure

```
frontend/
├── app.config.js                    # Expo configuration
├── App.js                           # Root component
├── package.json                     # Dependencies
├── staticwebapp.config.json         # Azure Static Web App config
├── host.json                        # Azure Functions host config
├── assets/                          # Images, fonts, icons
├── components/                      # Reusable components
│   └── ProfileSettingsComponent.jsx # Profile settings UI
├── src/
│   ├── components/                  # UI components
│   ├── config/                      # Configuration files
│   │   └── firebase.config.js       # Firebase setup
│   ├── contexts/                    # React contexts
│   │   ├── AuthContext.js           # Authentication state
│   │   └── UserContext.js           # User profile state
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAuth.js               # Authentication hook
│   │   └── useWallet.js             # Wallet management hook
│   ├── navigation/                  # Navigation setup
│   │   ├── AppNavigator.js          # Main navigator
│   │   ├── AuthNavigator.js         # Auth flow navigator
│   │   └── TabNavigator.js          # Bottom tab navigator
│   ├── screens/                     # Screen components
│   │   ├── auth/                    # Authentication screens
│   │   │   ├── LoginScreen.js
│   │   │   ├── RegisterScreen.js
│   │   │   └── ForgotPasswordScreen.js
│   │   ├── jobs/                    # Job-related screens
│   │   │   ├── JobListScreen.js
│   │   │   ├── JobDetailScreen.js
│   │   │   ├── JobSearchScreen.js
│   │   │   └── SavedJobsScreen.js
│   │   ├── applications/            # Application screens
│   │   │   ├── MyApplicationsScreen.js
│   │   │   └── ApplicationDetailScreen.js
│   │   ├── profile/                 # Profile screens
│   │   │   ├── ProfileScreen.js
│   │   │   ├── EditProfileScreen.js
│   │   │   ├── WorkExperienceScreen.js
│   │   │   └── EducationScreen.js
│   │   ├── referral/                # Referral screens
│   │   │   ├── ReferralDashboardScreen.js
│   │   │   ├── RequestReferralScreen.js
│   │   │   ├── MyReferralsScreen.js
│   │   │   └── ReferralPlansScreen.js
│   │   ├── wallet/                  # Wallet screens
│   │   │   ├── WalletScreen.js
│   │   │   ├── TransactionHistoryScreen.js
│   │   │   └── AddFundsScreen.js
│   │   ├── messaging/               # Messaging screens
│   │   │   ├── InboxScreen.js
│   │   │   ├── ConversationScreen.js
│   │   │   └── ComposeMessageScreen.js
│   │   ├── payment/                 # Payment screens
│   │   │   └── PaymentScreen.js
│   │   ├── employer/                # Employer screens
│   │   │   └── EmployerProfileScreen.js
│   │   ├── organization/            # Organization screens
│   │   │   └── OrganizationDetailScreen.js
│   │   ├── legal/                   # Legal screens
│   │   │   ├── PrivacyPolicyScreen.js
│   │   │   └── TermsOfServiceScreen.js
│   │   ├── HomeScreen.js            # Main dashboard
│   │   └── LoadingScreen.js         # Splash screen
│   ├── services/                    # API services
│   │   ├── api.js                   # Base API client
│   │   ├── authService.js           # Authentication API
│   │   ├── jobService.js            # Job API
│   │   ├── applicationService.js    # Application API
│   │   ├── referralService.js       # Referral API
│   │   ├── walletService.js         # Wallet API
│   │   ├── paymentService.js        # Payment API
│   │   ├── messagingService.js      # Messaging API
│   │   ├── profileService.js        # Profile API
│   │   └── profileUpdateService.js  # Profile update utilities
│   ├── styles/                      # Shared styles
│   │   ├── colors.js                # Color palette
│   │   ├── typography.js            # Text styles
│   │   └── commonStyles.js          # Reusable styles
│   └── utils/                       # Utility functions
│       ├── validation.js            # Form validation
│       ├── formatting.js            # Data formatting
│       └── storage.js               # AsyncStorage helpers
├── public/                          # Static assets
│   └── _redirects                   # Netlify/Azure redirects
├── web-build/                       # Web build output
│   ├── index.html
│   ├── staticwebapp.config.json
│   └── assets/
└── examples/
    └── profileUpdateExamples.js     # Profile update examples
```

---

## Key Features

### **1. Authentication**

#### **Login Methods**
- Email/Password authentication
- Google OAuth 2.0 sign-in
- Firebase Authentication integration
- JWT token management
- Biometric authentication (planned)

#### **Auth Flow**
```javascript
// src/contexts/AuthContext.js
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  const login = async (email, password) => {
    const response = await authService.login(email, password);
    setUser(response.user);
    setToken(response.token);
    await AsyncStorage.setItem('token', response.token);
  };

  const googleLogin = async () => {
    const googleUser = await GoogleSignin.signIn();
    const response = await authService.googleLogin(googleUser.idToken);
    setUser(response.user);
    setToken(response.token);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

### **2. Job Browsing**

#### **Features**
- Job search with filters (location, salary, type)
- Job listing with pagination
- Job detail view with company info
- Save/bookmark jobs
- Apply to jobs directly
- Share jobs with others

#### **Job List Screen**
```javascript
// src/screens/jobs/JobListScreen.js
const JobListScreen = ({ navigation }) => {
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadJobs();
  }, [filters, page]);

  const loadJobs = async () => {
    const response = await jobService.getJobs({ ...filters, page });
    setJobs(prev => [...prev, ...response.jobs]);
  };

  return (
    <FlatList
      data={jobs}
      renderItem={({ item }) => (
        <JobCard 
          job={item} 
          onPress={() => navigation.navigate('JobDetail', { jobId: item.JobID })}
          onSave={() => handleSaveJob(item.JobID)}
        />
      )}
      onEndReached={() => setPage(prev => prev + 1)}
    />
  );
};
```

---

### **3. Referral System**

#### **Referral Flow**
1. Applicant requests referral for a job
2. System finds eligible referrers (employees at company)
3. Referrer claims request and submits referral
4. Referrer uploads proof (screenshot)
5. Applicant verifies referral
6. Referrer receives points/rewards

#### **Request Referral Screen**
```javascript
// src/screens/referral/RequestReferralScreen.js
const RequestReferralScreen = ({ route }) => {
  const { jobId } = route.params;
  const [resume, setResume] = useState(null);
  const [message, setMessage] = useState('');

  const handleRequestReferral = async () => {
    await referralService.createRequest({
      jobId,
      resumeId: resume.ResumeID,
      message
    });
    navigation.navigate('MyReferrals');
  };

  return (
    <View>
      <ResumeSelector onSelect={setResume} />
      <TextInput
        placeholder="Message to referrer"
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <Button title="Request Referral" onPress={handleRequestReferral} />
    </View>
  );
};
```

---

### **4. Wallet System**

#### **Features**
- View wallet balance
- Transaction history
- Add funds via Stripe
- Withdraw funds
- Use credits for premium features

#### **Wallet Screen**
```javascript
// src/screens/wallet/WalletScreen.js
const WalletScreen = () => {
  const { wallet, transactions, refreshWallet } = useWallet();

  return (
    <ScrollView>
      <WalletBalanceCard balance={wallet.Balance} currency={wallet.Currency} />
      <Button title="Add Funds" onPress={() => navigation.navigate('AddFunds')} />
      <TransactionList transactions={transactions} />
    </ScrollView>
  );
};
```

---

### **5. Profile Management**

#### **Profile Sections**
- Personal information
- Work experience
- Education
- Skills & certifications
- Resume uploads
- Salary expectations
- Job preferences

#### **Profile Update Service**
```javascript
// src/services/profileUpdateService.js
export const updateProfile = async (updates) => {
  const sections = categorizeUpdates(updates);
  
  const promises = [];
  if (sections.basic) promises.push(api.patch('/users/profile', sections.basic));
  if (sections.experience) promises.push(api.post('/work-experience', sections.experience));
  if (sections.salary) promises.push(api.post('/salary', sections.salary));
  
  return Promise.all(promises);
};
```

---

### **6. Messaging**

#### **Features**
- Inbox for messages
- Conversation threads
- Send/receive messages
- Notifications for new messages
- Employer-applicant communication

---

### **7. Payment Integration**

#### **Stripe Integration**
```javascript
// src/screens/payment/PaymentScreen.js
const PaymentScreen = ({ route }) => {
  const { amount, planId } = route.params;
  const stripe = useStripe();

  const handlePayment = async () => {
    const paymentIntent = await paymentService.createPaymentIntent({ 
      amount, 
      planId 
    });
    
    const { error } = await stripe.confirmPayment(paymentIntent.clientSecret, {
      type: 'Card',
      billingDetails: { ... }
    });

    if (!error) {
      // Payment successful
      navigation.navigate('Success');
    }
  };

  return (
    <CardField onCardChange={setCard} />
    <Button title="Pay Now" onPress={handlePayment} />
  );
};
```

---

## API Integration

### **Base API Client**

```javascript
// src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      AsyncStorage.removeItem('token');
      // Navigation logic here
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## Navigation Structure

### **Navigation Hierarchy**

```
AppNavigator (Root)
├── AuthNavigator (Stack) - Unauthenticated users
│   ├── Login
│   ├── Register
│   └── ForgotPassword
└── MainNavigator (Tabs) - Authenticated users
    ├── HomeTab (Stack)
    │   ├── Home
    │   ├── JobDetail
    │   └── EmployerProfile
    ├── JobsTab (Stack)
    │   ├── JobList
    │   ├── JobSearch
    │   └── SavedJobs
    ├── ReferralsTab (Stack)
    │   ├── ReferralDashboard
    │   ├── RequestReferral
    │   ├── MyReferrals
    │   └── ReferralPlans
    ├── MessagesTab (Stack)
    │   ├── Inbox
    │   └── Conversation
    └── ProfileTab (Stack)
        ├── Profile
        ├── EditProfile
        ├── WorkExperience
        ├── Wallet
        └── Settings
```

---

## State Management

### **Context Providers**

1. **AuthContext**: User authentication state
2. **UserContext**: User profile data
3. **WalletContext**: Wallet balance and transactions
4. **NotificationContext**: Push notification management

---

## Environment Configuration

### **Environment Variables**

```javascript
// app.config.js
export default {
  expo: {
    name: "NexHire",
    slug: "nexhire",
    version: "1.0.0",
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_KEY,
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
    }
  }
};
```

**Environment Files:**
- `.env.development` - Development configuration
- `.env.production` - Production configuration

---

## Build & Deployment

### **Development**
```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### **Production Build**
```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

### **Web Deployment**
```bash
# Build for web
expo build:web

# Deploy to Azure Static Web Apps
npm run deploy-web
```

**Deployment Target:** Azure Static Web Apps

---

## Performance Optimization

### **Strategies**
- Image lazy loading
- FlatList virtualization for large lists
- Memoization with React.memo
- Debounced search inputs
- API response caching
- Optimistic UI updates

---

## Testing

- **Unit Tests**: Jest + React Native Testing Library
- **E2E Tests**: Detox (planned)
- **API Mocking**: MSW (Mock Service Worker)

---

## Push Notifications

### **Firebase Cloud Messaging (FCM)**
- Job application status updates
- New referral requests
- Message notifications
- Wallet transaction alerts

---

## Analytics

- **User Tracking**: Firebase Analytics
- **Error Tracking**: Sentry (planned)
- **Performance Monitoring**: Firebase Performance

---

**Last Updated:** December 5, 2025
