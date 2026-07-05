import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, G, Rect, Text as SvgText } from 'react-native-svg';
import { colors, radius, shadows, typography } from '@/constants/theme';
import { getDeposits, Deposit } from '@/lib/storage';
import { formatCurrency, formatCurrencyFull } from '@/lib/calculations';

const SCREEN_WIDTH = Dimensions.get('window').width;

// === Premium Color Palette ===
const CHART_COLORS = [
  colors.lavender, // orange
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#0ea5e9', // cyan
  '#f59e0b', // amber
  '#ec4899', // pink
  '#6366f1', // indigo
  '#10b981', // emerald
];
const FD_COLOR = '#8b5cf6';
const RD_COLOR = colors.lavender;
const INTEREST_COLOR = colors.lavender; // orange
const PRINCIPAL_COLOR = '#8b5cf6'; // violet

// =====================
// Animated Bar Component
// =====================
function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 700,
      delay,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={animBarStyles.bg}>
      <Animated.View style={[animBarStyles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

const animBarStyles = StyleSheet.create({
  bg: { height: 8, borderRadius: 4, backgroundColor: colors.bgTertiary, overflow: 'hidden', flex: 1 },
  fill: { height: 8, borderRadius: 4 },
});

// =====================
// Donut Chart (SVG)
// =====================
function DonutChart({ data, total, centerLabel, centerAmount }: {
  data: { label: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
  centerAmount: string;
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 82;
  const innerR = 58;
  let cumAngle = -Math.PI / 2;
  const gap = 0.03;

  if (total === 0 || data.length === 0) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={outerR} stroke={colors.separator} strokeWidth={outerR - innerR} fill="none" />
        <Circle cx={cx} cy={cy} r={innerR - 4} fill={colors.bgElevated} />
      </Svg>
    );
  }

  const arcs = data.map(item => {
    const fraction = item.value / total;
    const sweep = Math.max(fraction * 2 * Math.PI - gap, 0.01);
    const startAngle = cumAngle + gap / 2;
    const endAngle = startAngle + sweep;
    cumAngle = startAngle + sweep + gap / 2;

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
      <Circle cx={cx} cy={cy} r={innerR - 2} fill={colors.bgElevated} />
    </Svg>
  );
}

// =====================
// Rate Comparison Bars
// =====================
function RateBar({ rate, maxRate, color }: { rate: number; maxRate: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: rate / maxRate, duration: 800, delay: 100, useNativeDriver: false }).start();
  }, [rate]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.bgTertiary, overflow: 'hidden', flex: 1 }}>
      <Animated.View style={{ height: 7, borderRadius: 4, backgroundColor: color, width }} />
    </View>
  );
}

// =====================
// Main Screen
// =====================
export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown'>('overview');

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
    const sub = DeviceEventEmitter.addListener('deposits_changed', fetchDeposits);
    return () => sub.remove();
  }, []);

  const active = deposits.filter(d => d.status === 'active');

  // === Core Metrics ===
  const totalPrincipal = active.reduce((s, d) => s + d.principal_amount, 0);
  const totalMaturity = active.reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);
  const totalInterest = active.reduce((s, d) => s + (d.interest_earned || (d.maturity_amount ? d.maturity_amount - d.principal_amount : 0)), 0);
  const overallGain = totalPrincipal > 0 ? ((totalInterest / totalPrincipal) * 100) : 0;
  const blendedYield = totalPrincipal > 0
    ? active.reduce((s, d) => s + (d.principal_amount * d.interest_rate), 0) / totalPrincipal
    : 0;

  // === Bank Distribution ===
  const bankMap: Record<string, number> = {};
  active.forEach(d => {
    bankMap[d.bank] = (bankMap[d.bank] || 0) + (d.maturity_amount || d.principal_amount);
  });
  const bankData = Object.entries(bankMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({ label, value, color: CHART_COLORS[i] || colors.bgTertiary }));
  const bankTotal = bankData.reduce((s, d) => s + d.value, 0);

  // === Product Mix ===
  const fdValue = active.filter(d => d.type === 'FD').reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);
  const rdValue = active.filter(d => d.type === 'RD').reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);
  const productData = [
    { label: 'Fixed Deposits', value: fdValue, color: FD_COLOR },
    { label: 'Recurring Deposits', value: rdValue, color: RD_COLOR },
  ].filter(d => d.value > 0);
  const productTotal = fdValue + rdValue;

  // === Family Allocation ===
  const familyMap: Record<string, number> = {};
  active.forEach(d => {
    familyMap[d.family_member_name] = (familyMap[d.family_member_name] || 0) + (d.maturity_amount || d.principal_amount);
  });
  const familyEntries = Object.entries(familyMap).sort((a, b) => b[1] - a[1]);

  // === Portfolio donut data ===
  const overviewData = [
    { label: 'Principal', value: totalPrincipal, color: PRINCIPAL_COLOR },
    { label: 'Interest', value: totalInterest, color: INTEREST_COLOR },
  ].filter(d => d.value > 0);

  // === Maturity Timeline ===
  const now = new Date();
  const next6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { label: d.toLocaleString('en-IN', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() };
  });
  const maturityValues = next6Months.map(m =>
    active.reduce((s, d) => {
      if (!d.maturity_date) return s;
      const md = new Date(d.maturity_date);
      return md.getFullYear() === m.year && md.getMonth() === m.month ? s + (d.maturity_amount || d.principal_amount) : s;
    }, 0)
  );
  const hasUpcomingMaturities = maturityValues.some(v => v > 0);

  // === Interest Rate Comparison ===
  const rateData = active
    .sort((a, b) => b.interest_rate - a.interest_rate)
    .slice(0, 5)
    .map((d, i) => ({ name: d.name, rate: d.interest_rate, bank: d.bank, color: CHART_COLORS[i] }));
  const maxRate = rateData.length > 0 ? Math.max(...rateData.map(d => d.rate)) : 10;

  // === RD Commitment ===
  const totalRDMonthly = active
    .filter(d => d.type === 'RD' && d.tenure_months > 0)
    .reduce((s, d) => s + (d.principal_amount / d.tenure_months), 0);

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={FD_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageHeader}>Analytics</Text>
          <Text style={styles.pageSubheader}>Deep dive into your portfolio</Text>
        </View>
      </View>

      {/* Hero Summary Card */}
      <LinearGradient
        colors={[colors.text1, colors.text2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>Total Portfolio Value</Text>
        <Text style={styles.heroAmount}>{formatCurrencyFull(totalMaturity)}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Invested</Text>
            <Text style={styles.heroStatValue}>{formatCurrency(totalPrincipal)}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Interest</Text>
            <Text style={[styles.heroStatValue, { color: colors.mint }]}>{formatCurrency(totalInterest)}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Gain</Text>
            <Text style={[styles.heroStatValue, { color: colors.mint }]}>+{overallGain.toFixed(1)}%</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: colors.mint, borderColor: colors.mintDim, borderLeftWidth: 1 }]}>
          <Text style={[styles.metricLabel, { color: colors.text2 }]}>Blended Yield</Text>
          <Text style={[styles.metricValue, { color: colors.text1 }]}>{blendedYield.toFixed(2)}%</Text>
          <Text style={[styles.metricSub, { color: colors.text2 }]}>Weighted avg rate</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: colors.lavender, borderColor: colors.lavenderDim, borderLeftWidth: 1 }]}>
          <Text style={[styles.metricLabel, { color: colors.white, opacity: 0.9 }]}>Active Deposits</Text>
          <Text style={[styles.metricValue, { color: colors.white }]}>{active.length}</Text>
          <Text style={[styles.metricSub, { color: colors.white, opacity: 0.9 }]}>Currently growing</Text>
        </View>
        {totalRDMonthly > 0 && (
          <View style={[styles.metricCard, { backgroundColor: colors.text1, borderColor: colors.text2, borderLeftWidth: 1 }]}>
            <Text style={[styles.metricLabel, { color: colors.text4 }]}>RD Monthly</Text>
            <Text style={[styles.metricValue, { color: colors.white }]}>{formatCurrency(totalRDMonthly)}</Text>
            <Text style={[styles.metricSub, { color: colors.text4 }]}>Cash flow needed</Text>
          </View>
        )}
      </View>

      {/* Portfolio Breakdown Section */}
      {active.length > 0 && (
        <>
          {/* Product Mix + Donut */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Portfolio Composition</Text>
            <Text style={styles.cardSubtitle}>Principal vs Interest earned</Text>

            <View style={styles.donutRow}>
              <View style={styles.donutContainer}>
                <DonutChart
                  data={overviewData}
                  total={totalMaturity}
                  centerLabel="Total"
                  centerAmount={formatCurrency(totalMaturity)}
                />
                <View style={styles.donutOverlay}>
                  <Text style={styles.donutCenterLabel}>Total</Text>
                  <Text style={styles.donutCenterAmount}>{formatCurrency(totalMaturity)}</Text>
                </View>
              </View>

              <View style={styles.donutLegend}>
                {overviewData.map((item, i) => (
                  <View key={i} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <View style={styles.legendText}>
                      <Text style={styles.legendLabel}>{item.label}</Text>
                      <Text style={styles.legendAmount}>{formatCurrencyFull(item.value)}</Text>
                      <Text style={styles.legendPct}>
                        {totalMaturity > 0 ? Math.round((item.value / totalMaturity) * 100) : 0}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* FD vs RD Split */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Product Mix</Text>
            <Text style={styles.cardSubtitle}>FD vs RD allocation by maturity value</Text>
            <View style={{ marginTop: 16, gap: 14 }}>
              {productData.map((item, i) => {
                const pct = productTotal > 0 ? item.value / productTotal : 0;
                const isFD = item.label === 'Fixed Deposits';
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => router.push({ pathname: '/(tabs)/deposits', params: { typeFilter: isFD ? 'FD' : 'RD' } })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.barRow}>
                      <View style={[styles.productBadge, { backgroundColor: isFD ? colors.mint : colors.lavender }]}>
                        <Text style={[styles.productBadgeText, { color: isFD ? colors.text1 : colors.white }]}>
                          {isFD ? 'FD' : 'RD'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.barLabelRow}>
                          <Text style={styles.barItemLabel}>{item.label}</Text>
                          <Text style={styles.barItemPct}>{Math.round(pct * 100)}%</Text>
                        </View>
                        <AnimatedBar pct={pct} color={colors.text1} delay={i * 100} />
                        <Text style={styles.barItemAmount}>{formatCurrencyFull(item.value)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Bank Distribution */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bank Distribution</Text>
            <Text style={styles.cardSubtitle}>Maturity value by institution · tap to filter</Text>
            <View style={{ marginTop: 16, gap: 16 }}>
              {bankData.map((item, i) => {
                const pct = bankTotal > 0 ? item.value / bankTotal : 0;
                return (
                  <TouchableOpacity key={i} onPress={() => router.push({ pathname: '/(tabs)/deposits', params: { bankFilter: item.label } })} activeOpacity={0.7}>
                    <View style={styles.barRow}>
                      <View style={[styles.bankDot, { backgroundColor: item.color }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.barLabelRow}>
                          <Text style={styles.barItemLabel}>{item.label}</Text>
                          <Text style={styles.barItemPct}>{Math.round(pct * 100)}%</Text>
                        </View>
                        <AnimatedBar pct={pct} color={item.color} delay={i * 80} />
                        <Text style={styles.barItemAmount}>{formatCurrencyFull(item.value)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Family Allocation */}
          {familyEntries.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Family Allocation</Text>
              <Text style={styles.cardSubtitle}>Wealth distributed across members · tap to filter</Text>
              <View style={{ marginTop: 16, gap: 16 }}>
                {familyEntries.map(([name, value], i) => {
                  const pct = totalMaturity > 0 ? value / totalMaturity : 0;
                  return (
                    <TouchableOpacity key={i} onPress={() => router.push({ pathname: '/(tabs)/deposits', params: { memberFilter: name } })} activeOpacity={0.7}>
                      <View style={styles.barRow}>
                        <View style={[styles.avatarCircle, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '22' }]}>
                          <Text style={[styles.avatarLetter, { color: CHART_COLORS[i % CHART_COLORS.length] }]}>
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.barLabelRow}>
                            <Text style={styles.barItemLabel}>{name}</Text>
                            <Text style={styles.barItemPct}>{Math.round(pct * 100)}%</Text>
                          </View>
                          <AnimatedBar pct={pct} color={CHART_COLORS[i % CHART_COLORS.length]} delay={i * 80} />
                          <Text style={styles.barItemAmount}>{formatCurrencyFull(value)}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Maturity Timeline */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Upcoming Liquidity</Text>
            <Text style={styles.cardSubtitle}>Maturity amounts unlocking in next 6 months</Text>
            <View style={{ marginTop: 20 }}>
              {hasUpcomingMaturities ? (
                <View style={styles.liquidityGrid}>
                  {next6Months.map((m, i) => {
                    const val = maturityValues[i];
                    const hasLiquidity = val > 0;
                    const boxColor = hasLiquidity ? CHART_COLORS[i % CHART_COLORS.length] : colors.bgBase;
                    const textColor = hasLiquidity ? colors.white : colors.text4;
                    const subTextColor = hasLiquidity ? 'rgba(255,255,255,0.8)' : colors.text2;

                    return (
                      <View 
                        key={i} 
                        style={[
                          styles.liquidityBox, 
                          { backgroundColor: boxColor, borderColor: hasLiquidity ? boxColor : colors.separator }
                        ]}
                      >
                        <View style={styles.liquidityBoxHeader}>
                          <Text style={[styles.liquidityMonth, { color: subTextColor }]}>{m.label}</Text>
                        </View>
                        <Text style={[styles.liquidityAmount, { color: textColor }]}>
                          {hasLiquidity ? formatCurrencyFull(val) : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📅</Text>
                  <Text style={styles.emptyText}>No deposits maturing in the next 6 months</Text>
                </View>
              )}
            </View>
          </View>

          {/* Interest Rate Comparison */}
          {rateData.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top Interest Rates</Text>
              <Text style={styles.cardSubtitle}>Highest yielding deposits in your portfolio</Text>
              <View style={{ marginTop: 16, gap: 14 }}>
                {rateData.map((item, i) => (
                  <View key={i} style={styles.rateRow}>
                    <View style={styles.rateRank}>
                      <Text style={[styles.rateRankText, { color: CHART_COLORS[i] }]}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.barLabelRow}>
                        <View>
                          <Text style={styles.barItemLabel} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.rateBank}>{item.bank}</Text>
                        </View>
                        <Text style={[styles.rateValue, { color: CHART_COLORS[i] }]}>{item.rate.toFixed(2)}%</Text>
                      </View>
                      <RateBar rate={item.rate} maxRate={maxRate} color={CHART_COLORS[i]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {active.length === 0 && (
        <View style={styles.emptyFullState}>
          <Text style={styles.emptyFullIcon}>📊</Text>
          <Text style={styles.emptyFullTitle}>No Active Deposits</Text>
          <Text style={styles.emptyFullSub}>Add deposits to see your analytics breakdown here</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 14 },
  loader: { flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  pageHeader: { fontSize: 28, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.8 },
  pageSubheader: { fontSize: 14, fontFamily: typography.regular, color: colors.text3, marginTop: 2 },

  // Hero Card
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginTop: 4,
  },
  heroLabel: { fontSize: 12, fontFamily: typography.medium, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  heroAmount: { fontSize: 34, fontFamily: typography.bold, color: colors.white, letterSpacing: -1, marginTop: 6, marginBottom: 20 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontSize: 11, fontFamily: typography.regular, color: 'rgba(255,255,255,0.55)', marginBottom: 4 },
  heroStatValue: { fontSize: 15, fontFamily: typography.bold, color: colors.white },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Metric Cards
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  metricLabel: { fontSize: 11, fontFamily: typography.medium, color: colors.text3, marginBottom: 6 },
  metricValue: { fontSize: 18, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.4 },
  metricSub: { fontSize: 10, fontFamily: typography.regular, color: colors.text4, marginTop: 3 },

  // Cards
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  cardTitle: { fontSize: 16, fontFamily: typography.bold, color: colors.text1 },
  cardSubtitle: { fontSize: 12, fontFamily: typography.regular, color: colors.text3, marginTop: 3 },

  // Donut Chart
  donutRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 16 },
  donutContainer: { position: 'relative', width: 200, height: 200 },
  donutOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: { fontSize: 11, fontFamily: typography.medium, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
  donutCenterAmount: { fontSize: 16, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.4, marginTop: 2 },
  donutLegend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  legendText: { flex: 1 },
  legendLabel: { fontSize: 12, fontFamily: typography.medium, color: colors.text2 },
  legendAmount: { fontSize: 13, fontFamily: typography.bold, color: colors.text1, marginTop: 1 },
  legendPct: { fontSize: 11, fontFamily: typography.regular, color: colors.text3, marginTop: 1 },

  // Bar rows
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  barItemLabel: { fontSize: 13, fontFamily: typography.semiBold, color: colors.text1, flex: 1, marginRight: 8 },
  barItemPct: { fontSize: 13, fontFamily: typography.bold, color: colors.text1 },
  barItemAmount: { fontSize: 11, fontFamily: typography.regular, color: colors.text3, marginTop: 4 },

  // Product badges
  productBadge: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  productBadgeText: { fontSize: 12, fontFamily: typography.bold },

  // Bank dot
  bankDot: { width: 12, height: 12, borderRadius: 6, marginTop: 10 },

  // Avatar
  avatarCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  avatarLetter: { fontSize: 15, fontFamily: typography.bold },

  // Rate comparison
  rateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rateRank: { width: 28, alignItems: 'center', paddingTop: 2 },
  rateRankText: { fontSize: 13, fontFamily: typography.bold },
  rateValue: { fontSize: 15, fontFamily: typography.bold, letterSpacing: -0.3 },
  rateBank: { fontSize: 11, fontFamily: typography.regular, color: colors.text3, marginTop: 1 },

  // Empty states
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 13, fontFamily: typography.regular, color: colors.text3, textAlign: 'center' },

  emptyFullState: { alignItems: 'center', paddingVertical: 60 },
  emptyFullIcon: { fontSize: 48, marginBottom: 16 },
  emptyFullTitle: { fontSize: 18, fontFamily: typography.bold, color: colors.text1, marginBottom: 8 },
  emptyFullSub: { fontSize: 14, fontFamily: typography.regular, color: colors.text3, textAlign: 'center' },

  // Liquidity Grid
  liquidityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  liquidityBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bgBase,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    justifyContent: 'center',
  },
  liquidityBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liquidityMonth: {
    fontSize: 12,
    fontFamily: typography.semiBold,
    color: colors.text2,
  },
  liquidityAmount: {
    fontSize: 15,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.3,
  },
  liquidityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
