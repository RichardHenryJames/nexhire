import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CachedImage from '../CachedImage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const resolveNameById = (list, id, idKey, nameKey) => {
  if (!id) return '';
  const row = (list || []).find(x => String(x[idKey]) === String(id));
  return row ? (row[nameKey] || '') : '';
};

const JobCard = ({ 
  job, 
  onPress, 
  jobTypes = [], 
  workplaceTypes = [], 
  onApply, 
  onSave, 
  onUnsave, 
  onAskReferral, 
  savedContext = false, 
  isReferred = false, 
  isSaved = false,
  // NEW: show requesting state while API pending
  isReferralRequesting = false,
  // Props to hide action buttons for employer context
  hideApply = false,
  hideSave = false,
  hideReferral = false,
  // ✅ NEW: Props for employer publish action
  onPublish = null,
  showPublish = false,
  // ✅ NEW: Props for delete action
  onDelete = null,
  showDelete = false,
  // ✅ NEW: Props for share/copy action
  onShare = null,
  onShareWhatsApp = null,
  onShareLinkedIn = null,
  showShare = false,
  // ✅ NEW: Current user ID to hide Ask Referral for own posted jobs
  currentUserId = null,
  // Desktop mode for enhanced card styling
  isDesktop = false,
  // ✅ NEW: Show "Applied" badge instead of Apply button
  isApplied = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDesktop), [colors, isDesktop]);
  
  if (!job) return null;
  
  // PostedByType: 0 = Scraped, 1 = Employer posted, 2 = Referrer posted
  // For referrer-posted jobs, hide Apply and show Ask Referral only
  const isReferrerPosted = job.PostedByType === 2;
  
  // Check if this job was posted by the current user (hide Ask Referral for own jobs)
  const isOwnPostedJob = currentUserId && job.PostedByUserID && currentUserId === job.PostedByUserID;
  
  const title = job.Title || 'Untitled Job';
  const org = job.OrganizationName || 'Unknown Company';
  const logo = job.OrganizationLogo || job.organizationLogo || '';
  
  const parts = [];
  if (job.City) parts.push(job.City);
  if (job.State) parts.push(job.State);
  const loc = job.Location || parts.join(', ') || job.Country || 'Location not specified';

  const posted = (() => {
    const ds = job.PublishedAt || job.CreatedAt || job.UpdatedAt;
    if (!ds) return 'Recently posted';
    const d = new Date(ds); const now = new Date();
    const h = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (h < 1) return 'Just posted';
    if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
    const days = Math.floor(h / 24); if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    const w = Math.floor(days / 7); if (w < 4) return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
    return d.toLocaleDateString();
  })();

  const jobTypeName = job.JobTypeName || resolveNameById(jobTypes, job.JobTypeID, 'JobTypeID', 'Type');
  const workplaceName = job.WorkplaceTypeName || resolveNameById(workplaceTypes, job.WorkplaceTypeID, 'WorkplaceTypeID', 'Type') || (job.WorkplaceType || (job.IsRemote ? 'Remote' : ''));

  // ✅ NEW: Check if we should show any actions row
  const showActions = !hideApply || !hideSave || !hideReferral || showPublish || showDelete || showShare;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <View style={styles.titleRow}>
        {/* Company Logo */}
        <View style={styles.logoContainer}>
          {logo ? (
            <CachedImage 
              source={{ uri: logo }} 
              style={styles.logo}
            />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="business" size={20} color={colors.primary} />
            </View>
          )}
        </View>
        
        {/* Job Details */}
        <View style={styles.titleContent}>
          <View style={styles.titleHeader}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
          <Text style={styles.company} numberOfLines={1}>{org}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.gray500 || colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>{loc}</Text>
            </View>
          </View>
          {(job.ExperienceMin != null || job.ExperienceMax != null) && (
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="briefcase-outline" size={12} color={colors.gray500 || colors.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {job.ExperienceMin != null && job.ExperienceMax != null
                    ? `${job.ExperienceMin} - ${job.ExperienceMax} years exp`
                    : job.ExperienceMin != null
                      ? `${job.ExperienceMin}+ years exp`
                      : `Up to ${job.ExperienceMax} years exp`}
                </Text>
              </View>
            </View>
          )}
          {/* Job type & workplace badges — below experience */}
          {(jobTypeName || workplaceName) && (
            <View style={styles.badgeRow}>
              {jobTypeName ? (<Text style={styles.metaBadge}>{jobTypeName}</Text>) : null}
              {workplaceName ? (<Text style={styles.metaBadge}>{workplaceName}</Text>) : null}
            </View>
          )}
          {/* FOMO insight — contextual urgency/social proof */}
          {(() => {
            const ds = job.PublishedAt || job.CreatedAt;
            const hoursAgo = ds ? Math.floor((Date.now() - new Date(ds).getTime()) / (1000 * 60 * 60)) : 999;
            const isElite = job.OrganizationTier === 'Elite' || job.IsFortune500;
            const hasSalary = job.SalaryRangeMin || job.SalaryRangeMax;
            const isFresher = job.ExperienceMin === 0 || job.ExperienceMin == null;
            const isRemote = job.IsRemote;
            let fomoText = null;
            let fomoColor = colors.success || '#22c55e';
            if (hoursAgo < 24) { fomoText = '\u26A1 Be an early applicant'; }
            else if (hoursAgo < 72) { fomoText = '\ud83d\udd25 Posted recently'; fomoColor = colors.primary; }
            else if (hoursAgo < 168) { fomoText = '\ud83d\udcc8 Actively hiring'; fomoColor = colors.primary; }
            else if (isFresher) { fomoText = '\ud83c\udfaf Open to freshers'; }
            else if (isRemote) { fomoText = '\ud83c\udf0d Work from anywhere'; fomoColor = colors.info || '#06b6d4'; }
            else if (isElite) { fomoText = '\ud83c\udfe2 Top MNC \u2022 High response rate'; fomoColor = colors.warning || '#f59e0b'; }
            else if (hasSalary) { fomoText = '\ud83d\udcb0 Salary disclosed'; }
            if (!fomoText) return null;
            return <Text style={[styles.fomoText, { color: fomoColor }]}>{fomoText}</Text>;
          })()}
        </View>
      </View>

      {/* ✅ UPDATED: Show actions row if any action is visible OR if publish button should show */}
      {showActions && (
        <View style={styles.actionsRow}>
          {/* Save button - only show if not hidden (icon only, no text) */}
          {!hideSave && (
            savedContext ? (
              <TouchableOpacity style={styles.savedPill} onPress={onUnsave} accessibilityLabel="Remove from saved">
                <Ionicons name="bookmark" size={14} color={colors.white} />
              </TouchableOpacity>
            ) : isSaved ? (
              <TouchableOpacity style={styles.savedPill} onPress={onUnsave} accessibilityLabel="Remove from saved">
                <Ionicons name="bookmark" size={14} color={colors.white} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.saveBtn} onPress={onSave} accessibilityLabel="Save job">
                <Ionicons name="bookmark-outline" size={14} color={colors.primary} />
              </TouchableOpacity>
            )
          )}

          {/* Referral button / states - hide for own posted jobs */}
          {!hideReferral && !isOwnPostedJob && (
            isReferralRequesting ? (
              <View style={styles.requestingPill} accessibilityRole="text">
                <Ionicons name="time-outline" size={14} color={colors.warning} />
                <Text style={styles.requestingText}>Requesting</Text>
              </View>
            ) : isReferred ? (
              <View style={styles.referredPill} accessibilityRole="text">
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              </View>
            ) : onAskReferral ? (
              <TouchableOpacity 
                style={styles.referralBtn} 
                onPress={onAskReferral} 
                accessibilityLabel="Ask for referral"
              >
                <Ionicons name="people-outline" size={14} color={colors.white} />
                <Text style={styles.referralText}>Ask Referral</Text>
              </TouchableOpacity>
            ) : null
          )}

          {/* ✅ NEW: Delete button for draft jobs */}
          {showDelete && onDelete && (
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} accessibilityLabel="Delete job">
              <Ionicons name="trash-outline" size={14} color={colors.white} />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}

          {/* ✅ NEW: Publish button for employers (draft jobs only) */}
          {showPublish && onPublish && (
            <TouchableOpacity style={styles.publishBtn} onPress={onPublish} accessibilityLabel="Publish job">
              <Ionicons name="cloud-upload-outline" size={14} color={colors.white} />
              <Text style={styles.publishText}>Publish</Text>
            </TouchableOpacity>
          )}

          {/* ✅ Social sharing buttons for published jobs */}
          {showShare && (
            <View style={styles.shareContainer}>
              <TouchableOpacity style={[styles.socialIconBtn, { borderColor: colors.primaryDark + '40' }]} onPress={onShareLinkedIn} accessibilityLabel="Share on LinkedIn">
                <Ionicons name="logo-linkedin" size={14} color={colors.primaryDark} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialIconBtn, { borderColor: colors.success + '40' }]} onPress={onShareWhatsApp} accessibilityLabel="Share on WhatsApp">
                <Ionicons name="logo-whatsapp" size={14} color={colors.success} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={onShare} accessibilityLabel="Share job">
                <Ionicons name="share-social-outline" size={12} color={colors.white} />
                <Text style={styles.shareText}>Share</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Apply button - for direct jobs show "Apply on Site", for others show normal Apply/Applied */}
          {!hideApply && !isReferrerPosted && (
            (() => {
              const isDirect = job.ExternalJobID?.startsWith('direct_');
              if (isDirect) {
                // Direct jobs: always show "Apply on Site" (redirect to company career page)
                return onApply ? (
                  <TouchableOpacity style={styles.applyBtn} onPress={onApply} accessibilityLabel="Apply on company site">
                    <Ionicons name="open-outline" size={14} color={colors.primary} />
                    <Text style={styles.applyText}>Apply on Site</Text>
                  </TouchableOpacity>
                ) : null;
              }
              // Non-direct jobs: show Applied badge or Apply button
              return isApplied ? (
                <View style={styles.appliedPill} accessibilityRole="text">
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.appliedText}>Applied</Text>
                </View>
              ) : onApply ? (
                <TouchableOpacity style={styles.applyBtn} onPress={onApply} accessibilityLabel="Apply to job">
                  <Ionicons name="paper-plane-outline" size={14} color={colors.primary} />
                  <Text style={styles.applyText}>Apply</Text>
                </TouchableOpacity>
              ) : null;
            })()
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (colors, isDesktop = false) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    paddingVertical: isDesktop ? 18 : 14,
    paddingHorizontal: isDesktop ? 16 : 12,
    borderBottomWidth: isDesktop ? 0 : 1,
    borderBottomColor: colors.gray200 || colors.border,
    // Desktop: elevated cards with rounded corners
    ...(isDesktop ? {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border + '60',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    } : {}),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  logoContainer: {
    marginTop: 2,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContent: {
    flex: 1,
  },
  titleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  title: {
    fontSize: isDesktop ? 16 : 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  company: {
    fontSize: 14,
    color: colors.gray600 || colors.textSecondary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  metaText: {
    fontSize: isDesktop ? 13 : 12,
    color: isDesktop ? (colors.gray400 || colors.textMuted) : (colors.gray500 || colors.textSecondary),
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  fomoText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
  metaBadge: {
    fontSize: 11,
    color: isDesktop ? (colors.textSecondary || colors.gray500) : colors.primary,
    backgroundColor: isDesktop ? (colors.gray100 || colors.background) : (colors.primaryLight + '30'),
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  actionsRow: {
    marginTop: 6,
    marginLeft: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  saveText: { color: colors.primary, marginLeft: 4, fontWeight: '600', fontSize: 11 },
  savedText: { color: colors.white, marginLeft: 4, fontWeight: '600', fontSize: 11 },
  referralBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isDesktop ? 6 : 5,
    paddingHorizontal: isDesktop ? 10 : 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  referralText: { color: colors.white, marginLeft: 4, fontWeight: '600', fontSize: isDesktop ? 12 : 11 },
  referredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success,
    minWidth: 28,
  },
  requestingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.warning + '15',
    borderWidth: 1,
    borderColor: colors.warning
  },
  requestingText: { color: colors.warning, marginLeft: 4, fontWeight: '600', fontSize: 11 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
  deleteText: { color: colors.white, marginLeft: 4, fontWeight: '700', fontSize: 11 },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  publishText: { color: colors.white, marginLeft: 4, fontWeight: '700', fontSize: 11 },
  shareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  socialIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.success,
  },
  shareText: { color: colors.white, marginLeft: 3, fontWeight: '700', fontSize: 10 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isDesktop ? 6 : 5,
    paddingHorizontal: isDesktop ? 10 : 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  applyText: { color: colors.primary, marginLeft: 4, fontWeight: '700', fontSize: isDesktop ? 12 : 11 },
  appliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isDesktop ? 6 : 5,
    paddingHorizontal: isDesktop ? 10 : 8,
    borderRadius: 6,
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success,
  },
  appliedText: { color: colors.success, marginLeft: 4, fontWeight: '700', fontSize: isDesktop ? 12 : 11 },
});

export default React.memo(JobCard);
