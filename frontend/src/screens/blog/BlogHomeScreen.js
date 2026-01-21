import React, { useMemo, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

const blogArticles = [
  {
    id: 'how-to-get-referral',
    title: 'How to Get a Job Referral: Complete Guide for 2026',
    excerpt: 'Learn the proven strategies to get employee referrals at top companies like Google, Amazon, Microsoft, and more. Increase your interview chances by 15x.',
    category: 'Career Tips',
    readTime: '8 min read',
    date: 'January 15, 2026',
    icon: 'people-outline',
  },
  {
    id: 'referral-email-templates',
    title: '10 Referral Request Email Templates That Actually Work',
    excerpt: 'Copy-paste email templates to ask for referrals professionally. Includes templates for LinkedIn messages, cold emails, and follow-ups.',
    category: 'Templates',
    readTime: '6 min read',
    date: 'January 12, 2026',
    icon: 'mail-outline',
  },
  {
    id: 'resume-tips-referral',
    title: 'How to Optimize Your Resume for Referral Success',
    excerpt: 'Your resume matters even for referrals. Learn how to craft a resume that makes employees confident to refer you.',
    category: 'Resume Tips',
    readTime: '7 min read',
    date: 'January 10, 2026',
    icon: 'document-text-outline',
  },
  {
    id: 'networking-strategies',
    title: 'Networking Strategies for Introverts: Land Your Dream Job',
    excerpt: 'Not everyone is a natural networker. Discover comfortable, authentic ways to build professional connections that lead to referrals.',
    category: 'Networking',
    readTime: '9 min read',
    date: 'January 8, 2026',
    icon: 'git-network-outline',
  },
  {
    id: 'interview-after-referral',
    title: 'What to Expect After Getting a Referral: Interview Guide',
    excerpt: 'You got the referral! Now what? Prepare for the interview process and learn how to make the most of your referral advantage.',
    category: 'Interview Prep',
    readTime: '10 min read',
    date: 'January 5, 2026',
    icon: 'chatbubbles-outline',
  },
  {
    id: 'top-companies-referral',
    title: 'Top 50 Companies with Best Referral Programs in India',
    excerpt: 'Discover which companies have the most active referral programs and highest referral bonuses. Plan your job search strategically.',
    category: 'Company Insights',
    readTime: '12 min read',
    date: 'January 3, 2026',
    icon: 'business-outline',
  },
];

export default function BlogHomeScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Career Blog',
      headerStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
      headerTitleStyle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
      headerLeft: () => (
        <TouchableOpacity 
          style={{ marginLeft: 16 }} 
          onPress={() => {
            const navState = navigation.getState();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;
            if (routes.length > 1 && currentIndex > 0) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Home' } });
            }
          }} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const renderArticleCard = (article) => (
    <TouchableOpacity
      key={article.id}
      style={styles.articleCard}
      onPress={() => navigation.navigate('BlogArticle', { articleId: article.id })}
      activeOpacity={0.7}
    >
      <View style={styles.articleIconContainer}>
        <Ionicons name={article.icon} size={32} color={colors.primary} />
      </View>
      <View style={styles.articleContent}>
        <View style={styles.articleMeta}>
          <Text style={styles.articleCategory}>{article.category}</Text>
          <Text style={styles.articleDot}>•</Text>
          <Text style={styles.articleReadTime}>{article.readTime}</Text>
        </View>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <Text style={styles.articleExcerpt} numberOfLines={2}>{article.excerpt}</Text>
        <Text style={styles.articleDate}>{article.date}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>RefOpen Career Blog</Text>
          <Text style={styles.heroSubtitle}>
            Expert advice on job referrals, networking, resume tips, and career growth. 
            Learn from industry professionals and land your dream job.
          </Text>
        </View>

        {/* Featured Article */}
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>Featured Article</Text>
          <TouchableOpacity
            style={styles.featuredCard}
            onPress={() => navigation.navigate('BlogArticle', { articleId: 'how-to-get-referral' })}
            activeOpacity={0.7}
          >
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
            <Text style={styles.featuredTitle}>How to Get a Job Referral: Complete Guide for 2026</Text>
            <Text style={styles.featuredExcerpt}>
              Learn the proven strategies to get employee referrals at top companies. 
              This comprehensive guide covers everything from finding referrers to crafting the perfect request.
            </Text>
            <View style={styles.featuredMeta}>
              <Text style={styles.featuredReadTime}>8 min read</Text>
              <Text style={styles.featuredCta}>Read Now →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* All Articles */}
        <View style={styles.articlesSection}>
          <Text style={styles.sectionTitle}>Latest Articles</Text>
          {blogArticles.map(renderArticleCard)}
        </View>

        {/* Topics Section */}
        <View style={styles.topicsSection}>
          <Text style={styles.sectionTitle}>Browse by Topic</Text>
          <View style={styles.topicsGrid}>
            {['Career Tips', 'Resume Tips', 'Networking', 'Interview Prep', 'Company Insights', 'Templates'].map((topic) => (
              <TouchableOpacity key={topic} style={styles.topicChip}>
                <Text style={styles.topicText}>{topic}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready to Get Your Referral?</Text>
          <Text style={styles.ctaText}>
            Join thousands of job seekers who have successfully landed interviews through referrals on RefOpen.
          </Text>
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Jobs' } })}
          >
            <Text style={styles.ctaButtonText}>Browse Jobs & Get Referrals</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ComplianceFooter />
    </ScrollView>
  );
}

const createStyles = (colors, responsive) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    padding: responsive.spacing.lg,
  },
  heroSection: {
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroTitle: {
    fontSize: responsive.isLargeScreen ? 36 : 28,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  featuredSection: {
    marginBottom: 32,
  },
  featuredCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  featuredBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#F59E0B',
  },
  featuredTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 12,
    lineHeight: 28,
  },
  featuredExcerpt: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  featuredMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredReadTime: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  featuredCta: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  articlesSection: {
    marginBottom: 32,
  },
  articleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  articleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  articleContent: {
    flex: 1,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  articleCategory: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  articleDot: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginHorizontal: 6,
  },
  articleReadTime: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  articleTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  articleExcerpt: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  articleDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  topicsSection: {
    marginBottom: 32,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicChip: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  topicText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  ctaSection: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  ctaTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: typography.sizes.md,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  ctaButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
});
