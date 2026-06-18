import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors, radius, shadows, typography } from '@/constants/theme';
import { getDeposits, Deposit } from '@/lib/storage';
import { formatCurrency, formatCurrencyFull } from '@/lib/calculations';

// New premium color palette
const BANK_COLORS = ['#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#eab308'];
const PRODUCT_COLORS = ['#22863a', colors.lavender]; // Green = FD, Orange = RD

function DonutChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 75;
  const innerR = 50;
  let cumAngle = -Math.PI / 2;

  if (total === 0) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={outerR} stroke={colors.separator} strokeWidth={outerR - innerR} fill="none" />
        <Circle cx={cx} cy={cy} r={innerR - 4} fill={colors.bgElevated} />
      </Svg>
    );
  }

  const arcs = data.map(item => {
    const fraction = item.value / total;
    const sweep = fraction * 2 * Math.PI;
    const startAngle = cumAngle;
    const endAngle = cumAngle + sweep;
    cumAngle = endAngle;

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;

    return {
      d: `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`,
      color: item.color,
    };
  });

  return (
    <Svg width={size} height={size}>
      {arcs.map((arc, i) => (
        <Path key={i} d={arc.d} fill={arc.color} />
      ))}
      <Circle cx={cx} cy={cy} r={innerR - 4} fill={colors.bgElevated} />
    </Svg>
  );
}

function PieChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = 44;
  let cumAngle = -Math.PI / 2;

  if (total === 0) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill={colors.bgBase} />
      </Svg>
    );
  }

  const arcs = data.map(item => {
    const fraction = item.value / total;
    // Fix issue when pie is 100% one item
    if (fraction === 1) {
      return { d: null, color: item.color, isFull: true };
    }
    const sweep = fraction * 2 * Math.PI;
    const startAngle = cumAngle;
    const endAngle = cumAngle + sweep;
    cumAngle = endAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    return {
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: item.color,
      isFull: false,
    };
  });

  return (
    <Svg width={size} height={size}>
      {arcs.map((arc, i) => (
        arc.isFull ? <Circle key={i} cx={cx} cy={cy} r={r} fill={arc.color} /> : <Path key={i} d={arc.d!} fill={arc.color} />
      ))}
    </Svg>
  );
}

function BarChart({ months, values }: { months: string[]; values: number[] }) {
  const maxVal = Math.max(...values, 1);
  const barWidth = 28;
  const chartH = 100;
  const gap = 12;
  const totalW = Math.max(months.length * (barWidth + gap) - gap + 20, 0);

  if (months.length === 0) {
    return null;
  }

  return (
    <Svg width={totalW} height={chartH + 20}>
      {values.map((v, i) => {
        const barH = Math.max(4, (v / maxVal) * chartH);
        const x = 10 + i * (barWidth + gap);
        const y = chartH - barH;
        return (
          <G key={i}>
            <Path
              d={`M ${x} ${y + 4} Q ${x} ${y} ${x + 4} ${y} L ${x + barWidth - 4} ${y} Q ${x + barWidth} ${y} ${x + barWidth} ${y + 4} L ${x + barWidth} ${chartH} L ${x} ${chartH} Z`}
              fill={colors.lavender}
            />
          </G>
        );
      })}
    </Svg>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeposits = () => {
    getDeposits().then((data) => {
      if (data) setDeposits(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useFocusEffect(useCallback(() => {
    fetchDeposits();
  }, []));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('deposits_changed', () => {
      fetchDeposits();
    });
    return () => {
      sub.remove();
    };
  }, []);

  const active = deposits.filter(d => d.status === 'active');

  // Metrics Calculations
  const totalPrincipal = active.reduce((sum, d) => sum + d.principal_amount, 0);
  const totalMaturity = active.reduce((sum, d) => sum + (d.maturity_amount || d.principal_amount), 0);
  const totalInterestEarned = active.reduce((sum, d) => sum + (d.interest_earned || (d.maturity_amount ? d.maturity_amount - d.principal_amount : 0)), 0);
  
  // Blended Yield (Weighted average interest rate based on principal)
  const blendedYield = totalPrincipal > 0 
    ? active.reduce((sum, d) => sum + (d.principal_amount * d.interest_rate), 0) / totalPrincipal
    : 0;

  // RD Commitment
  const totalRDMonthly = active
    .filter(d => d.type === 'RD' && d.tenure_months > 0)
    .reduce((sum, d) => sum + (d.principal_amount / d.tenure_months), 0);

  // Bank distribution
  const bankMap: Record<string, number> = {};
  active.forEach(d => {
    bankMap[d.bank] = (bankMap[d.bank] || 0) + (d.maturity_amount || d.principal_amount);
  });
  const bankData = Object.entries(bankMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({ label, value, color: BANK_COLORS[i] || '#CCC' }));

  // Product mix
  const fdValue = active.filter(d => d.type === 'FD').reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);
  const rdValue = active.filter(d => d.type === 'RD').reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);
  const productData = [
    { label: 'FDs', value: fdValue, color: PRODUCT_COLORS[0] },
    { label: 'RDs', value: rdValue, color: PRODUCT_COLORS[1] },
  ].filter(d => d.value > 0);

  // Portfolio Overview Data
  const portfolioData = [
    { label: 'Invested', value: totalPrincipal, color: colors.text1 },
    { label: 'Projected Interest', value: totalInterestEarned, color: colors.mint },
  ].filter(d => d.value > 0);

  // Family allocation
  const familyMap: Record<string, number> = {};
  active.forEach(d => {
    familyMap[d.family_member_name] = (familyMap[d.family_member_name] || 0) + (d.maturity_amount || d.principal_amount);
  });
  const familyEntries = Object.entries(familyMap).sort((a, b) => b[1] - a[1]);

  // Maturity Timeline (Next 6 Months Liquidity Unlocking)
  const now = new Date();
  const next6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return {
      label: d.toLocaleString('en-IN', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  });

  const maturityTimelineValues = next6Months.map(monthObj => {
    return active.reduce((sum, d) => {
      if (!d.maturity_date) return sum;
      const matDate = new Date(d.maturity_date);
      if (matDate.getFullYear() === monthObj.year && matDate.getMonth() === monthObj.month) {
        return sum + (d.maturity_amount || d.principal_amount);
      }
      return sum;
    }, 0);
  });

  const hasUpcomingMaturities = maturityTimelineValues.some(v => v > 0);

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.text1} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageHeader}>Analytics</Text>
          <Text style={styles.pageSubheader}>Insights into your wealth distribution.</Text>
        </View>
      </View>

      {/* Portfolio Overview */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Portfolio Overview</Text>
        </View>
        {portfolioData.length > 0 ? (
          <>
            <View style={styles.donutWrap}>
              <DonutChart data={portfolioData} total={totalMaturity} />
              <View style={styles.donutCenter}>
                <Text style={styles.donutLabel}>Total Value</Text>
                <Text style={styles.donutAmount}>{formatCurrency(totalMaturity)}</Text>
              </View>
            </View>
            <View style={styles.legendList}>
              {portfolioData.map((item, i) => (
                <View key={i} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color, borderWidth: item.color === '#FFFFFF' ? 1 : 0, borderColor: colors.separator }]} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                  <Text style={styles.legendPct}>{formatCurrencyFull(item.value)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>No active deposits</Text>
        )}
      </View>

      <View style={styles.bentoGrid}>
        <View style={styles.bentoCard}>
          <Text style={styles.bentoTitle}>RD Monthly</Text>
          <Text style={styles.bentoValue}>{formatCurrencyFull(totalRDMonthly)}</Text>
          <Text style={styles.bentoSubtitle}>Required Cash Flow</Text>
        </View>
        <View style={[styles.bentoCard, { backgroundColor: colors.lavender }]}>
          <Text style={[styles.bentoTitle, { color: 'rgba(255,255,255,0.7)' }]}>Active Deposits</Text>
          <Text style={[styles.bentoValue, { color: colors.white }]}>{active.length}</Text>
          <Text style={[styles.bentoSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>Currently growing</Text>
        </View>
      </View>

      {/* Maturity Timeline */}
      <View style={styles.card}>
        <View style={styles.forecastHeader}>
          <View>
            <Text style={styles.cardTitle}>Upcoming Liquidity</Text>
            <Text style={styles.forecastSubtitle}>Maturity amounts unlocking soon</Text>
          </View>
        </View>
        {hasUpcomingMaturities ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barWrap}>
            <View>
              <BarChart months={next6Months.map(m => m.label)} values={maturityTimelineValues} />
              <View style={styles.barLabels}>
                {next6Months.map((m, i) => (
                  <Text key={i} style={[styles.barLabel, maturityTimelineValues[i] > 0 && styles.barLabelActive]}>{m.label}</Text>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No deposits maturing in the next 6 months.</Text>
        )}
      </View>

      {/* Portfolio Distribution */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Bank Distribution</Text>
        </View>
        {bankData.length > 0 ? (
          <>
            <View style={styles.donutWrap}>
              <DonutChart data={bankData} total={totalMaturity} />
              <View style={styles.donutCenter}>
                <Text style={styles.donutLabel}>Total Value</Text>
                <Text style={styles.donutAmount}>{formatCurrency(totalMaturity)}</Text>
              </View>
            </View>
            <View style={styles.legendList}>
              {bankData.map((item, i) => (
                <View key={i} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color, borderWidth: item.color === '#FFFFFF' ? 1 : 0, borderColor: colors.separator }]} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                  <Text style={styles.legendPct}>{Math.round((item.value / totalMaturity) * 100)}%</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>No deposits yet</Text>
        )}
      </View>

      <View style={styles.splitCards}>
        {/* Product Mix */}
        <View style={[styles.card, styles.splitCard]}>
          <Text style={styles.cardTitle}>Product Mix</Text>
          {productData.length > 0 ? (
            <View style={{ alignItems: 'center' }}>
              <PieChart data={productData} total={fdValue + rdValue} />
              <View style={[styles.productLegend, { marginTop: 16 }]}>
                {productData.map((item, i) => (
                  <View key={i} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel}>{item.label}</Text>
                    <Text style={styles.legendPct}>{Math.round((item.value / (fdValue + rdValue)) * 100)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>-</Text>
          )}
        </View>

        {/* Family Allocation */}
        <View style={[styles.card, styles.splitCard]}>
          <Text style={styles.cardTitle}>Family</Text>
          {familyEntries.length > 0 ? (
            <View style={styles.familyList}>
              {familyEntries.map(([name, value], i) => {
                const pct = totalMaturity > 0 ? (value / totalMaturity) : 0;
                return (
                  <View key={i} style={styles.familyItem}>
                    <View style={styles.familyItemHeader}>
                      <Text style={styles.familyName} numberOfLines={1}>{name}</Text>
                    </View>
                    <View style={styles.familyItemHeader}>
                      <Text style={styles.familyAmount}>{formatCurrency(value)}</Text>
                      <Text style={styles.familyPct}>{Math.round(pct * 100)}%</Text>
                    </View>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, {
                        width: `${pct * 100}%`,
                        backgroundColor: BANK_COLORS[i] || colors.text3,
                      }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>-</Text>
          )}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },
  loader: { flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  pageHeader: { fontSize: 28, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.8 },
  pageSubheader: { fontSize: 14, fontFamily: typography.regular, color: colors.text3, marginTop: 4, marginBottom: 8 },

  bentoGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  bentoTitle: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.text3,
    marginBottom: 6,
  },
  bentoValue: {
    fontSize: 22,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  bentoSubtitle: {
    fontSize: 11,
    fontFamily: typography.regular,
    color: colors.text3,
  },

  splitCards: {
    flexDirection: 'row',
    gap: 16,
  },
  splitCard: {
    flex: 1,
  },

  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 16, fontFamily: typography.bold, color: colors.text1 },

  donutWrap: { alignItems: 'center', position: 'relative', marginBottom: 20 },
  donutCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutAmount: { fontSize: 18, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.5, marginTop: 2 },
  donutLabel: { fontSize: 11, fontFamily: typography.medium, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.5 },

  legendList: { gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, fontFamily: typography.medium, color: colors.text2 },
  legendPct: { fontSize: 13, fontFamily: typography.bold, color: colors.text1 },

  productLegend: { gap: 12, width: '100%' },

  familyList: { gap: 16, marginTop: 12 },
  familyItem: { gap: 6 },
  familyItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  familyName: { flex: 1, fontSize: 13, fontFamily: typography.semiBold, color: colors.text1, paddingRight: 8 },
  familyAmount: { fontSize: 13, fontFamily: typography.bold, color: colors.text1 },
  familyPct: { fontSize: 11, fontFamily: typography.medium, color: colors.text3, marginLeft: 8, width: 30, textAlign: 'right' },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgBase,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },

  forecastHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  forecastSubtitle: { fontSize: 12, fontFamily: typography.regular, color: colors.text3, marginTop: 4 },
  barWrap: { marginTop: 12 },
  barLabels: { flexDirection: 'row', gap: 12, paddingHorizontal: 10, paddingTop: 10 },
  barLabel: { width: 28, fontSize: 11, fontFamily: typography.regular, color: colors.text3, textAlign: 'center' },
  barLabelActive: { color: colors.text1, fontFamily: typography.bold },

  emptyText: { fontFamily: typography.regular, color: colors.text3, textAlign: 'center', paddingVertical: 10, fontSize: 13 },
});
