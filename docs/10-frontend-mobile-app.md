# Frontend Mobile Application

## Overview

The NexHire mobile application is built using **React Native** with **Expo**, providing a cross-platform mobile experience for both iOS and Android. The app enables job seekers to browse opportunities, connect with referrers, and manage their job search journey.

## Technology Stack

### Core Framework
- **React Native**: Cross-platform mobile development
- **Expo**: Development toolchain and SDK
- **TypeScript**: Type-safe JavaScript

### State Management
- **React Context API**: Global state management
- **React Hooks**: Component-level state

### Navigation
- **React Navigation**: Native navigation library
- **Stack Navigator**: Screen transitions
- **Tab Navigator**: Bottom tab navigation
- **Drawer Navigator**: Side menu

### UI Components
- **React Native Paper**: Material Design components
- **React Native Elements**: Additional UI components
- **Custom Components**: Branded design system

### Data & APIs
- **Axios**: HTTP client for API calls
- **React Query**: Server state management
- **Firebase**: Authentication and push notifications

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/          # Generic components
│   │   ├── job/             # Job-related components
│   │   ├── profile/         # User profile components
│   │   └── referral/        # Referral components
│   ├── screens/             # Screen components
│   │   ├── auth/            # Authentication screens
│   │   ├── jobs/            # Job browsing screens
│   │   ├── profile/         # Profile screens
│   │   ├── referrals/       # Referral management
│   │   └── messaging/       # Chat screens
│   ├── navigation/          # Navigation configuration
│   │   ├── AppNavigator.js
│   │   ├── AuthNavigator.js
│   │   └── MainNavigator.js
│   ├── services/            # API and business logic
│   │   ├── api/             # API client
│   │   ├── auth/            # Authentication
│   │   └── storage/         # Local storage
│   ├── contexts/            # React contexts
│   │   ├── AuthContext.js
│   │   ├── JobContext.js
│   │   └── UserContext.js
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.js
│   │   ├── useJobs.js
│   │   └── useProfile.js
│   ├── utils/               # Utility functions
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── helpers.js
│   ├── styles/              # Global styles
│   │   ├── theme.js
│   │   ├── colors.js
│   │   └── typography.js
│   └── config/              # App configuration
│       ├── constants.js
│       └── environment.js
├── assets/                  # Images, fonts, icons
├── App.js                   # Root component
├── app.config.js            # Expo configuration
└── package.json
```

## Key Features

### 1. Authentication

#### Login Screen
```jsx
// src/screens/auth/LoginScreen.js
import { useAuth } from '../../hooks/useAuth'

const LoginScreen = () => {
  const { login, loading } = useAuth()
  
  const handleLogin = async (email, password) => {
    try {
      await login(email, password)
      // Navigation handled by AuthContext
    } catch (error) {
      // Show error message
    }
  }
  
  return (
    <View>
      <TextInput placeholder="Email" />
      <TextInput placeholder="Password" secureTextEntry />
      <Button onPress={handleLogin} loading={loading}>
        Login
      </Button>
    </View>
  )
}
```

#### Authentication Context
```jsx
// src/contexts/AuthContext.js
import { createContext, useEffect, useState } from 'react'
import { auth } from '../services/firebase'
import { apiClient } from '../services/api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken()
        apiClient.setAuthToken(token)
        
        // Fetch user profile
        const profile = await apiClient.get('/users/profile')
        setUser({ ...firebaseUser, ...profile })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    
    return unsubscribe
  }, [])
  
  const login = async (email, password) => {
    await auth.signInWithEmailAndPassword(email, password)
  }
  
  const logout = async () => {
    await auth.signOut()
    setUser(null)
  }
  
  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### 2. Job Browsing

#### Job List Screen
```jsx
// src/screens/jobs/JobListScreen.js
import { useJobs } from '../../hooks/useJobs'
import JobCard from '../../components/job/JobCard'

const JobListScreen = ({ navigation }) => {
  const { jobs, loading, loadMore, refreshing, refresh } = useJobs()
  
  const renderJob = ({ item }) => (
    <JobCard
      job={item}
      onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
    />
  )
  
  return (
    <FlatList
      data={jobs}
      renderItem={renderJob}
      keyExtractor={(item) => item.id.toString()}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={refresh}
      ListEmptyComponent={<EmptyState />}
    />
  )
}
```

#### Job Card Component
```jsx
// src/components/job/JobCard.js
const JobCard = ({ job, onPress }) => {
  return (
    <Card onPress={onPress}>
      <Card.Content>
        <View style={styles.header}>
          <Image source={{ uri: job.company.logo }} style={styles.logo} />
          <View style={styles.info}>
            <Text style={styles.title}>{job.title}</Text>
            <Text style={styles.company}>{job.company.name}</Text>
          </View>
        </View>
        
        <View style={styles.details}>
          <Chip icon="map-marker">{job.location}</Chip>
          <Chip icon="briefcase">{job.jobType}</Chip>
          {job.salary && (
            <Chip icon="currency-usd">
              {formatSalary(job.salary)}
            </Chip>
          )}
        </View>
        
        <Text numberOfLines={3} style={styles.description}>
          {job.description}
        </Text>
        
        {job.referrerCount > 0 && (
          <View style={styles.referrers}>
            <Icon name="account-group" />
            <Text>{job.referrerCount} referrers available</Text>
          </View>
        )}
      </Card.Content>
    </Card>
  )
}
```

#### Job Detail Screen
```jsx
// src/screens/jobs/JobDetailScreen.js
const JobDetailScreen = ({ route }) => {
  const { jobId } = route.params
  const { job, loading } = useJob(jobId)
  const navigation = useNavigation()
  
  if (loading) return <LoadingScreen />
  
  return (
    <ScrollView>
      <JobHeader job={job} />
      <JobDescription description={job.description} />
      <JobRequirements requirements={job.requirements} />
      <JobBenefits benefits={job.benefits} />
      
      {job.referrers.length > 0 && (
        <ReferrerList
          referrers={job.referrers}
          onSelectReferrer={(referrer) => {
            navigation.navigate('RequestReferral', {
              jobId: job.id,
              referrerId: referrer.id
            })
          }}
        />
      )}
      
      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('RequestReferral', { jobId })}
        >
          Request Referral
        </Button>
        <Button
          mode="outlined"
          onPress={() => applyDirectly(job.externalUrl)}
        >
          Apply Directly
        </Button>
      </View>
    </ScrollView>
  )
}
```

### 3. Job Search & Filters

```jsx
// src/screens/jobs/JobSearchScreen.js
const JobSearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    location: '',
    jobType: [],
    experienceLevel: [],
    salary: { min: null, max: null },
    remote: false
  })
  
  const { jobs, search } = useJobSearch()
  
  const handleSearch = () => {
    search({ query: searchQuery, ...filters })
  }
  
  return (
    <View>
      <Searchbar
        placeholder="Search jobs..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={handleSearch}
      />
      
      <FilterBar filters={filters} onFilterChange={setFilters} />
      
      <JobList jobs={jobs} />
    </View>
  )
}
```

### 4. Profile Management

#### Profile Screen
```jsx
// src/screens/profile/ProfileScreen.js
const ProfileScreen = () => {
  const { user, updateProfile } = useProfile()
  const [editing, setEditing] = useState(false)
  
  return (
    <ScrollView>
      <ProfileHeader
        user={user}
        onEditPress={() => setEditing(true)}
      />
      
      <Section title="Work Experience">
        <WorkExperienceList experiences={user.workExperience} />
      </Section>
      
      <Section title="Education">
        <EducationList education={user.education} />
      </Section>
      
      <Section title="Skills">
        <SkillsList skills={user.skills} />
      </Section>
      
      <Section title="Resume">
        <ResumeUpload
          currentResume={user.resume}
          onUpload={handleResumeUpload}
        />
      </Section>
      
      {editing && (
        <ProfileEditModal
          user={user}
          visible={editing}
          onClose={() => setEditing(false)}
          onSave={handleSave}
        />
      )}
    </ScrollView>
  )
}
```

#### Profile Update Service
```javascript
// src/services/profileUpdateService.js
export const profileUpdateService = {
  async updateBasicInfo(userId, data) {
    const response = await apiClient.put(`/users/${userId}`, data)
    return response.data
  },
  
  async addWorkExperience(userId, experience) {
    const response = await apiClient.post(
      `/users/${userId}/work-experience`,
      experience
    )
    return response.data
  },
  
  async uploadResume(userId, file) {
    const formData = new FormData()
    formData.append('resume', {
      uri: file.uri,
      type: 'application/pdf',
      name: file.name
    })
    
    const response = await apiClient.post(
      `/users/${userId}/resume`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    )
    return response.data
  }
}
```

### 5. Referral Management

#### Request Referral Screen
```jsx
// src/screens/referrals/RequestReferralScreen.js
const RequestReferralScreen = ({ route }) => {
  const { jobId, referrerId } = route.params
  const [message, setMessage] = useState('')
  const { requestReferral, loading } = useReferrals()
  
  const handleSubmit = async () => {
    try {
      await requestReferral({
        jobId,
        referrerId,
        message,
        resumeUrl: user.resumeUrl
      })
      
      navigation.navigate('ReferralSuccess')
    } catch (error) {
      showError(error.message)
    }
  }
  
  return (
    <ScrollView>
      <JobSummary jobId={jobId} />
      <ReferrerProfile referrerId={referrerId} />
      
      <TextInput
        label="Why are you a good fit?"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={6}
      />
      
      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={loading}
        disabled={!message}
      >
        Request Referral
      </Button>
    </ScrollView>
  )
}
```

#### My Referrals Screen
```jsx
// src/screens/referrals/MyReferralsScreen.js
const MyReferralsScreen = () => {
  const { referrals, loading } = useMyReferrals()
  const [filter, setFilter] = useState('all') // all, pending, accepted, rejected
  
  const filteredReferrals = referrals.filter(r => {
    if (filter === 'all') return true
    return r.status === filter
  })
  
  return (
    <View>
      <SegmentedButtons
        value={filter}
        onValueChange={setFilter}
        buttons={[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'accepted', label: 'Accepted' },
          { value: 'rejected', label: 'Rejected' }
        ]}
      />
      
      <FlatList
        data={filteredReferrals}
        renderItem={({ item }) => (
          <ReferralCard
            referral={item}
            onPress={() => navigation.navigate('ReferralDetail', {
              referralId: item.id
            })}
          />
        )}
      />
    </View>
  )
}
```

### 6. Messaging

#### Chat Screen
```jsx
// src/screens/messaging/ChatScreen.js
import { GiftedChat } from 'react-native-gifted-chat'

const ChatScreen = ({ route }) => {
  const { conversationId } = route.params
  const { messages, sendMessage, loading } = useChat(conversationId)
  const { user } = useAuth()
  
  const handleSend = async (newMessages) => {
    await sendMessage(newMessages[0].text)
  }
  
  return (
    <GiftedChat
      messages={messages}
      onSend={handleSend}
      user={{
        _id: user.id,
        name: user.displayName,
        avatar: user.photoURL
      }}
      renderBubble={renderBubble}
      renderSend={renderSend}
      renderInputToolbar={renderInputToolbar}
    />
  )
}
```

#### Conversations List
```jsx
// src/screens/messaging/ConversationsScreen.js
const ConversationsScreen = () => {
  const { conversations, loading } = useConversations()
  
  return (
    <FlatList
      data={conversations}
      renderItem={({ item }) => (
        <ConversationItem
          conversation={item}
          onPress={() => navigation.navigate('Chat', {
            conversationId: item.id
          })}
        />
      )}
    />
  )
}

const ConversationItem = ({ conversation, onPress }) => (
  <TouchableOpacity onPress={onPress}>
    <View style={styles.container}>
      <Avatar source={{ uri: conversation.otherUser.avatar }} />
      <View style={styles.content}>
        <Text style={styles.name}>{conversation.otherUser.name}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {conversation.lastMessage.text}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.time}>
          {formatTime(conversation.lastMessage.createdAt)}
        </Text>
        {conversation.unreadCount > 0 && (
          <Badge>{conversation.unreadCount}</Badge>
        )}
      </View>
    </View>
  </TouchableOpacity>
)
```

### 7. Navigation Structure

```jsx
// src/navigation/AppNavigator.js
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

const JobsStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="JobList" component={JobListScreen} />
    <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    <Stack.Screen name="JobSearch" component={JobSearchScreen} />
  </Stack.Navigator>
)

const ProfileStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
  </Stack.Navigator>
)

const MainNavigator = () => (
  <Tab.Navigator>
    <Tab.Screen
      name="Jobs"
      component={JobsStack}
      options={{ tabBarIcon: ({ color }) => <Icon name="briefcase" color={color} /> }}
    />
    <Tab.Screen
      name="Referrals"
      component={ReferralsStack}
      options={{ tabBarIcon: ({ color }) => <Icon name="handshake" color={color} /> }}
    />
    <Tab.Screen
      name="Messages"
      component={MessagesStack}
      options={{ tabBarIcon: ({ color }) => <Icon name="message" color={color} /> }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileStack}
      options={{ tabBarIcon: ({ color }) => <Icon name="account" color={color} /> }}
    />
  </Tab.Navigator>
)

const AppNavigator = () => {
  const { user, loading } = useAuth()
  
  if (loading) return <SplashScreen />
  
  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}
```

## API Integration

### API Client Configuration
```javascript
// src/services/api/client.js
import axios from 'axios'
import { API_BASE_URL } from '../config/environment'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      await logout()
    }
    return Promise.reject(error)
  }
)
```

### Custom Hooks for API Calls

```javascript
// src/hooks/useJobs.js
import { useQuery, useInfiniteQuery } from 'react-query'
import { jobsApi } from '../services/api/jobs'

export const useJobs = (filters = {}) => {
  return useInfiniteQuery(
    ['jobs', filters],
    ({ pageParam = 1 }) => jobsApi.getJobs({ ...filters, page: pageParam }),
    {
      getNextPageParam: (lastPage) => lastPage.nextPage,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  )
}

export const useJob = (jobId) => {
  return useQuery(
    ['job', jobId],
    () => jobsApi.getJob(jobId),
    {
      enabled: !!jobId
    }
  )
}
```

## Styling & Theming

### Theme Configuration
```javascript
// src/styles/theme.js
export const theme = {
  colors: {
    primary: '#4A90E2',
    secondary: '#50C878',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#333333',
    textSecondary: '#666666',
    error: '#E74C3C',
    warning: '#F39C12',
    success: '#27AE60',
    border: '#E0E0E0'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold' },
    h2: { fontSize: 24, fontWeight: 'bold' },
    h3: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: 'normal' },
    caption: { fontSize: 14, fontWeight: 'normal' },
    small: { fontSize: 12, fontWeight: 'normal' }
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999
  }
}
```

## Push Notifications

```javascript
// src/services/notifications.js
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export const configurePushNotifications = async () => {
  const { status } = await Notifications.requestPermissionsAsync()
  
  if (status !== 'granted') {
    return null
  }
  
  const token = await Notifications.getExpoPushTokenAsync()
  
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX
    })
  }
  
  return token.data
}

export const sendPushToken = async (token) => {
  await apiClient.post('/users/push-token', { token })
}
```

## Performance Optimization

### Image Optimization
```jsx
import FastImage from 'react-native-fast-image'

<FastImage
  source={{ uri: imageUrl, priority: FastImage.priority.normal }}
  resizeMode={FastImage.resizeMode.cover}
  style={styles.image}
/>
```

### List Optimization
```jsx
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  // Performance props
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={10}
  windowSize={10}
  // Memoization
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index
  })}
/>
```

## Build & Deployment

### Development Build
```bash
# Start Expo development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

### Production Build
```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

---

**Last Updated**: December 5, 2025
