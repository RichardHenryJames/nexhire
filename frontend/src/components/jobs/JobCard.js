import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const resolveNameById = (list, id, idKey, nameKey) => {
  if (!id) return '';
  const row = (list || []).find(x => String(x[idKey]) === String(id));
  return row ? (row[nameKey] || '') : '';
};

const JobCard = ({ job, onPress, jobTypes = [], workplaceTypes = [], onApply, onSave, savedContext = false }) => {
  if (!job) return null;
  const title = job.Title || 'Untitled Job';
  const org = job.OrganizationName || 'Unknown Company';
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
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.company} numberOfLines={1}>{org}</Text>
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

      {/* Footer row: salary on left, actions on right */}
      <View style={styles.footerRow}>
        <View style={{ flexShrink: 1 }}>
          {hasSalary ? (<Text style={styles.salary} numberOfLines={1}>{salaryText}</Text>) : null}
        </View>
        <View style={styles.actionsInline}>
          {savedContext ? (
            <View style={styles.savedPill} accessibilityRole="text">
              <Ionicons name="bookmark" size={18} color="#0d47a1" />
              <Text style={styles.saveText}>Saved</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={onSave} accessibilityLabel="Save job">
              <Ionicons name="bookmark-outline" size={18} color="#0d47a1" />
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.applyBtn} onPress={onApply} accessibilityLabel="Apply to job">
            <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  company: {
    fontSize: 14,
    color: '#444',
    marginTop: 2,
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
  footerRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    marginRight: 10,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    marginRight: 10,
  },
  saveText: { color: '#0d47a1', marginLeft: 6, fontWeight: '600', fontSize: 13 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0066cc',
  },
  applyText: { color: '#fff', marginLeft: 6, fontWeight: '700', fontSize: 13 },
});

export default JobCard;
