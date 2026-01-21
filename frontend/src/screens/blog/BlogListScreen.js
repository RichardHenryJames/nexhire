import React, { useMemo, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

// Blog articles data
export const BLOG_ARTICLES = [
  {
    id: 'how-to-get-referral',
    title: 'How to Get a Job Referral: Complete Guide for 2026',
    excerpt: 'Learn the proven strategies to get employee referrals at top companies like Google, Amazon, Microsoft, and more. Boost your chances of getting hired by 15x.',
    image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
    category: 'Career Tips',
    readTime: '8 min read',
    date: 'January 15, 2026',
    author: 'RefOpen Team',
  },
  {
    id: 'referral-vs-direct-apply',
    title: 'Referral vs Direct Application: Which is Better?',
    excerpt: 'Discover why referred candidates are 15x more likely to get hired and how referrals can fast-track your job search compared to traditional applications.',
    image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800',
    category: 'Job Search',
    readTime: '6 min read',
    date: 'January 12, 2026',
    author: 'RefOpen Team',
  },
  {
    id: 'resume-tips-2026',
    title: '10 Resume Tips That Actually Work in 2026',
    excerpt: 'Your resume is your first impression. Learn how to craft a resume that gets past ATS systems and catches recruiters attention in seconds.',
    image: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800',
    category: 'Resume',
    readTime: '10 min read',
    date: 'January 10, 2026',
    author: 'RefOpen Team',
  },
  {
    id: 'linkedin-networking',
    title: 'LinkedIn Networking: How to Connect with Employees at Your Dream Company',
    excerpt: 'Master the art of professional networking on LinkedIn. Learn how to write connection requests that get accepted and build meaningful relationships.',
    image: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=800',
    category: 'Networking',
    readTime: '7 min read',
    date: 'January 8, 2026',
    author: 'RefOpen Team',
  },
  {
    id: 'interview-preparation',
    title: 'Interview Preparation: A Step-by-Step Guide',
    excerpt: 'From researching the company to answering behavioral questions, this comprehensive guide will help you ace your next job interview.',
    image: 'https://images.unsplash.com/photo-1565688534245-05d6b5be184a?w=800',
    category: 'Interview',
    readTime: '12 min read',
    date: 'January 5, 2026',
    author: 'RefOpen Team',
  },
  {
    id: 'salary-negotiation',
    title: 'Salary Negotiation: How to Get the Pay You Deserve',
    excerpt: 'Learn negotiation tactics used by professionals to increase their salary offers. Includes scripts and real examples from successful negotiations.',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
    category: 'Career Growth',
    readTime: '9 min read',
    date: 'January 3, 2026',
    author: 'RefOpen Team',
  },
  {
    id: 'tech-jobs-india-2026',
    title: 'Top Tech Jobs in India for 2026: Skills & Salaries',
    excerpt: 'Explore the most in-demand tech roles in India, required skills, salary ranges, and companies hiring. Plan your career path with data-driven insights.',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    category: 'Industry Trends',
    readTime: '11 min read',
    date: 'December 28, 2025',
    author: 'RefOpen Team',
  },
  {
    id: 'work-from-home-tips',
    title: 'Remote Work Success: Tips for Working from Home',
    excerpt: 'Remote work is here to stay. Learn productivity tips, work-life balance strategies, and tools that successful remote workers use daily.',
    image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800',
    category: 'Remote Work',
    readTime: '8 min read',
    date: 'December 25, 2025',
    author: 'RefOpen Team',
  },
  {
    id: 'cover-letter-guide',
    title: 'How to Write a Cover Letter That Gets You Interviews',
    excerpt: 'A well-crafted cover letter can make the difference between getting an interview and being ignored. Learn the formula that hiring managers love.',
    image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800',
    category: 'Job Application',
    readTime: '7 min read',
    date: 'December 22, 2025',
    author: 'RefOpen Team',
  },
  {
    id: 'career-change-guide',
    title: 'Changing Careers in 2026: A Complete Transition Guide',
    excerpt: 'Thinking of switching industries? Learn how to leverage your transferable skills, rebrand yourself, and land a job in a new field.',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800',
    category: 'Career Change',
    readTime: '10 min read',
    date: 'December 20, 2025',
    author: 'RefOpen Team',
  },
  {
    id: 'freshers-guide',
    title: 'First Job Guide: How Freshers Can Land Their Dream Job',
    excerpt: 'No experience? No problem. Learn strategies specifically designed for fresh graduates to stand out and get hired at top companies.',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800',
    category: 'Freshers',
    readTime: '9 min read',
    date: 'December 18, 2025',
    author: 'RefOpen Team',
  },
  {
    id: 'job-search-mistakes',
    title: '15 Common Job Search Mistakes and How to Avoid Them',
    excerpt: 'Are you making these common mistakes in your job search? Learn what hiring managers really think and how to fix these errors.',
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800',
    category: 'Job Search',
    readTime: '8 min read',
    date: 'December 15, 2025',
    author: 'RefOpen Team',
  },
  {
    id: 'upskilling-2026',
    title: 'Skills to Learn in 2026: Future-Proof Your Career',
    excerpt: 'AI, cloud computing, data science - which skills should you learn? A data-driven analysis of the most valuable skills for the next decade.',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
    category: 'Skills',
    readTime: '11 min read',
    date: 'December 12, 2025',
    author: 'RefOpen Team',
  },
  {
    id: 'company-culture-fit',
    title: 'How to Evaluate Company Culture Before Accepting a Job',
    excerpt: 'Salary is important, but culture fit determines your happiness. Learn how to research and evaluate company culture during your job search.',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
    category: 'Career Tips',
    readTime: '7 min read',
    date: 'December 10, 2025',
    author: 'RefOpen Team',
  },
  {
    id: 'networking-events',
    title: 'How to Network at Events: A Guide for Introverts and Extroverts',
    excerpt: 'Networking events can be intimidating. Learn proven strategies to make meaningful connections, follow up effectively, and grow your professional network.',
    image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800',
    category: 'Networking',
    readTime: '8 min read',
    date: 'December 8, 2025',
    author: 'RefOpen Team',
  },
];

const BlogCard = ({ article, onPress, colors, styles }) => {
  return (
    <TouchableOpacity style={styles.blogCard} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: article.image }} style={styles.blogImage} />
      <View style={styles.blogContent}>
        <View style={styles.categoryRow}>
          <Text style={styles.category}>{article.category}</Text>
          <Text style={styles.readTime}>{article.readTime}</Text>
        </View>
        <Text style={styles.blogTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={styles.blogExcerpt} numberOfLines={3}>{article.excerpt}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.author}>{article.author}</Text>
          <Text style={styles.date}>{article.date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function BlogListScreen() {
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

  const handleArticlePress = (article) => {
    navigation.navigate('BlogArticle', { articleId: article.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Career Blog</Text>
        <Text style={styles.headerSubtitle}>
          Expert tips, guides, and insights to help you land your dream job
        </Text>
      </View>

      {/* Featured Article */}
      <View style={styles.featuredSection}>
        <Text style={styles.sectionTitle}>Featured</Text>
        <BlogCard 
          article={BLOG_ARTICLES[0]} 
          onPress={() => handleArticlePress(BLOG_ARTICLES[0])}
          colors={colors}
          styles={styles}
        />
      </View>

      {/* All Articles */}
      <View style={styles.articlesSection}>
        <Text style={styles.sectionTitle}>Latest Articles</Text>
        {BLOG_ARTICLES.slice(1).map((article) => (
          <BlogCard 
            key={article.id}
            article={article} 
            onPress={() => handleArticlePress(article)}
            colors={colors}
            styles={styles}
          />
        ))}
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
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    padding: 24,
    backgroundColor: colors.primary,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: responsive.isLargeScreen ? 32 : 28,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: typography.sizes.md,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 24,
  },
  featuredSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  articlesSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  blogCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  blogImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.gray200,
  },
  blogContent: {
    padding: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  readTime: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  blogTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 26,
  },
  blogExcerpt: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  date: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});
