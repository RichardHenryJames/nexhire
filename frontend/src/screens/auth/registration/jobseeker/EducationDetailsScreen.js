import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../styles/theme';
import nexhireAPI from '../../../../services/api';

// Add debounce hook for smooth search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const DEGREE_TYPES = [
  // Engineering & Technology
  { id: 'btech', name: 'B.Tech / B.E', category: 'Engineering & Technology' },
  { id: 'mtech', name: 'M.Tech / M.E', category: 'Engineering & Technology' },
  { id: 'diploma_eng', name: 'Diploma (Engineering)', category: 'Engineering & Technology' },
  
  // Medical & Health Sciences
  { id: 'mbbs', name: 'MBBS', category: 'Medical & Health Sciences' },
  { id: 'bds', name: 'BDS', category: 'Medical & Health Sciences' },
  { id: 'bams', name: 'BAMS', category: 'Medical & Health Sciences' },
  { id: 'bhms', name: 'BHMS', category: 'Medical & Health Sciences' },
  { id: 'bpt', name: 'BPT', category: 'Medical & Health Sciences' },
  { id: 'md', name: 'MD/MS', category: 'Medical & Health Sciences' },
  { id: 'nursing', name: 'B.Sc Nursing', category: 'Medical & Health Sciences' },
  
  // Business & Economics
  { id: 'bba', name: 'BBA', category: 'Business & Economics' },
  { id: 'bcom', name: 'B.Com', category: 'Business & Economics' },
  { id: 'mba', name: 'MBA', category: 'Business & Economics' },
  { id: 'mcom', name: 'M.Com', category: 'Business & Economics' },
  
  // Arts & Sciences
  { id: 'ba', name: 'B.A', category: 'Arts & Sciences' },
  { id: 'bsc', name: 'B.Sc', category: 'Arts & Sciences' },
  { id: 'ma', name: 'M.A', category: 'Arts & Sciences' },
  { id: 'msc', name: 'M.Sc', category: 'Arts & Sciences' },
  
  // Law & Public Policy
  { id: 'llb', name: 'LLB', category: 'Law & Public Policy' },
  { id: 'llm', name: 'LLM', category: 'Law & Public Policy' },
  { id: 'jd', name: 'JD (US)', category: 'Law & Public Policy' },
  
  // Architecture & Design
  { id: 'barch', name: 'B.Arch', category: 'Architecture & Design' },
  { id: 'bdes', name: 'B.Des', category: 'Architecture & Design' },
  { id: 'march', name: 'M.Arch', category: 'Architecture & Design' },
  { id: 'mdes', name: 'M.Des', category: 'Architecture & Design' },
  
  // Agriculture & Veterinary
  { id: 'bsc_agri', name: 'B.Sc Agriculture', category: 'Agriculture & Veterinary' },
  { id: 'bvsc', name: 'BVSc', category: 'Agriculture & Veterinary' },
  { id: 'msc_agri', name: 'M.Sc Agriculture', category: 'Agriculture & Veterinary' },
  
  // Hospitality & Tourism
  { id: 'bhm', name: 'BHM', category: 'Hospitality & Tourism' },
  { id: 'bttm', name: 'BTTM', category: 'Hospitality & Tourism' },
  { id: 'aviation', name: 'Aviation', category: 'Hospitality & Tourism' },
  
  // Performing & Fine Arts
  { id: 'bfa', name: 'BFA', category: 'Performing & Fine Arts' },
  { id: 'music', name: 'Music', category: 'Performing & Fine Arts' },
  { id: 'dance', name: 'Dance', category: 'Performing & Fine Arts' },
  
  // PhD & Research
  { id: 'phd', name: 'PhD/Doctorate', category: 'Research' },
  
  // Certificate & Others
  { id: 'certificate', name: 'Certificate Program', category: 'Others' },
  { id: 'diploma', name: 'Diploma', category: 'Others' },
  { id: 'other', name: 'Other', category: 'Others' }
];

const FIELDS_OF_STUDY = {
  // Engineering & Technology
  'btech': [
    'Computer Science & Engineering',
    'Information Technology', 
    'Electronics & Communication Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Metallurgical Engineering',
    'Petroleum Engineering',
    'Mining Engineering',
    'Textile Engineering',
    'Aerospace Engineering',
    'Agricultural Engineering',
    'Marine Engineering',
    'Naval Architecture',
    'Robotics Engineering',
    'Artificial Intelligence',
    'Data Science',
    'Cybersecurity',
    'Internet of Things (IoT)',
    'Nanotechnology',
    'Environmental Engineering',
    'Structural Engineering',
    'Mechatronics Engineering',
    'Automotive Engineering',
    'Production Engineering',
    'Biotechnology Engineering'
  ],
  'mtech': [
    'Computer Science & Engineering',
    'Information Technology',
    'Electronics & Communication Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Artificial Intelligence & Machine Learning',
    'Cloud Computing',
    'Quantum Computing',
    'Sustainability Engineering',
    'Advanced Materials',
    'Renewable Energy',
    'Smart Systems',
    'Biomedical Engineering'
  ],
  'diploma_eng': [
    'Civil Engineering',
    'Mechanical Engineering',
    'Electrical Engineering',
    'Computer Applications',
    'Automobile Engineering',
    'Electronics Engineering'
  ],

  // Medical & Health Sciences
  'mbbs': [
    'General Medicine',
    'Surgery',
    'Pediatrics',
    'Orthopedics',
    'Cardiology',
    'Neurology',
    'Oncology',
    'Nephrology',
    'Urology',
    'Endocrinology',
    'Gastroenterology',
    'Dermatology',
    'Psychiatry',
    'Radiology',
    'Ophthalmology',
    'ENT (Otolaryngology)',
    'Anesthesiology',
    'Pulmonology',
    'Rheumatology',
    'Immunology',
    'Emergency Medicine'
  ],
  'bds': [
    'Oral Surgery',
    'Orthodontics',
    'Periodontics',
    'Prosthodontics',
    'Pedodontics'
  ],
  'bams': [
    'Ayurvedic Medicine',
    'Panchakarma',
    'Herbal Sciences'
  ],
  'bhms': [
    'Homeopathy',
    'Clinical Practice'
  ],
  'bpt': [
    'Physiotherapy',
    'Sports Physiotherapy',
    'Neuro Rehabilitation',
    'Cardio-Pulmonary Physiotherapy'
  ],
  'md': [
    'Internal Medicine',
    'Pediatrics',
    'Surgery',
    'Orthopedics',
    'Cardiology',
    'Neurology',
    'Oncology',
    'Radiology',
    'Pathology',
    'Anesthesiology'
  ],
  'nursing': [
    'General Nursing',
    'Critical Care Nursing',
    'Pediatric Nursing',
    'Psychiatric Nursing',
    'Community Health Nursing'
  ],

  // Business & Economics
  'bba': [
    'General Management',
    'Finance',
    'Marketing',
    'Human Resources',
    'Logistics',
    'International Business'
  ],
  'bcom': [
    'Accounting',
    'Banking',
    'Taxation',
    'Finance',
    'Economics'
  ],
  'mba': [
    'Finance',
    'Marketing',
    'Human Resources',
    'Operations Management',
    'Business Analytics',
    'International Business',
    'Entrepreneurship',
    'IT Management',
    'Supply Chain Management',
    'Healthcare Management',
    'Hospitality Management',
    'Aviation Management',
    'Real Estate',
    'Energy Management',
    'Sustainability',
    'Agribusiness'
  ],
  'mcom': [
    'Advanced Accounting',
    'Corporate Finance',
    'Economics'
  ],

  // Arts & Sciences
  'ba': [
    'English Literature',
    'History',
    'Political Science',
    'Sociology',
    'Psychology',
    'Philosophy',
    'Economics',
    'Journalism & Mass Communication',
    'Anthropology',
    'Fine Arts',
    'Geography',
    'Linguistics',
    'French Language',
    'German Language',
    'Spanish Language',
    'Japanese Language',
    'Hindi Literature',
    'Sanskrit'
  ],
  'bsc': [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Statistics',
    'Computer Science',
    'Electronics',
    'Biotechnology',
    'Microbiology',
    'Zoology',
    'Botany',
    'Psychology',
    'Environmental Science',
    'Forensic Science',
    'Food Science & Technology',
    'Geology',
    'Biochemistry'
  ],
  'ma': [
    'English Literature',
    'History',
    'Political Science',
    'Sociology',
    'Psychology',
    'Philosophy',
    'Economics',
    'Journalism & Mass Communication',
    'Anthropology',
    'Fine Arts',
    'Geography',
    'Linguistics'
  ],
  'msc': [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Statistics',
    'Computer Science',
    'Electronics',
    'Biotechnology',
    'Microbiology',
    'Zoology',
    'Botany',
    'Environmental Science',
    'Forensic Science',
    'Food Science & Technology',
    'Data Science',
    'Bioinformatics'
  ],

  // Law & Public Policy
  'llb': [
    'Criminal Law',
    'Corporate Law',
    'International Law',
    'Constitutional Law',
    'Intellectual Property Law',
    'Cyber Law',
    'Environmental Law',
    'Human Rights Law',
    'Labor Law'
  ],
  'llm': [
    'Advanced Corporate Law',
    'Comparative Law',
    'Human Rights',
    'Maritime Law',
    'International Trade Law',
    'Tax Law'
  ],
  'jd': [
    'Professional Doctorate in Law'
  ],

  // Architecture & Design
  'barch': [
    'Urban Planning',
    'Interior Design',
    'Landscape Architecture',
    'Sustainable Architecture',
    'Construction Management'
  ],
  'bdes': [
    'Fashion Design',
    'Graphic Design',
    'Industrial Design',
    'Product Design',
    'Animation',
    'Game Design',
    'Textile Design',
    'UI/UX Design',
    'Interior Design'
  ],
  'march': [
    'Advanced Urban Planning',
    'Smart Cities',
    'Green Architecture',
    'Heritage Conservation'
  ],
  'mdes': [
    'Product Innovation',
    'Interaction Design',
    'Advanced Animation',
    'Luxury Design',
    'Design Research'
  ],

  // Agriculture & Veterinary
  'bsc_agri': [
    'Agronomy',
    'Horticulture',
    'Soil Science',
    'Crop Science',
    'Plant Genetics',
    'Food Technology'
  ],
  'bvsc': [
    'Animal Husbandry',
    'Veterinary Surgery',
    'Dairy Science'
  ],
  'msc_agri': [
    'Advanced Crop Science',
    'Agro-Ecology',
    'Genetic Engineering',
    'Sustainable Agriculture'
  ],

  // Hospitality & Tourism
  'bhm': [
    'Hotel Management',
    'Culinary Arts',
    'Catering Technology',
    'Food Production'
  ],
  'bttm': [
    'Travel & Tourism',
    'Event Management'
  ],
  'aviation': [
    'Pilot Training',
    'Aeronautical Management',
    'Air Traffic Control',
    'Airport Operations'
  ],

  // Performing & Fine Arts
  'bfa': [
    'Painting',
    'Sculpture',
    'Applied Arts',
    'Photography'
  ],
  'music': [
    'Classical Music',
    'Western Music',
    'Instrumental Music',
    'Vocal Music',
    'Musicology'
  ],
  'dance': [
    'Classical Dance',
    'Modern Dance',
    'Choreography'
  ],

  // PhD & Research
  'phd': [
    'Engineering Research',
    'Medical Research',
    'Management Research',
    'Science Research',
    'Humanities Research',
    'Legal Research',
    'Architecture Research',
    'Agriculture Research',
    'Design Research',
    'Arts Research'
  ],

  // Others
  'certificate': [
    'Digital Marketing',
    'Data Analytics',
    'Cybersecurity',
    'Cloud Computing',
    'Project Management',
    'Financial Planning',
    'Interior Design',
    'Culinary Arts',
    'Photography',
    'Foreign Languages'
  ],
  'diploma': [
    'Computer Applications',
    'Electronics',
    'Mechanical Engineering',
    'Civil Engineering',
    'Hotel Management',
    'Fashion Design',
    'Mass Communication'
  ],
  'other': [
    'Custom Field of Study'
  ]
};

const YEARS_IN_COLLEGE = [
  'First Year (Freshman)',
  'Second Year (Sophomore)',
  'Third Year (Junior)',
  'Fourth Year (Senior)',
  'Graduate Student',
  'Recently Graduated (0-1 year)',
  'Other'
];

export default function EducationDetailsScreen({ navigation, route }) {
  const [formData, setFormData] = useState({
    college: null,
    customCollege: '',
    degreeType: '',
    fieldOfStudy: '',
    yearInCollege: '',
    selectedCountry: 'India',
  });
  
  const [allColleges, setAllColleges] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [error, setError] = useState(null);
  
  // ?? CRITICAL FIX: Single search term with modal type tracking
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'college', 'country', 'degree', 'field', 'year'
  
  // ?? CRITICAL FIX: Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // ?? CRITICAL FIX: Prevent modal state conflicts
  const modalRefs = useRef({
    college: false,
    country: false,
    degree: false,
    field: false,
    year: false
  });
  
  const { userType, experienceType, workExperienceData } = route.params;

  useEffect(() => {
    loadCountries();
    loadColleges();
  }, []);

  useEffect(() => {
    if (formData.selectedCountry) {
      loadColleges();
    }
  }, [formData.selectedCountry]);

  const loadCountries = async () => {
    try {
      setLoadingCountries(true);
      console.log('?? Loading countries from API...');
      
      const response = await nexhireAPI.getCountries();
      
      if (response.success && response.data.countries) {
        const transformedCountries = response.data.countries.map(country => ({
          code: country.name,
          name: country.name,
          flag: country.flag,
          region: country.region,
          id: country.id
        }));
        
        setCountries(transformedCountries);
        console.log(`? Loaded ${transformedCountries.length} countries with flag emojis`);
      } else {
        throw new Error(response.error || 'Failed to load countries');
      }
    } catch (error) {
      console.error('? Error loading countries:', error);
      
      const fallbackCountries = [
        { code: 'India', name: 'India', flag: '????', region: 'Asia' },
        { code: 'United States', name: 'United States', flag: '????', region: 'Americas' },
        { code: 'United Kingdom', name: 'United Kingdom', flag: '????', region: 'Europe' },
        { code: 'Canada', name: 'Canada', flag: '????', region: 'Americas' },
        { code: 'Australia', name: 'Australia', flag: '????', region: 'Oceania' },
        { code: 'Germany', name: 'Germany', flag: '????', region: 'Europe' },
        { code: 'France', name: 'France', flag: '????', region: 'Europe' },
        { code: 'Singapore', name: 'Singapore', flag: '????', region: 'Asia' },
      ];
      
      setCountries(fallbackCountries);
      console.log('?? Using fallback countries due to API error');
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadColleges = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`?? Loading colleges for country: ${formData.selectedCountry}`);
      
      const response = await nexhireAPI.getColleges(formData.selectedCountry);
      
      if (response.success) {
        const transformedColleges = response.data.map(institution => ({
          id: institution.id,
          name: institution.name,
          type: institution.type,
          country: institution.country,
          state: institution.state,
          city: institution.city,
          website: institution.website,
          domains: institution.domains || [],
          establishedYear: institution.establishedYear,
          globalRanking: institution.globalRanking,
          description: institution.description,
          alpha_two_code: institution.alpha_two_code
        }));
        
        setAllColleges(transformedColleges);
        console.log(`? Loaded ${transformedColleges.length} colleges`);
      } else {
        throw new Error(response.error || 'Failed to load educational institutions');
      }
    } catch (error) {
      console.error('? Error loading colleges:', error);
      setError(error.message);
      
      const fallbackColleges = [
        { id: 999999, name: 'Other', type: 'Other', country: 'Various' }
      ];
      setAllColleges(fallbackColleges);
    } finally {
      setLoading(false);
    }
  };

  // ?? CRITICAL FIX: Memoized filtering with proper dependencies
  const filteredData = React.useMemo(() => {
    if (activeModal === 'college') {
      if (!debouncedSearchTerm.trim()) return allColleges;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return allColleges.filter(college => 
        college.name.toLowerCase().includes(searchLower) ||
        (college.country && college.country.toLowerCase().includes(searchLower)) ||
        (college.state && college.state.toLowerCase().includes(searchLower)) ||
        (college.type && college.type.toLowerCase().includes(searchLower))
      );
    } else if (activeModal === 'country') {
      if (!debouncedSearchTerm.trim()) return countries;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return countries.filter(country =>
        country.name.toLowerCase().includes(searchLower) ||
        (country.region && country.region.toLowerCase().includes(searchLower))
      );
    } else if (activeModal === 'degree') {
      if (!debouncedSearchTerm.trim()) {
        // Group degrees by category for better organization
        const groupedDegrees = DEGREE_TYPES.reduce((acc, degree) => {
          if (!acc[degree.category]) {
            acc[degree.category] = [];
          }
          acc[degree.category].push(degree);
          return acc;
        }, {});
        
        // Flatten with category headers
        const result = [];
        Object.keys(groupedDegrees).forEach(category => {
          result.push({ type: 'header', category });
          result.push(...groupedDegrees[category]);
        });
        return result;
      }
      
      const searchLower = debouncedSearchTerm.toLowerCase();
      return DEGREE_TYPES.filter(degree => 
        degree.name.toLowerCase().includes(searchLower) ||
        degree.category.toLowerCase().includes(searchLower)
      );
    } else if (activeModal === 'field') {
      // Get fields based on selected degree
      const selectedDegree = DEGREE_TYPES.find(d => d.name === formData.degreeType);
      const availableFields = selectedDegree ? FIELDS_OF_STUDY[selectedDegree.id] || [] : [];
      
      if (!debouncedSearchTerm.trim()) return availableFields;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return availableFields.filter(field => field.toLowerCase().includes(searchLower));
    } else if (activeModal === 'year') {
      if (!debouncedSearchTerm.trim()) return YEARS_IN_COLLEGE;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return YEARS_IN_COLLEGE.filter(year => year.toLowerCase().includes(searchLower));
    }
    return [];
  }, [activeModal, debouncedSearchTerm, allColleges, countries, formData.degreeType]);

  const handleContinue = async () => {
    if (!formData.college && !formData.customCollege) {
      Alert.alert('Required Field', 'Please select your college/school');
      return;
    }
    if (!formData.degreeType) {
      Alert.alert('Required Field', 'Please select your degree type');
      return;
    }
    if (!formData.fieldOfStudy) {
      Alert.alert('Required Field', 'Please select your field of study');
      return;
    }
    if (experienceType === 'Student' && !formData.yearInCollege) {
      Alert.alert('Required Field', 'Please select your current year');
      return;
    }

    const finalFormData = {
      ...formData,
      yearInCollege: experienceType === 'Student' ? formData.yearInCollege : 'Recently Graduated (0-1 year)'
    };

    console.log('?? Education data prepared for registration:', finalFormData);
    
    navigation.navigate('JobPreferencesScreen', { 
      userType, 
      experienceType,
      workExperienceData,
      educationData: finalFormData
    });
  };

  // ?? CRITICAL FIX: Unified modal control functions
  const openModal = (modalType) => {
    setActiveModal(modalType);
    setSearchTerm('');
    modalRefs.current[modalType] = true;
  };

  const closeModal = () => {
    const currentModal = activeModal;
    setActiveModal(null);
    setSearchTerm('');
    if (currentModal) {
      modalRefs.current[currentModal] = false;
    }
  };

  // ?? CRITICAL FIX: Safe selection handlers
  const handleSelection = (item, type) => {
    switch (type) {
      case 'country':
        setFormData({ 
          ...formData, 
          selectedCountry: item.code,
          college: null,
          customCollege: ''
        });
        break;
      case 'college':
        setFormData({ ...formData, college: item, customCollege: '' });
        break;
      case 'degree':
        // Reset field of study when degree changes since fields are degree-dependent
        setFormData({ 
          ...formData, 
          degreeType: typeof item === 'string' ? item : item.name,
          fieldOfStudy: '' // Reset field when degree changes
        });
        break;
      case 'field':
        setFormData({ ...formData, fieldOfStudy: item });
        break;
      case 'year':
        setFormData({ ...formData, yearInCollege: item });
        break;
    }
    closeModal();
  };

  // ?? CRITICAL FIX: Render item function with proper keys
  const renderModalItem = ({ item, index }) => {
    // Handle category headers for degree types
    if (item.type === 'header') {
      return (
        <View key={`header-${item.category}`} style={styles.categoryHeader}>
          <Text style={styles.categoryHeaderText}>{item.category}</Text>
        </View>
      );
    }

    const isCountry = activeModal === 'country';
    const isCollege = activeModal === 'college';
    const isDegree = activeModal === 'degree';
    const isString = typeof item === 'string';

    return (
      <TouchableOpacity
        key={`${activeModal}-${isString ? item : item.id || item.code}-${index}`}
        style={styles.modalItem}
        onPress={() => handleSelection(item, activeModal)}
        activeOpacity={0.7}
      >
        <View style={styles.modalItemContent}>
          <Text style={styles.modalItemText}>
            {isCountry ? `${item.flag} ${item.name}` : 
             isDegree ? item.name :
             isString ? item : item.name}
          </Text>
          {isDegree && item.category && !debouncedSearchTerm && (
            <Text style={styles.modalItemType}>{item.category}</Text>
          )}
          {isCollege && item.type && (
            <Text style={styles.modalItemType}>{item.type}</Text>
          )}
          {isCollege && item.state && item.country && (
            <Text style={styles.modalItemLocation}>
              {item.state}, {item.country}
            </Text>
          )}
          {isCollege && item.website && (
            <Text style={styles.modalItemWebsite} numberOfLines={1}>
              {item.website}
            </Text>
          )}
          {isCountry && item.region && (
            <Text style={styles.modalItemRegion}>{item.region}</Text>
          )}
        </View>
        {isCollege && item.id === 999999 && (
          <Ionicons name="add-circle" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const SelectionButton = ({ label, value, onPress, placeholder, disabled = false }) => (
    <TouchableOpacity 
      style={[
        styles.selectionButton,
        disabled && styles.selectionButtonDisabled
      ]} 
      onPress={disabled ? null : onPress}
      disabled={disabled}
    >
      <Text style={[
        styles.selectionLabel,
        disabled && styles.selectionLabelDisabled
      ]}>
        {label}
      </Text>
      <View style={styles.selectionValueContainer}>
        <Text style={[
          styles.selectionValue,
          !value && styles.selectionPlaceholder,
          disabled && styles.selectionValueDisabled
        ]}>
          {value || placeholder}
        </Text>
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color={disabled ? colors.gray300 : colors.gray500} 
        />
      </View>
    </TouchableOpacity>
  );

  const getCollegeDisplayText = () => {
    if (formData.college) {
      let text = formData.college.name;
      if (formData.college.state && formData.college.country !== 'Various') {
        text += ` (${formData.college.state}, ${formData.college.country})`;
      } else if (formData.college.country && formData.college.country !== 'Various') {
        text += ` (${formData.college.country})`;
      }
      return text;
    }
    return formData.customCollege || null;
  };

  const getSelectedCountryDisplay = () => {
    const country = countries.find(c => c.code === formData.selectedCountry);
    return country ? `${country.flag} ${country.name}` : formData.selectedCountry;
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'country': return 'Select Country/Region';
      case 'college': return `Universities in ${formData.selectedCountry}`;
      case 'degree': return 'Select Degree Type';
      case 'field': return 'Select Field of Study';
      case 'year': return 'Select Current Year';
      default: return '';
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeModal) {
      case 'country': return 'Search countries...';
      case 'college': return 'Search universities...';
      case 'degree': return 'Search degree types...';
      case 'field': return 'Search fields...';
      case 'year': return 'Search years...';
      default: return 'Search...';
    }
  };

  const shouldShowSearch = () => {
    return activeModal === 'country' || activeModal === 'college' || activeModal === 'degree' || activeModal === 'field' || activeModal === 'year';
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            
            <Text style={styles.title}>Tell us about your education</Text>
            <Text style={styles.subtitle}>
              Search from thousands of universities worldwide using our real-time database
            </Text>
          </View>

          <View style={styles.form}>
            <SelectionButton
              label="Country/Region"
              value={getSelectedCountryDisplay()}
              placeholder="Select country"
              onPress={() => openModal('country')}
            />

            <SelectionButton
              label="College/University *"
              value={getCollegeDisplayText()}
              placeholder="Search and select your institution"
              onPress={() => openModal('college')}
            />

            <SelectionButton
              label="Degree Type *"
              value={formData.degreeType}
              placeholder="Select degree type"
              onPress={() => openModal('degree')}
            />

            <SelectionButton
              label="Field of Study *"
              value={formData.fieldOfStudy}
              placeholder={
                formData.degreeType 
                  ? `Select field for ${formData.degreeType}` 
                  : "Select degree type first"
              }
              onPress={() => {
                if (!formData.degreeType) {
                  Alert.alert('Select Degree First', 'Please select your degree type before choosing field of study');
                  return;
                }
                openModal('field');
              }}
              disabled={!formData.degreeType}
            />

            {experienceType === 'Student' && (
              <SelectionButton
                label="Current Year *"
                value={formData.yearInCollege}
                placeholder="Select your current year"
                onPress={() => openModal('year')}
              />
            )}

            {formData.college?.name === 'Other' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>College/School Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your college/school name"
                  value={formData.customCollege}
                  onChangeText={(text) => setFormData({ ...formData, customCollege: text })}
                />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ?? CRITICAL FIX: Single Universal Modal */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{getModalTitle()}</Text>
            {activeModal === 'college' && (
              <TouchableOpacity onPress={loadColleges} disabled={loading}>
                <Ionicons 
                  name="refresh" 
                  size={24} 
                  color={loading ? colors.gray400 : colors.primary} 
                />
              </TouchableOpacity>
            )}
            {activeModal === 'country' && (
              <TouchableOpacity onPress={loadCountries} disabled={loadingCountries}>
                <Ionicons 
                  name="refresh" 
                  size={24} 
                  color={loadingCountries ? colors.gray400 : colors.primary} 
                />
              </TouchableOpacity>
            )}
            {activeModal !== 'college' && activeModal !== 'country' && (
              <View style={{ width: 24 }} />
            )}
          </View>

          {shouldShowSearch() && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.gray500} />
              <TextInput
                style={styles.searchInput}
                placeholder={getSearchPlaceholder()}
                value={searchTerm}
                onChangeText={setSearchTerm}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus={false}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSearchTerm('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color={colors.gray400} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {((loading && activeModal === 'college') || (loadingCountries && activeModal === 'country')) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {activeModal === 'country' ? 'Loading countries with flag emojis...' : `Loading universities from ${formData.selectedCountry}...`}
              </Text>
            </View>
          )}

          {error && activeModal === 'college' && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={24} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadColleges}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!((loading && activeModal === 'college') || (loadingCountries && activeModal === 'country')) && !error && (
            <FlatList
              data={filteredData}
              keyExtractor={(item, index) => `${activeModal}-${typeof item === 'string' ? item : item.id || item.code}-${index}`}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={renderModalItem}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons 
                    name={activeModal === 'country' ? "earth" : "school"} 
                    size={48} 
                    color={colors.gray400} 
                  />
                  <Text style={styles.emptyText}>
                    {debouncedSearchTerm ? `No items found for "${debouncedSearchTerm}"` : 'No items available'}
                  </Text>
                  {debouncedSearchTerm && (
                    <Text style={styles.emptySubtext}>
                      Try searching with different keywords
                    </Text>
                  )}
                </View>
              )}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: 80,
                offset: 80 * index,
                index,
              })}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.gray600,
    lineHeight: 22,
  },
  form: {
    gap: 20,
    marginBottom: 32,
  },
  selectionButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionButtonDisabled: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray200,
  },
  selectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
    marginBottom: 8,
  },
  selectionLabelDisabled: {
    color: colors.gray400,
  },
  selectionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionValue: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    flex: 1,
  },
  selectionValueDisabled: {
    color: colors.gray400,
  },
  selectionPlaceholder: {
    color: colors.gray400,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  continueButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.gray600,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 80,
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalItemType: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    marginBottom: 2,
  },
  modalItemLocation: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 2,
  },
  modalItemWebsite: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    marginBottom: 2,
  },
  modalItemRegion: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 8,
  },
  categoryHeader: {
    backgroundColor: colors.primary + '10',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryHeaderText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldHelpContainer: {
    backgroundColor: colors.gray50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldHelpText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    textAlign: 'center',
  },
});