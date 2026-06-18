import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  DeviceEventEmitter,
  Modal,
  FlatList,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Bell, TrendingUp, Wallet, Lock, Calendar, X, BellOff, ChevronRight, Plus } from 'lucide-react-native';
import { colors, radius, shadows, typography } from '@/constants/theme';
import { getDeposits, Deposit, getUserProfile, UserProfile } from '@/lib/storage';
import { formatCurrencyFull, getMaturityLabel, getDaysUntilMaturity } from '@/lib/calculations';

const FILTER_OPTIONS = ['30d', '90d', '180d'];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('30d');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = deposits.flatMap(d => {
    const alerts: any[] = [];
    if (d.status === 'closed') return alerts;

    const label = getMaturityLabel(d.maturity_date, d.status);
    const isMatured = d.status === 'matured' || label === 'Matured';
    const daysLeft = getDaysUntilMaturity(d.maturity_date);

    if (isMatured || (daysLeft !== null && daysLeft >= 0 && daysLeft <= 3)) {
      alerts.push({
        id: `${d.id}-mat`,
        depositId: d.id,
        title: isMatured ? 'Deposit Matured' : 'Deposit Maturing Soon',
        message: isMatured
          ? `Your deposit "${d.name}" at ${d.bank} has matured!`
          : `Your deposit "${d.name}" at ${d.bank} matures in ${daysLeft} days.`,
        type: d.type,
        isMatured,
        isRDInstallment: false,
      });
    }

    if (d.type === 'RD' && d.status === 'active') {
      const start = new Date(d.start_date);
      const now = new Date();
      let nextDue = new Date(start);
      if (now > start) {
        const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
        nextDue.setMonth(start.getMonth() + monthsDiff);
        if (nextDue < now) nextDue.setMonth(nextDue.getMonth() + 1);
      }
      const dueDaysLeft = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (dueDaysLeft >= 0 && dueDaysLeft <= 3) {
        const monthlyAmount = d.tenure_months > 0 ? d.principal_amount / d.tenure_months : d.principal_amount;
        alerts.push({
          id: `${d.id}-rd`,
          depositId: d.id,
          title: dueDaysLeft === 0 ? 'RD Installment Due Today' : 'RD Installment Due Soon',
          message: `Installment of ${formatCurrencyFull(monthlyAmount)} for "${d.name}" is due ${dueDaysLeft === 0 ? 'today' : `in ${dueDaysLeft} days`}.`,
          type: 'RD',
          isMatured: false,
          isRDInstallment: true,
        });
      }
    }

    return alerts;
  });

  const slideAnim = useState(new Animated.Value(300))[0];
  const [localNotificationsVisible, setLocalNotificationsVisible] = useState(false);

  useEffect(() => {
    if (showNotifications) {
      setLocalNotificationsVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setLocalNotificationsVisible(false);
      });
    }
  }, [showNotifications]);

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        setUserProfile(profile);
      }
    } catch (err) {
      console.error('Failed to load profile in index.tsx:', err);
    }
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('deposits_changed', () => {
      fetchDeposits();
      loadUserProfile();
    });
    loadUserProfile();
    return () => {
      sub.remove();
    };
  }, []);

  const fetchDeposits = async () => {
    try {
      const data = await getDeposits();
      const sorted = [...data].sort((a, b) => {
        if (!a.maturity_date) return 1;
        if (!b.maturity_date) return -1;
        return new Date(a.maturity_date).getTime() - new Date(b.maturity_date).getTime();
      });
      setDeposits(sorted);
    } catch (error) {
      console.error('Failed to fetch deposits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDeposits(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchDeposits(); };

  const totalInvested = deposits.filter(d => d.status !== 'closed').reduce((sum, d) => sum + d.principal_amount, 0);
  const totalMaturity = deposits.filter(d => d.status !== 'closed').reduce((sum, d) => sum + (d.maturity_amount || d.principal_amount), 0);
  const interestEarned = totalMaturity - totalInvested;
  const portfolioValue = totalMaturity;

  const maturedDeposits = deposits.filter(d => {
    if (d.status === 'closed') return false;
    const label = getMaturityLabel(d.maturity_date, d.status);
    return d.status === 'matured' || label === 'Matured';
  });

  const activeFDs = deposits.filter(d => d.type === 'FD' && d.status === 'active');
  const activeRDs = deposits.filter(d => d.type === 'RD' && d.status === 'active');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  })();

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.text1} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text1} />}
      >
        {/* Header — Figma-style cream bg, charcoal text */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerTop}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                {userProfile?.picture ? (
                  <Image source={{ uri: userProfile.picture }} style={styles.avatarImage} referrerPolicy="no-referrer" />
                ) : (
                  <Text style={styles.avatarText}>
                    {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.greetingText}>{greeting}</Text>
              <Text style={styles.portfolioTitle}>{userProfile?.name || 'My Portfolio'}</Text>
            </View>
            <TouchableOpacity style={styles.bellBtn} onPress={() => setShowNotifications(true)}>
              <Bell size={20} color={colors.text1} />
              {notifications.length > 0 && <View style={styles.bellDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Portfolio Value Hero Card */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#181A16', '#1C2416', '#0E0F0C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Lime accent top strip */}
            <View style={styles.heroAccentStrip} />

            <Text style={styles.portfolioLabel}>Portfolio Value</Text>
            <Text style={styles.portfolioValue}>{formatCurrencyFull(portfolioValue)}</Text>
            <View style={styles.heroDivider} />
            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <View style={[styles.heroStatIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <Wallet size={16} color={colors.white} />
                </View>
                <Text style={styles.heroStatLabel}>Invested</Text>
                <Text style={styles.heroStatValue}>{formatCurrencyFull(totalInvested)}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <View style={[styles.heroStatIcon, { backgroundColor: 'rgba(215,254,71,0.15)' }]}>
                  <TrendingUp size={16} color={colors.mint} />
                </View>
                <Text style={styles.heroStatLabel}>Interest</Text>
                <Text style={[styles.heroStatValue, { color: colors.mint }]}>+ {formatCurrencyFull(interestEarned)}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Add Deposit Bento Grid */}
        <View style={[styles.section, { paddingBottom: 0 }]}>
          <View style={styles.bentoGrid}>
            <TouchableOpacity
              style={styles.bentoCard}
              onPress={() => router.push('/add-fd' as any)}
              activeOpacity={0.82}
            >
              <View style={[styles.bentoIconWrap, { backgroundColor: colors.mint }]}>
                <Lock size={22} color={colors.text1} />
              </View>
              <Text style={styles.bentoTitle}>Fixed Deposit</Text>
              <Text style={styles.bentoSubtitle}>{activeFDs.length} active</Text>
              <View style={styles.bentoArrow}>
                <Plus size={16} color={colors.text1} strokeWidth={3} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bentoCard}
              onPress={() => router.push('/add-rd' as any)}
              activeOpacity={0.82}
            >
              <View style={[styles.bentoIconWrap, { backgroundColor: colors.lavender }]}>
                <TrendingUp size={22} color={colors.white} />
              </View>
              <Text style={styles.bentoTitle}>Recurring Deposit</Text>
              <Text style={styles.bentoSubtitle}>{activeRDs.length} active</Text>
              <View style={styles.bentoArrow}>
                <Plus size={16} color={colors.text1} strokeWidth={3} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* RD Reminders Section */}
        {activeRDs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Monthly RD Reminders</Text>
            </View>
            {activeRDs.map(deposit => {
              // Calculate next due date simply by adding months from start_date to exceed today
              const start = new Date(deposit.start_date);
              const now = new Date();
              let nextDue = new Date(start);
              if (now > start) {
                const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
                nextDue.setMonth(start.getMonth() + monthsDiff);
                if (nextDue < now) nextDue.setMonth(nextDue.getMonth() + 1);
              }
              const daysLeft = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              let dueLabel = daysLeft === 0 ? 'Due Today' : `Due in ${daysLeft}d`;

              const monthlyAmount = deposit.tenure_months > 0 ? deposit.principal_amount / deposit.tenure_months : deposit.principal_amount;

              return (
                <TouchableOpacity
                  key={deposit.id}
                  style={styles.depositCard}
                  onPress={() => router.push(`/deposit/${deposit.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.depositIcon, { backgroundColor: colors.lavenderSoft }]}>
                    <TrendingUp size={20} color={colors.lavender} />
                  </View>
                  <View style={styles.depositInfo}>
                    <Text style={styles.depositName} numberOfLines={1}>{deposit.name}</Text>
                    <Text style={styles.depositBank} numberOfLines={1}>{deposit.bank} • {deposit.interest_rate}% p.a.</Text>
                  </View>
                  <View style={styles.depositRight}>
                    <Text style={styles.depositAmount}>{formatCurrencyFull(monthlyAmount)}/mo</Text>
                    <View style={[styles.badge, { backgroundColor: colors.lavender }]}>
                      <Text style={[styles.badgeText, { color: colors.white }]}>{dueLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Matured Deposits Section */}
        {maturedDeposits.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Matured Deposits</Text>
            </View>
            {maturedDeposits.map(deposit => {
              const isFD = deposit.type === 'FD';
              const accentColor = '#b45309';
              const accentSoft = colors.goldSoft;

              return (
                <TouchableOpacity
                  key={deposit.id}
                  style={styles.depositCard}
                  onPress={() => router.push(`/deposit/${deposit.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.depositIcon, { backgroundColor: isFD ? colors.mintSoft : colors.lavenderSoft }]}>
                    {isFD ? <Lock size={20} color={colors.mint} /> : <TrendingUp size={20} color={colors.lavender} />}
                  </View>
                  <View style={styles.depositInfo}>
                    <Text style={styles.depositName} numberOfLines={1}>{deposit.name}</Text>
                    <Text style={styles.depositBank} numberOfLines={1}>{deposit.bank} • Matured</Text>
                  </View>
                  <View style={styles.depositRight}>
                    <Text style={styles.depositAmount}>{deposit.maturity_amount ? formatCurrencyFull(deposit.maturity_amount) : '---'}</Text>
                    <View style={[styles.badge, { backgroundColor: accentSoft }]}>
                      <Text style={[styles.badgeText, { color: accentColor }]}>Matured</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Notification Modal */}
      <Modal
        visible={localNotificationsVisible}
        transparent
        animationType="none"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowNotifications(false)}
          />
          <Animated.View
            style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Maturity Alerts</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowNotifications(false)}
              >
                <X size={18} color={colors.text2} />
              </TouchableOpacity>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyAlerts}>
                <View style={styles.emptyAlertsIcon}>
                  <BellOff size={28} color={colors.text3} />
                </View>
                <Text style={styles.emptyAlertsTitle}>All caught up!</Text>
                <Text style={styles.emptyAlertsDesc}>
                  No deposits are matured or maturing within the next 3 days.
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.alertItem,
                      { borderLeftColor: item.isMatured ? '#b45309' : (item.isRDInstallment ? colors.lavender : '#22863a'), borderLeftWidth: 3 }
                    ]}
                    onPress={() => {
                      setShowNotifications(false);
                      router.push(`/deposit/${item.depositId}` as any);
                    }}
                  >
                    <View
                      style={[
                        styles.alertBadge,
                        { backgroundColor: item.isMatured ? colors.goldSoft : (item.isRDInstallment ? colors.lavenderSoft : '#d4edda') }
                      ]}
                    >
                      <Bell size={16} color={item.isMatured ? '#b45309' : (item.isRDInstallment ? colors.lavender : '#22863a')} />
                    </View>
                    <View style={styles.alertContent}>
                      <Text style={styles.alertTitle}>{item.title}</Text>
                      <Text style={styles.alertMessage}>{item.message}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function MaturityBadge({ deposit }: { deposit: Deposit }) {
  const label = getMaturityLabel(deposit.maturity_date, deposit.status);
  const isMatured = deposit.status === 'matured' || label === 'Matured';
  const isClosed = deposit.status === 'closed';
  const daysLeft = getDaysUntilMaturity(deposit.maturity_date);
  const isAboutToMature = !isMatured && !isClosed && daysLeft !== null && daysLeft <= 30;

  let accentColor = '#22863a';
  let accentSoft = '#d4edda';

  if (isMatured || isAboutToMature) {
    accentColor = '#b45309';
    accentSoft = colors.goldSoft;
  } else if (isClosed) {
    accentColor = colors.lavender;
    accentSoft = colors.lavenderSoft;
  }

  return (
    <View style={[styles.badge, { backgroundColor: accentSoft }]}>
      <Text style={[styles.badgeText, { color: accentColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  loader: { flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.bgBase,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {},
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.text1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarText: { color: colors.white, fontFamily: typography.bold, fontSize: 16 },
  headerTitleWrap: { flex: 1 },
  greetingText: { color: colors.text3, fontSize: 12, fontFamily: typography.regular, textTransform: 'uppercase', letterSpacing: 0.5 },
  portfolioTitle: { color: colors.text1, fontSize: 18, fontFamily: typography.bold, letterSpacing: -0.3 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lavender,
    borderWidth: 1.5,
    borderColor: colors.bgBase,
  },

  // Hero Portfolio Card
  heroSection: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  heroCard: {
    borderRadius: radius.bento,
    padding: 24,
    overflow: 'hidden',
  },
  heroAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.mint,
    opacity: 0.6,
  },
  portfolioLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  portfolioValue: {
    color: colors.white,
    fontSize: 36,
    fontFamily: typography.bold,
    letterSpacing: -1.5,
    marginBottom: 20,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 0,
  },
  heroStatItem: {
    flex: 1,
    gap: 4,
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  heroStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroStatValue: {
    color: colors.white,
    fontSize: 16,
    fontFamily: typography.bold,
    letterSpacing: -0.5,
  },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 28 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  filterChips: { flexDirection: 'row', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  chipActive: { backgroundColor: colors.text1, borderColor: colors.text1 },
  chipText: { fontSize: 12, fontFamily: typography.semiBold, color: colors.text3 },
  chipTextActive: { color: colors.white },

  // Bento Grid
  bentoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    gap: 6,
    ...shadows.sm,
  },
  bentoCardAlt: {},
  bentoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bentoTitle: {
    fontSize: 20,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  bentoSubtitle: {
    fontSize: 13,
    fontFamily: typography.medium,
    color: colors.text3,
  },
  bentoArrow: {
    marginTop: 8,
    alignSelf: 'flex-start',
    width: 28,
    height: 28,
    borderRadius: radius.xs,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Deposit Cards
  depositCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  depositIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositInfo: { flex: 1 },
  depositName: { fontSize: 15, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.2 },
  depositBank: { fontSize: 12, color: colors.text3, marginTop: 2, fontFamily: typography.regular },
  depositRight: { alignItems: 'flex-end', gap: 6 },
  depositAmount: { fontSize: 14, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.3 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 11, fontFamily: typography.bold },

  emptyState: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  emptyText: { color: colors.text3, fontSize: 14, fontFamily: typography.regular },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14,15,12,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '70%',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: typography.bold,
    color: colors.text1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.xs,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAlerts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyAlertsIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyAlertsTitle: {
    fontSize: 16,
    fontFamily: typography.bold,
    color: colors.text1,
  },
  emptyAlertsDesc: {
    fontSize: 13,
    color: colors.text3,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
    fontFamily: typography.regular,
  },
  alertItem: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 14,
    gap: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  alertBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: typography.bold,
    color: colors.text1,
  },
  alertMessage: {
    fontSize: 12,
    color: colors.text2,
    lineHeight: 16,
    fontFamily: typography.regular,
  },
});
