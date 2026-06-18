import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, TrendingUp } from 'lucide-react-native';
import { colors, radius, shadows, typography } from '@/constants/theme';
import { getDeposits, Deposit } from '@/lib/storage';
import { formatCurrencyFull, getDaysUntilMaturity, getMaturityLabel } from '@/lib/calculations';

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  const fetchDeposits = async () => {
    try {
      const data = await getDeposits();
      setDeposits(data.filter(d => d.status !== 'closed'));
    } catch (error) {
      console.error('Failed to load deposits for calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDeposits();
    }, [])
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  // Calendar math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...

  const daysArray: (number | null)[] = [];
  // Pad beginning of week
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  // Fill month days
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Find deposits maturing on a specific day in the currently displayed month/year
  const getMaturitiesForDay = (day: number) => {
    return deposits.filter(d => {
      if (!d.maturity_date) return false;
      const mDate = new Date(d.maturity_date);
      return (
        mDate.getFullYear() === year &&
        mDate.getMonth() === month &&
        mDate.getDate() === day
      );
    });
  };

  const selectedMaturities = getMaturitiesForDay(selectedDay);

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.mint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={colors.text1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maturity Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Month Switcher Header */}
        <View style={styles.monthHeader}>
          <TouchableOpacity style={styles.navBtn} onPress={handlePrevMonth}>
            <ChevronLeft size={20} color={colors.text1} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {monthName} {year}
          </Text>
          <TouchableOpacity style={styles.navBtn} onPress={handleNextMonth}>
            <ChevronRight size={20} color={colors.text1} />
          </TouchableOpacity>
        </View>

        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          {/* Weekday Labels */}
          <View style={styles.weekdaysRow}>
            {weekdays.map(d => (
              <Text key={d} style={styles.weekdayText}>
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {daysArray.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }

              const maturities = getMaturitiesForDay(day);
              const hasYellow = maturities.some(d => {
                const daysLeft = getDaysUntilMaturity(d.maturity_date);
                return d.status === 'matured' || (daysLeft !== null && daysLeft <= 30);
              });
              const hasGreen = maturities.some(d => {
                const daysLeft = getDaysUntilMaturity(d.maturity_date);
                return d.status === 'active' && (daysLeft !== null && daysLeft > 30);
              });
              const isSelected = selectedDay === day;

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.selectedDayCell,
                  ]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.selectedDayText,
                    ]}
                  >
                    {day}
                  </Text>

                  {/* Indicators */}
                  <View style={styles.indicatorContainer}>
                    {hasYellow && <View style={[styles.dot, { backgroundColor: colors.gold }]} />}
                    {hasGreen && <View style={[styles.dot, { backgroundColor: colors.mint }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected Day Maturities Section */}
        <View style={styles.maturitiesSection}>
          <Text style={styles.sectionTitle}>
            Maturities on {selectedDay} {monthName}
          </Text>

          {selectedMaturities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No deposits maturing on this day.</Text>
            </View>
          ) : (
            selectedMaturities.map(d => {
              const isFD = d.type === 'FD';
              const label = getMaturityLabel(d.maturity_date, d.status);
              const isMatured = d.status === 'matured' || label === 'Matured';
              const isClosed = d.status === 'closed' || label === 'Closed';
              const daysLeft = getDaysUntilMaturity(d.maturity_date);
              const isAboutToMature = !isMatured && !isClosed && daysLeft !== null && daysLeft <= 30;

              let accentColor = colors.mint; // default green for active
              let accentSoft = colors.mintSoft;

              if (isMatured || isAboutToMature) {
                accentColor = colors.gold;
                accentSoft = colors.goldSoft;
              } else if (isClosed) {
                accentColor = colors.error;
                accentSoft = '#FEE2E2';
              }

              return (
                <TouchableOpacity
                  key={d.id}
                  style={styles.depositCard}
                  onPress={() => router.push(`/deposit/${d.id}` as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.depositIcon, { backgroundColor: isFD ? colors.blueSoft : colors.lavenderSoft }]}>
                    <Text style={{ fontSize: 13, fontFamily: typography.bold, color: isFD ? colors.blue : colors.lavender }}>
                      {d.type}
                    </Text>
                  </View>
                  <View style={styles.depositInfo}>
                    <Text style={styles.depositName} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={styles.depositBank}>
                      {d.bank} · {d.family_member_name}
                    </Text>
                  </View>
                  <View style={styles.depositRight}>
                    <Text style={styles.depositValue}>
                      {formatCurrencyFull(d.maturity_amount || d.principal_amount)}
                    </Text>
                    <Text style={styles.depositRate}>{d.interest_rate}% p.a.</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  loader: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    backgroundColor: colors.bgElevated,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgTertiary,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  monthTitle: {
    fontSize: 18,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.4,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  calendarCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 16,
    ...shadows.sm,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayText: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.semiBold,
    color: colors.text4,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingVertical: 2,
  },
  selectedDayCell: {
    backgroundColor: colors.black,
  },
  dayText: {
    fontSize: 14,
    fontFamily: typography.semiBold,
    color: colors.text1,
  },
  selectedDayText: {
    color: colors.white,
    fontFamily: typography.bold,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  maturitiesSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.bold,
    color: colors.text1,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.text3,
    fontSize: 14,
  },
  depositCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  depositIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositInfo: {
    flex: 1,
  },
  depositName: {
    fontSize: 14,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.2,
  },
  depositBank: {
    fontSize: 12,
    color: colors.text3,
    marginTop: 2,
    fontFamily: typography.regular,
  },
  depositRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  depositValue: {
    fontSize: 14,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.3,
  },
  depositRate: {
    fontSize: 11,
    color: colors.text3,
    fontFamily: typography.regular,
  },
});
