import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import nexhireAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';

export default function JobDetailsScreen({ route, navigation }) {
  const { jobId } = route.params || {};
  const { user, isJobSeeker } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    } else {
      setLoading(false);
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const result = await nexhireAPI.getJobById(jobId);
      
      if (result.success) {
        setJob(result.data);
        // Check if user has already applied (if authenticated)
        if (user && isJobSeeker) {
          checkApplicationStatus();
        }
      } else {
        Alert.alert('Error', 'Job not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      Alert.alert('Error', 'Failed to load job details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      // Check if user has already applied by getting their applications
      const result = await nexhireAPI.getMyApplications(1, 100);
      if (result.success) {
        const hasAppliedToJob = result.data.some(app => app.JobID === jobId);
        setHasApplied(hasAppliedToJob);
      }
    } catch (error) {
      console.error('Error checking application status:', error);
    }
  };

  const handleApply = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to apply for jobs', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') }
      ]);
      return;
    }

    if (!isJobSeeker) {
      Alert.alert('Access Denied', 'Only job seekers can apply for positions');
      return;
    }

    if (hasApplied) {
      Alert.alert('Already Applied', 'You have already applied for this position');
      return;
    }

    Alert.alert(
      'Apply for Job',
      'Are you sure you want to apply for this position?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: submitApplication }
      ]
    );
  };

  const submitApplication = async () => {
    setApplying(true);
    try {
      // Prepare application data according to backend JobApplicationRequest interface
      const applicationData = {
        jobID: jobId,
        coverLetter: `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`,
        expectedSalary: job.SalaryRangeMax || null,
        expectedCurrencyID: job.CurrencyID || null,
        availableFromDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        availabilityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Both fields for compatibility
      };

      const result = await nexhireAPI.applyForJob(applicationData);
      
      if (result.success) {
        setHasApplied(true);
        Alert.alert(
          'Application Submitted',
          'Your application has been submitted successfully!',
          [
            { text: 'View Applications', onPress: () => navigation.navigate('Applications') },
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert('Application Failed', result.error || result.message || 'Failed to submit application');
      }
    } catch (error) {
      console.error('Application error:', error);
      Alert.alert('Error', error.message || 'Failed to submit application');
    } finally {
      setApplying(false);
    }
  };

  const formatSalary = () => {
    if (job.SalaryRangeMin && job.SalaryRangeMax) {
      const currency = job.CurrencyCode || 'USD';
      const period = job.SalaryPeriod || 'Annual';
      return `$${job.SalaryRangeMin?.toLocaleString()} - $${job.SalaryRangeMax?.toLocaleString()} ${currency} ${period}`;
    }
    return 'Salary not specified';
  };

  const formatLocation = () => {
    const locationParts = [];
    if (job.City) locationParts.push(job.City);
    if (job.State) locationParts.push(job.State);
    if (job.Country) locationParts.push(job.Country);
    
    let location = locationParts.join(', ') || job.Location || 'Location not specified';
    
    if (job.IsRemote) {
      location += ' (Remote)';
    } else if (job.WorkplaceType) {
      location += ` (${job.WorkplaceType})`;
    }
    
    return location;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  const Section = ({ title, content, list = null }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {content && <Text style={styles.sectionContent}>{content}</Text>}
      {list && list.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
        <Text style={styles.errorTitle}>Job Not Found</Text>
        <Text style={styles.errorText}>The job you're looking for could not be found.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Parse lists from text fields
  const requirementsList = job.Requirements 
    ? job.Requirements.split('\n').filter(req => req.trim().length > 0)
    : [];
  const benefitsList = job.BenefitsOffered 
    ? job.BenefitsOffered.split('\n').filter(benefit => benefit.trim().length > 0)
    : [];
  const responsibilitiesList = job.Responsibilities 
    ? job.Responsibilities.split('\n').filter(resp => resp.trim().length > 0)
    : [];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{job.Title}</Text>
        <Text style={styles.company}>{job.OrganizationName || 'Company Name'}</Text>
        <Text style={styles.salary}>{formatSalary()}</Text>
        
        {/* Status tags */}
        <View style={styles.tagsContainer}>
          <Text style={styles.tag}>{job.JobTypeName || 'Full-time'}</Text>
          {job.ExperienceLevel && (
            <Text style={[styles.tag, styles.experienceTag]}>{job.ExperienceLevel}</Text>
          )}
          {job.IsRemote && (
            <Text style={[styles.tag, styles.remoteTag]}>Remote</Text>
          )}
          <Text style={[styles.tag, styles.statusTag]}>{job.Status || 'Active'}</Text>
        </View>
      </View>

      {/* Quick Info */}
      <View style={styles.infoSection}>
        <InfoRow
          icon="location"
          label="Location"
          value={formatLocation()}
        />
        <InfoRow
          icon="briefcase"
          label="Job Type"
          value={job.JobTypeName || 'Full-time'}
        />
        <InfoRow
          icon="time"
          label="Posted"
          value={formatDate(job.CreatedAt || job.PublishedAt)}
        />
        <InfoRow
          icon="calendar"
          label="Application Deadline"
          value={formatDate(job.ApplicationDeadline)}
        />
        {job.ExperienceMin || job.ExperienceMax ? (
          <InfoRow
            icon="school"
            label="Experience Required"
            value={`${job.ExperienceMin || 0}-${job.ExperienceMax || '+'} years`}
          />
        ) : null}
      </View>

      {/* Job Description */}
      {job.Description && (
        <Section
          title="Job Description"
          content={job.Description}
        />
      )}

      {/* Responsibilities */}
      {responsibilitiesList.length > 0 && (
        <Section
          title="Key Responsibilities"
          list={responsibilitiesList}
        />
      )}

      {/* Requirements */}
      {requirementsList.length > 0 && (
        <Section
          title="Requirements"
          list={requirementsList}
        />
      )}

      {/* Preferred Qualifications */}
      {job.PreferredQualifications && (
        <Section
          title="Preferred Qualifications"
          content={job.PreferredQualifications}
        />
      )}

      {/* Benefits */}
      {benefitsList.length > 0 && (
        <Section
          title="Benefits"
          list={benefitsList}
        />
      )}

      {/* Additional Information */}
      {(job.RequiredEducation || job.RequiredCertifications) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Requirements</Text>
          {job.RequiredEducation && (
            <View style={styles.additionalInfo}>
              <Text style={styles.additionalLabel}>Education:</Text>
              <Text style={styles.additionalValue}>{job.RequiredEducation}</Text>
            </View>
          )}
          {job.RequiredCertifications && (
            <View style={styles.additionalInfo}>
              <Text style={styles.additionalLabel}>Certifications:</Text>
              <Text style={styles.additionalValue}>{job.RequiredCertifications}</Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.saveButton}>
          <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
          <Text style={styles.saveButtonText}>Save Job</Text>
        </TouchableOpacity>
        
        {isJobSeeker && (
          <TouchableOpacity 
            style={[
              styles.applyButton, 
              (hasApplied || applying) && styles.applyButtonDisabled
            ]} 
            onPress={handleApply}
            disabled={hasApplied || applying}
          >
            {applying && <ActivityIndicator size="small" color={colors.white} />}
            <Text style={styles.applyButtonText}>
              {applying ? 'Applying...' : hasApplied ? 'Already Applied' : 'Apply Now'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  header: {
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  company: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    color: colors.gray700,
    marginBottom: 4,
  },
  salary: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  experienceTag: {
    color: colors.success,
    backgroundColor: colors.success + '20',
  },
  remoteTag: {
    color: colors.warning,
    backgroundColor: colors.warning + '20',
  },
  statusTag: {
    color: colors.gray600,
    backgroundColor: colors.gray200,
  },
  infoSection: {
    padding: 20,
    backgroundColor: colors.surface,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  section: {
    padding: 20,
    backgroundColor: colors.surface,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  sectionContent: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  additionalInfo: {
    marginBottom: 12,
  },
  additionalLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
    marginBottom: 4,
  },
  additionalValue: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  saveButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginLeft: 8,
  },
  applyButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  applyButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
});