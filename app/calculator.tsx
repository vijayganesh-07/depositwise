import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calculator, Percent, DollarSign, Calendar } from 'lucide-react-native';
import { colors, radius, shadows, typography } from '@/constants/theme';
import { calculateFDMaturity, calculateRDMaturity, formatCurrencyFull } from '@/lib/calculations';

type CalculatorTab = 'FD' | 'RD';

export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CalculatorTab>('FD');

  // FD States
  const [fdPrincipal, setFdPrincipal] = useState('100000');
  const [fdRate, setFdRate] = useState('7.10');
  const [fdYears, setFdYears] = useState('1');
  const [fdMonths, setFdMonths] = useState('0');
  const [fdDays, setFdDays] = useState('0');
  const [fdCompounding, setFdCompounding] = useState('Quarterly');

  // RD States
  const [rdMonthly, setRdMonthly] = useState('10000');
  const [rdRate, setRdRate] = useState('6.75');
  const [rdMonths, setRdMonths] = useState('12');

  const compoundingOptions = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annually'];

  // Calculations
  const pFD = parseFloat(fdPrincipal) || 0;
  const rFD = parseFloat(fdRate) || 0;
  const yFD = parseInt(fdYears, 10) || 0;
  const mFD = parseInt(fdMonths, 10) || 0;
  const dFD = parseInt(fdDays, 10) || 0;

  const fdResult = calculateFDMaturity(pFD, rFD, yFD, mFD, dFD, fdCompounding);

  const mRD = parseFloat(rdMonthly) || 0;
  const rRD = parseFloat(rdRate) || 0;
  const tRD = parseInt(rdMonths, 10) || 0;

  const rdResult = calculateRDMaturity(mRD, rRD, tRD, 'Quarterly'); // standard RDs compound quarterly
  const rdTotalInvested = mRD * tRD;

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
        <Text style={styles.headerTitle}>FD/RD Calculator</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'FD' && styles.activeTab]}
          onPress={() => setActiveTab('FD')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'FD' && styles.activeTabText]}>
            Fixed Deposit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'RD' && styles.activeTab]}
          onPress={() => setActiveTab('RD')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'RD' && styles.activeTabText]}>
            Recurring Deposit
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={120}
        extraHeight={120}
      >
        {activeTab === 'FD' ? (
          /* FD Input Area */
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>FD Parameters</Text>
            
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Principal Amount (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={fdPrincipal}
                onChangeText={setFdPrincipal}
                placeholder="e.g. 100000"
                placeholderTextColor={colors.text4}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Interest Rate (% p.a.)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={fdRate}
                onChangeText={setFdRate}
                placeholder="e.g. 7.10"
                placeholderTextColor={colors.text4}
              />
            </View>

            <View style={styles.tenureContainer}>
              <View style={styles.tenureItem}>
                <Text style={styles.label}>Years</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={fdYears}
                  onChangeText={setFdYears}
                  placeholder="Y"
                  placeholderTextColor={colors.text4}
                />
              </View>
              <View style={styles.tenureItem}>
                <Text style={styles.label}>Months</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={fdMonths}
                  onChangeText={setFdMonths}
                  placeholder="M"
                  placeholderTextColor={colors.text4}
                />
              </View>
              <View style={styles.tenureItem}>
                <Text style={styles.label}>Days</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={fdDays}
                  onChangeText={setFdDays}
                  placeholder="D"
                  placeholderTextColor={colors.text4}
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Compounding Frequency</Text>
              <View style={styles.optionsRow}>
                {compoundingOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionChip,
                      fdCompounding === option && styles.activeOptionChip,
                    ]}
                    onPress={() => setFdCompounding(option)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        fdCompounding === option && styles.activeOptionChipText,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : (
          /* RD Input Area */
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>RD Parameters</Text>
            
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Monthly Installment (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={rdMonthly}
                onChangeText={setRdMonthly}
                placeholder="e.g. 10000"
                placeholderTextColor={colors.text4}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Interest Rate (% p.a.)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={rdRate}
                onChangeText={setRdRate}
                placeholder="e.g. 6.75"
                placeholderTextColor={colors.text4}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Tenure (Total Months)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={rdMonths}
                onChangeText={setRdMonths}
                placeholder="e.g. 12"
                placeholderTextColor={colors.text4}
              />
            </View>
          </View>
        )}

        {/* Results Bento Box */}
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Forecast Breakdown</Text>
          
          <View style={styles.bigTotalWrap}>
            <Text style={styles.bigTotalLabel}>ESTIMATED MATURITY AMOUNT</Text>
            <Text style={styles.bigTotalAmount}>
              {formatCurrencyFull(
                activeTab === 'FD' ? fdResult.maturityAmount : rdResult.maturityAmount
              )}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.bentoGrid}>
            <View style={[styles.bentoItem, { backgroundColor: colors.lavenderSoft }]}>
              <Text style={styles.bentoLabel}>Total Invested</Text>
              <Text style={[styles.bentoValue, { color: colors.lavender }]}>
                {formatCurrencyFull(activeTab === 'FD' ? pFD : rdTotalInvested)}
              </Text>
            </View>

            <View style={[styles.bentoItem, { backgroundColor: colors.mintSoft }]}>
              <Text style={styles.bentoLabel}>Est. Interest Earned</Text>
              <Text style={[styles.bentoValue, { color: colors.mint }]}>
                {formatCurrencyFull(
                  activeTab === 'FD' ? fdResult.interestEarned : rdResult.interestEarned
                )}
              </Text>
            </View>
          </View>

          <View style={[styles.bentoItem, { backgroundColor: colors.bgTertiary, marginTop: 12 }]}>
            <Text style={styles.bentoLabel}>Effective Annual Yield</Text>
            <Text style={[styles.bentoValue, { color: colors.text1 }]}>
              {(activeTab === 'FD' ? fdResult.effectiveYield : rdResult.effectiveYield).toFixed(2)}%
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.pill,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  activeTab: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  tabText: {
    fontSize: 14,
    fontFamily: typography.semiBold,
    color: colors.text3,
  },
  activeTabText: {
    color: colors.text1,
    fontFamily: typography.bold,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 20,
    gap: 16,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.bold,
    color: colors.text1,
    marginBottom: 4,
  },
  inputWrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.text2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: radius.xs,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text1,
    backgroundColor: colors.bgBase,
    outlineStyle: 'none' as any,
  },
  tenureContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  tenureItem: {
    flex: 1,
    gap: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeOptionChip: {
    backgroundColor: colors.mintSoft,
    borderColor: colors.mintBg,
  },
  optionChipText: {
    fontSize: 12,
    fontFamily: typography.semiBold,
    color: colors.text3,
  },
  activeOptionChipText: {
    color: colors.mint,
    fontFamily: typography.bold,
  },
  resultsCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 20,
    ...shadows.sm,
  },
  resultsTitle: {
    fontSize: 16,
    fontFamily: typography.bold,
    color: colors.text1,
    marginBottom: 16,
  },
  bigTotalWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bigTotalLabel: {
    fontSize: 11,
    fontFamily: typography.bold,
    color: colors.text3,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bigTotalAmount: {
    fontSize: 30,
    fontFamily: typography.bold,
    color: colors.mint,
    letterSpacing: -0.8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.separator,
    marginVertical: 16,
  },
  bentoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoItem: {
    flex: 1,
    borderRadius: radius.card,
    padding: 14,
    gap: 4,
  },
  bentoLabel: {
    fontSize: 11,
    fontFamily: typography.medium,
    color: colors.text3,
  },
  bentoValue: {
    fontSize: 16,
    fontFamily: typography.bold,
    letterSpacing: -0.2,
  },
});
