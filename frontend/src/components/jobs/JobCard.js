import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const resolveNameById = (list, id, idKey, nameKey) => {
  if (!id) return '';
  const row = (list || []).find(x => String(x[idKey]) === String(id));
  return row ? (row[nameKey] || '') : '';
};

const JobCard = ({ job, onPress, jobTypes = [], workplaceTypes = [], onApply, onSave, onUnsave, onAskReferral, savedContext = false, isReferred = false, isSaved = false }) => {
  if (!job) return null;
  const title = job.Title || 'Untitled Job';
  const org = job.OrganizationName || 'Unknown Company';
  const logo = job.OrganizationLogo || job.organizationLogo || '';
  
  const parts = [];
  if (job.City) parts.push(job.City);
  if (job.State) parts.push(job.State);
  if (job.Country) parts.push(job.Country);
  const loc = parts.join(', ') || job.Location || 'Location not specified';

  const posted = (() => {
    const ds = job.PublishedAt || job.CreatedAt || job.UpdatedAt;
    if (!ds) return 'Recently posted';
    const d = new Date(ds); const now = new Date();
    const h = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (h < 1) return 'Just posted';
    if (h < 24) return `${h} hours ago`;
    const days = Math.floor(h / 24); if (days < 7) return `${days} days ago`;
    const w = Math.floor(days / 7); if (w < 4) return `${w} weeks ago`;
    return d.toLocaleDateString();
  })();

  const jobTypeName = job.JobTypeName || resolveNameById(jobTypes, job.JobTypeID, 'JobTypeID', 'Type');
  const workplaceName = job.WorkplaceTypeName || resolveNameById(workplaceTypes, job.WorkplaceTypeID, 'WorkplaceTypeID', 'Type') || (job.WorkplaceType || (job.IsRemote ? 'Remote' : ''));

  const hasSalary = job.SalaryRangeMin != null && job.SalaryRangeMax != null;
  const salaryText = hasSalary
    ? `$${Number(job.SalaryRangeMin).toLocaleString()} - $${Number(job.SalaryRangeMax).toLocaleString()} ${job.SalaryPeriod || 'Annual'}`
    : '';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {/* 🏢 Company Logo */}
          <View style={styles.logoContainer}>
            {logo ? (
              <Image 
                source={{ uri: logo }} 
                style={styles.logo}
                onError={() => console.log('Logo load error for:', org)}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business-outline" size={20} color="#666" />
              </View>
            )}
          </View>
          
          {/* Job Title and Company */}
          <View style={styles.titleContent}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.company} numberOfLines={1}>{org}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{loc}</Text>
        <Text style={styles.dot}> • </Text>
        <Text style={styles.meta}>{posted}</Text>
      </View>

      {(jobTypeName || workplaceName) && (
        <View style={styles.metaRowAlt}>
          {jobTypeName ? (<Text style={styles.metaBadge}>{jobTypeName}</Text>) : null}
          {workplaceName ? (<Text style={styles.metaBadge}>{workplaceName}</Text>) : null}
        </View>
      )}

      {/* Salary row - separate from buttons */}
      {hasSalary && (
        <View style={styles.salaryRow}>
          <Text style={styles.salary} numberOfLines={1}>{salaryText}</Text>
        </View>
      )}

      {/* Actions row - moved to separate line */}
      <View style={styles.actionsRow}>
        {/* 🔧 FIXED: Dynamic save/unsave button based on saved state */}
        {savedContext ? (
          // In saved tab context, always show "Saved" pill with unsave functionality
          <TouchableOpacity style={styles.savedPill} onPress={onUnsave} accessibilityLabel="Remove from saved">
            <Ionicons name="bookmark" size={18} color="#0d47a1" />
            <Text style={styles.saveText}>Saved</Text>
          </TouchableOpacity>
        ) : isSaved ? (
          // In openings tab, if already saved, show "Saved" pill with unsave functionality
          <TouchableOpacity style={styles.savedPill} onPress={onUnsave} accessibilityLabel="Remove from saved">
            <Ionicons name="bookmark" size={18} color="#0d47a1" />
            <Text style={styles.saveText}>Saved</Text>
          </TouchableOpacity>
        ) : (
          // In openings tab, if not saved, show "Save" button
          <TouchableOpacity style={styles.saveBtn} onPress={onSave} accessibilityLabel="Save job">
            <Ionicons name="bookmark-outline" size={18} color="#0d47a1" />
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        )}

          {/* Always show "Ask Referral" or "Referred" - quota check happens on click */}
          {isReferred ? (
            <View style={styles.referredPill} accessibilityRole="text">
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.referredText}>Referred</Text>
            </View>
          ) : onAskReferral ? (
            <TouchableOpacity 
              style={styles.referralBtn} 
              onPress={onAskReferral} 
              accessibilityLabel="Ask for referral"
            >
              <Ionicons name="people-outline" size={18} color="#ff6600" />
              <Text style={styles.referralText}>Ask Referral</Text>
            </TouchableOpacity>
          ) : null}

           <TouchableOpacity style={styles.applyBtn} onPress={onApply} accessibilityLabel="Apply to job">
             <Ionicons name="paper-plane-outline" size={18} color="#fff" />
             <Text style={styles.applyText}>Apply</Text>
           </TouchableOpacity>
       </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  logoContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  company: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaRowAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    color: '#666',
  },
  metaBadge: {
    fontSize: 12,
    color: '#0d47a1',
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  dot: { color: '#bbb' },
  salary: {
    fontSize: 13,
    color: '#0b6',
    fontWeight: '600',
  },
  salaryRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10, // Reduced padding to fit 3 buttons
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10, // Reduced padding to fit 3 buttons
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  saveText: { color: '#0d47a1', marginLeft: 6, fontWeight: '600', fontSize: 13 },
  // NEW: Ask Referral button styles
  referralBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ff6600',
  },
  referralText: { color: '#ff6600', marginLeft: 6, fontWeight: '600', fontSize: 13 },
  // ✅ NEW: Referred status pill styles
  referredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  referredText: { color: '#10b981', marginLeft: 6, fontWeight: '600', fontSize: 13 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12, // Reduced padding to fit 3 buttons
    borderRadius: 8,
    backgroundColor: '#0066cc',
  },
  applyText: { color: '#fff', marginLeft: 6, fontWeight: '700', fontSize: 13 },
});

export default JobCard;
