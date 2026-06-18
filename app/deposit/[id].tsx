import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Lock,
  TrendingUp,
  Calendar,
  Building2,
  User,
  Percent,
  RefreshCw,
  FileText,
  Check,
} from 'lucide-react-native';
import { colors, radius, shadows, typography } from '@/constants/theme';
import { getDepositById, deleteDeposit, saveDeposit, Deposit, RDPayment } from '@/lib/storage';
import { formatCurrencyFull, formatMaturityDate, getMaturityLabel, getDaysUntilMaturity } from '@/lib/calculations';

export default function DepositDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getDepositById(id).then((data) => {
      if (data) {
        if (data.type === 'RD' && (!data.rd_payments || data.rd_payments.length === 0)) {
          // Dynamically construct and save initial schedule for legacy RD
          import('@/lib/storage').then(async ({ getUpdatedRDPayments, saveDeposit }) => {
            const monthlyDep = data.tenure_months > 0 ? (data.principal_amount / data.tenure_months) : data.principal_amount;
            const initialPayments = getUpdatedRDPayments(null, monthlyDep, data.tenure_months || 12, data.start_date);
            const updated = await saveDeposit({ ...data, rd_payments: initialPayments });
            setDeposit(updated);
          });
        } else {
          setDeposit(data);
        }
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [id]);

  const performDelete = async () => {
    setDeleting(true);
    await deleteDeposit(id);
    router.back();
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm(`Are you sure you want to delete "${deposit?.name}"? This action cannot be undone.`);
      if (confirm) {
        performDelete();
      }
      return;
    }
    Alert.alert(
      'Delete Deposit',
      `Are you sure you want to delete "${deposit?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
  };

  const performClose = async () => {
    if (!deposit) return;
    setUpdating(true);
    try {
      const updated = await saveDeposit({
        ...deposit,
        status: 'closed',
      });
      setDeposit(updated);
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('Failed to close deposit. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to close deposit. Please try again.');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleCloseDeposit = () => {
    if (!deposit) return;
    if (Platform.OS === 'web') {
      const confirm = window.confirm(`Are you sure you want to mark "${deposit.name}" as closed? It will be moved to your history and stop tracking interest.`);
      if (confirm) {
        performClose();
      }
      return;
    }
    Alert.alert(
      deposit.status === 'matured' ? 'Mark as Redeemed' : 'Withdraw Deposit Prematurely',
      `Are you sure you want to mark "${deposit.name}" as closed? It will be moved to your history and stop tracking interest.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: performClose,
        },
      ]
    );
  };

  const handleTogglePayment = async (monthNum: number) => {
    if (!deposit || !deposit.rd_payments) return;

    const updatedPayments = deposit.rd_payments.map(p => {
      if (p.month === monthNum) {
        const isPaid = p.status === 'paid';
        return {
          ...p,
          status: (isPaid ? 'pending' : 'paid') as 'paid' | 'pending',
          paid_date: isPaid ? null : new Date().toISOString().split('T')[0],
        };
      }
      return p;
    });

    try {
      const updated = await saveDeposit({
        ...deposit,
        rd_payments: updatedPayments,
      });
      setDeposit(updated);
    } catch (err) {
      console.error('Failed to toggle installment payment:', err);
      Alert.alert('Error', 'Failed to update payment status.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.mint} />
      </View>
    );
  }

  if (!deposit) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Deposit not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFD = deposit.type === 'FD';
  const label = getMaturityLabel(deposit.maturity_date, deposit.status);
  const isMatured = deposit.status === 'matured' || label === 'Matured';
  const isClosed = deposit.status === 'closed' || label === 'Closed';

  const daysLeft = getDaysUntilMaturity(deposit.maturity_date);
  const isAboutToMature = !isMatured && !isClosed && daysLeft !== null && daysLeft <= 30;

  const theme = isFD ? {
    bg: colors.mint,
    soft: colors.mintSoft,
    text: '#000000',
    icon: '#000000',
  } : {
    bg: colors.lavender,
    soft: colors.lavenderSoft,
    text: colors.lavender,
    icon: colors.white,
  };

  const tenure = [
    deposit.tenure_years > 0 ? `${deposit.tenure_years}Y` : '',
    deposit.tenure_months > 0 ? `${deposit.tenure_months}M` : '',
    deposit.tenure_days > 0 ? `${deposit.tenure_days}D` : '',
  ].filter(Boolean).join(' ') || '—';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{deposit.type} Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              const routePath = deposit.type === 'FD' ? `/add-fd?edit=${id}` : `/add-rd?edit=${id}`;
              router.push(routePath as any);
            }}
          >
            <Pencil size={18} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: 'rgba(224,85,85,0.1)' }]}
            onPress={handleDelete}
            disabled={deleting}
          >
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { borderColor: theme.soft }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: theme.bg }]}>
              {isFD ? <Lock size={22} color={theme.icon} /> : <TrendingUp size={22} color={theme.icon} />}
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{deposit.name}</Text>
              <View style={styles.heroBadgeRow}>
                <View style={[styles.typeBadge, { backgroundColor: theme.soft }]}>
                  <Text style={[styles.typeBadgeText, { color: theme.text }]}>{deposit.type}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: colors.bgTertiary }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.text2 }]}>{label}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.maturityBlock}>
            <Text style={styles.maturityLabel}>Maturity Amount</Text>
            <Text style={styles.maturityValue}>{formatCurrencyFull(deposit.maturity_amount || deposit.principal_amount)}</Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatCurrencyFull(deposit.interest_earned || 0)}</Text>
              <Text style={styles.metricLabel}>Interest Earned</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{deposit.effective_yield?.toFixed(2) || deposit.interest_rate}%</Text>
              <Text style={styles.metricLabel}>Effective Yield</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatMaturityDate(deposit.maturity_date)}</Text>
              <Text style={styles.metricLabel}>Maturity Date</Text>
            </View>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Deposit Details</Text>
          <DetailRow Icon={Building2} label="Bank / Institution" value={deposit.bank} />
          <DetailRow Icon={User} label="Family Member" value={deposit.family_member_name} />
          <DetailRow Icon={Percent} label="Principal Amount" value={formatCurrencyFull(deposit.principal_amount)} />
          <DetailRow Icon={Percent} label="Interest Rate" value={`${deposit.interest_rate}% p.a.`} />
          <DetailRow Icon={Calendar} label="Start Date" value={new Date(deposit.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <DetailRow Icon={Calendar} label="Tenure" value={tenure} />
          <DetailRow Icon={RefreshCw} label="Compounding" value={deposit.compounding_frequency} />
          <DetailRow Icon={TrendingUp} label="Interest Payout" value={deposit.interest_payout} isLast />
        </View>

        {/* RD Installment Tracker */}
        {deposit.type === 'RD' && deposit.rd_payments && deposit.rd_payments.length > 0 && (() => {
          const payments = deposit.rd_payments;
          const totalCount = payments.length;
          const paidCount = payments.filter(p => p.status === 'paid').length;
          const monthlyAmount = payments[0]?.amount || 0;
          const totalPaidAmt = paidCount * monthlyAmount;

          const nextPending = payments.find(p => p.status === 'pending');
          const progressPercent = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
          const todayStr = new Date().toISOString().split('T')[0];

          return (
            <View style={styles.trackerCard}>
              <Text style={styles.trackerTitle}>RD Installment Tracker</Text>

              <View style={styles.trackerSummary}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{paidCount} / {totalCount}</Text>
                    <Text style={styles.summaryLabel}>Installments Paid</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{formatCurrencyFull(totalPaidAmt)}</Text>
                    <Text style={styles.summaryLabel}>Total Deposited</Text>
                  </View>
                </View>

                <View style={styles.trackerProgressBar}>
                  <View style={[styles.trackerProgressFill, { width: `${progressPercent}%` }]} />
                </View>

                {nextPending ? (
                  <Text style={styles.nextDueText}>
                    Next Due: <Text style={{ fontFamily: typography.semiBold }}>{formatMaturityDate(nextPending.due_date)}</Text> ({formatCurrencyFull(nextPending.amount)})
                  </Text>
                ) : (
                  <Text style={[styles.nextDueText, { color: '#22863a', fontFamily: typography.semiBold }]}>
                    🎉 All installments completed!
                  </Text>
                )}
              </View>

              <Text style={styles.scheduleTitle}>Payment Schedule</Text>
              <View style={styles.scheduleList}>
                {payments.map((p) => {
                  const isPaid = p.status === 'paid';
                  const isOverdue = !isPaid && p.due_date < todayStr;

                  let badgeText = 'Pending';
                  let badgeColor = colors.text3;
                  let badgeBg = colors.bgTertiary;

                  if (isPaid) {
                    badgeText = 'Paid';
                    badgeColor = '#22863a';
                    badgeBg = '#d4edda';
                  } else if (isOverdue) {
                    badgeText = 'Overdue';
                    badgeColor = colors.error;
                    badgeBg = 'rgba(224, 85, 85, 0.1)';
                  }

                  return (
                    <TouchableOpacity
                      key={p.month}
                      style={[styles.installmentItem, isPaid && styles.installmentItemPaid]}
                      onPress={() => handleTogglePayment(p.month)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.installmentLeft}>
                        <View style={[styles.monthCircle, isPaid && styles.monthCirclePaid]}>
                          <Text style={[styles.monthCircleText, isPaid && styles.monthCircleTextPaid]}>
                            {p.month}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.installmentMonth}>Month {p.month}</Text>
                          <Text style={styles.installmentDate}>
                            Due: {formatMaturityDate(p.due_date)}
                          </Text>
                          {p.paid_date && (
                            <Text style={styles.paidDateText}>
                              Paid on: {formatMaturityDate(p.paid_date)}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.installmentRight}>
                        <Text style={styles.installmentAmount}>{formatCurrencyFull(p.amount)}</Text>
                        <View style={styles.installmentStatusRow}>
                          <View style={[styles.statusBadgeCapsule, { backgroundColor: badgeBg }]}>
                            <Text style={[styles.statusBadgeCapsuleText, { color: badgeColor }]}>
                              {badgeText}
                            </Text>
                          </View>

                          <View style={[styles.checkboxOutline, isPaid && styles.checkboxFilled]}>
                            {isPaid && <Check size={12} color={colors.white} strokeWidth={3} />}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* Additional Details */}
        {(deposit.account_reference || deposit.notes || deposit.auto_renewal) && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Additional Info</Text>
            {deposit.account_reference && (
              <DetailRow Icon={FileText} label="Account Reference" value={deposit.account_reference} />
            )}
            <DetailRow
              Icon={RefreshCw}
              label="Auto Renewal"
              value={deposit.auto_renewal ? 'Enabled' : 'Disabled'}
            />
            {deposit.notes && (
              <View style={styles.notesRow}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesValue}>{deposit.notes}</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {deposit.status !== 'closed' && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.text1, marginTop: 0 }]}
            onPress={handleCloseDeposit}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Check size={18} color={colors.white} />
                <Text style={styles.closeBtnText}>
                  {deposit.status === 'matured' ? 'Mark as Redeemed' : 'Withdraw / Close Deposit'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function DetailRow({ Icon, label, value, isLast }: { Icon: any; label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <View style={styles.detailIcon}>
        <Icon size={15} color={colors.text4} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  loader: { flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 16, color: colors.text3 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.black, borderRadius: radius.md },
  backBtnText: { color: colors.white, fontFamily: typography.semiBold },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    gap: 12,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', gap: 8 },

  content: { padding: 20, gap: 14, paddingBottom: 40 },

  heroCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    ...shadows.md,
  },
  heroTop: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1, justifyContent: 'center', gap: 8 },
  heroName: { fontSize: 18, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.3 },
  heroBadgeRow: { flexDirection: 'row', gap: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  typeBadgeText: { fontSize: 11, fontFamily: typography.bold, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.mintSoft },
  maturedBadge: { backgroundColor: colors.separator },
  statusBadgeText: { fontSize: 11, fontFamily: typography.bold },

  maturityBlock: { marginBottom: 16 },
  maturityLabel: { fontSize: 12, color: colors.text3, fontFamily: typography.medium, marginBottom: 4 },
  maturityValue: { fontSize: 30, fontFamily: typography.bold, color: colors.text1, letterSpacing: -1 },

  metricsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: 12,
  },
  metricItem: { flex: 1, alignItems: 'center', gap: 3 },
  metricValue: { fontSize: 13, fontFamily: typography.bold, color: colors.text1 },
  metricLabel: { fontSize: 10, color: colors.text4, textAlign: 'center', fontFamily: typography.regular },
  metricDivider: { width: 1, backgroundColor: colors.separator },

  detailsCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  detailsTitle: { fontSize: 14, fontFamily: typography.bold, color: colors.text1, marginBottom: 12 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  detailIcon: { width: 20, alignItems: 'center' },
  detailLabel: { flex: 1, fontSize: 13, color: colors.text3, fontFamily: typography.regular },
  detailValue: { fontSize: 13, fontFamily: typography.semiBold, color: colors.text1 },
  notesRow: { paddingTop: 10 },
  notesLabel: { fontSize: 12, color: colors.text3, fontFamily: typography.semiBold, marginBottom: 4 },
  notesValue: { fontSize: 13, color: colors.text2, lineHeight: 20, fontFamily: typography.regular },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
    ...shadows.sm,
  },
  closeBtnText: { color: colors.white, fontSize: 15, fontFamily: typography.bold },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    ...shadows.sm,
  },
  trackerCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  trackerTitle: { fontSize: 14, fontFamily: typography.bold, color: colors.text1, marginBottom: 12 },
  trackerSummary: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 16, fontFamily: typography.bold, color: colors.text1 },
  summaryLabel: { fontSize: 11, color: colors.text4, fontFamily: typography.regular },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.separator },
  trackerProgressBar: {
    height: 6,
    backgroundColor: colors.separator,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackerProgressFill: { height: 6, backgroundColor: '#22863a', borderRadius: 3 },
  nextDueText: { fontSize: 12, color: colors.text3, textAlign: 'center', fontFamily: typography.regular },
  scheduleTitle: { fontSize: 13, fontFamily: typography.bold, color: colors.text2, marginBottom: 10 },
  scheduleList: { gap: 8 },
  installmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: radius.sm,
    padding: 12,
    gap: 12,
  },
  installmentItemPaid: {
    opacity: 0.85,
    borderColor: '#22863a' + '33',
  },
  installmentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  monthCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCirclePaid: {
    backgroundColor: '#d4edda',
  },
  monthCircleText: { fontSize: 12, fontFamily: typography.bold, color: colors.text2 },
  monthCircleTextPaid: { color: '#22863a' },
  installmentMonth: { fontSize: 13, fontFamily: typography.bold, color: colors.text1 },
  installmentDate: { fontSize: 11, color: colors.text3, marginTop: 1, fontFamily: typography.regular },
  paidDateText: { fontSize: 10, color: '#22863a', marginTop: 1, fontFamily: typography.semiBold },
  installmentRight: { alignItems: 'flex-end', gap: 6 },
  installmentAmount: { fontSize: 13, fontFamily: typography.bold, color: colors.text1 },
  installmentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadgeCapsule: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusBadgeCapsuleText: { fontSize: 10, fontFamily: typography.bold },
  checkboxOutline: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.text4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFilled: {
    backgroundColor: '#22863a',
    borderColor: '#22863a',
  },
});
