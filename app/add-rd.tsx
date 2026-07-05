import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, TrendingUp, Lock, Check, ChevronDown, Trophy, Plus, Calendar } from 'lucide-react-native';
import { colors, radius, shadows, BANKS, COMPOUNDING_OPTIONS, typography } from '@/constants/theme';
import { getDepositById, saveDeposit, getFamilyMembers, addFamilyMember, getCustomBanks, addCustomBank, RDPayment, getUpdatedRDPayments } from '@/lib/storage';
import { calculateRDMaturity, formatCurrencyFull, formatMaturityDate } from '@/lib/calculations';
import DatePickerModal from '@/components/DatePickerModal';
import IOSSwitch from '@/components/IOSSwitch';

function DropdownModal({
  visible, onClose, options, value, onSelect, title, onAddNew, addNewPlaceholder,
}: {
  visible: boolean; onClose: () => void; options: string[]; value: string; onSelect: (v: string) => void; title: string;
  onAddNew?: (v: string) => Promise<void>; addNewPlaceholder?: string;
}) {
  const [newVal, setNewVal] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          {onAddNew && (
            <View style={styles.modalAddRow}>
              <TextInput
                style={styles.modalInput}
                placeholder={addNewPlaceholder || "Add custom..."}
                placeholderTextColor={colors.text4}
                value={newVal}
                onChangeText={setNewVal}
              />
              <TouchableOpacity
                style={styles.modalAddBtn}
                onPress={async () => {
                  if (newVal.trim()) {
                    const formattedVal = newVal.trim().toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    await onAddNew(formattedVal);
                    onSelect(formattedVal);
                    setNewVal('');
                    onClose();
                  }
                }}
              >
                <Plus size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item === value && styles.modalItemActive]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[styles.modalItemText, item === value && styles.modalItemTextActive]}>{item}</Text>
                {item === value && <Check size={16} color={colors.lavender} />}
              </TouchableOpacity>
            )}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function AddRDScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit: string }>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMaturityDatePicker, setShowMaturityDatePicker] = useState(false);
  const [bank, setBank] = useState('');
  const [familyMember, setFamilyMember] = useState('');
  const [monthlyDeposit, setMonthlyDeposit] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');
  const [compounding, setCompounding] = useState('Quarterly');
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [accountRef, setAccountRef] = useState('');
  const [notes, setNotes] = useState('');
  const [existingPayments, setExistingPayments] = useState<RDPayment[] | null>(null);

  // Manual input overrides
  const [manualMaturityAmount, setManualMaturityAmount] = useState('');
  const [manualMaturityDate, setManualMaturityDate] = useState('');

  const [banksList, setBanksList] = useState<string[]>(BANKS);
  const [membersList, setMembersList] = useState<string[]>([]);

  const [bankDropdown, setBankDropdown] = useState(false);
  const [memberDropdown, setMemberDropdown] = useState(false);

  const parseNumeric = (val: string) => {
    if (!val) return 0;
    const cleaned = val.replace(/,/g, '').replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentStateStr = JSON.stringify({
    name, startDate, bank, familyMember, monthlyDeposit, interestRate, tenureMonths, compounding, autoCalculate, autoRenewal, accountRef, notes, manualMaturityAmount, manualMaturityDate
  });
  const [initialStateStr, setInitialStateStr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && initialStateStr === null) {
      setInitialStateStr(currentStateStr);
    }
  }, [loading, currentStateStr, initialStateStr]);

  const hasUnsavedChanges = initialStateStr !== null && currentStateStr !== initialStateStr;

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges && !saving) {
      if (Platform.OS === 'web') {
        const confirm = window.confirm('You have unsaved changes. Are you sure you want to discard them and leave?');
        if (confirm) router.back();
      } else {
        Alert.alert(
          'Discard changes?',
          'You have unsaved changes. Are you sure you want to discard them and leave?',
          [
            { text: "Don't leave", style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => router.back(),
            },
          ]
        );
      }
      return true;
    }
    router.back();
    return true; // Used for hardware back
  }, [hasUnsavedChanges, saving, router]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (hasUnsavedChanges && !saving) {
          handleBack();
          return true; // Prevent default
        }
        return false; // Let default happen
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [hasUnsavedChanges, saving, handleBack]);

  const md = parseNumeric(monthlyDeposit);
  const r = parseNumeric(interestRate);
  const tm = parseNumeric(tenureMonths);

  const maturityCalc = (md > 0 && r > 0 && tm > 0)
    ? calculateRDMaturity(md, r, tm, compounding, startDate)
    : null;

  // Load custom family members and banks dynamically
  useEffect(() => {
    const initData = async () => {
      const dbMembers = await getFamilyMembers();
      setMembersList(dbMembers);

      const dbCustomBanks = await getCustomBanks();
      setBanksList([...BANKS, ...dbCustomBanks]);

      if (!edit && dbMembers.length > 0) {
        setFamilyMember(dbMembers[0]);
      }

      if (edit) {
        const d = await getDepositById(edit);
        if (d && d.type === 'RD') {
          setName(d.name);
          setStartDate(d.start_date);
          setBank(d.bank);
          setFamilyMember(d.family_member_name);
          if (d.tenure_months > 0) {
            setMonthlyDeposit((d.principal_amount / d.tenure_months).toString());
          } else {
            setMonthlyDeposit(d.principal_amount.toString());
          }
          setInterestRate(d.interest_rate.toString());
          setTenureMonths(d.tenure_months.toString());
          setCompounding(d.compounding_frequency);
          setAutoRenewal(d.auto_renewal);
          setAccountRef(d.account_reference || '');
          setNotes(d.notes || '');
          setExistingPayments(d.rd_payments || null);

          if (d.maturity_amount !== null) {
            setManualMaturityAmount(d.maturity_amount.toString());
          }
          if (d.maturity_date) {
            setManualMaturityDate(d.maturity_date);
          }

          if (d.auto_calculate === false) {
            setAutoCalculate(false);
          } else if (d.auto_calculate === true) {
            setAutoCalculate(true);
          } else {
            const calc = (d.principal_amount > 0 && d.interest_rate > 0 && d.tenure_months > 0)
              ? calculateRDMaturity(d.principal_amount / d.tenure_months, d.interest_rate, d.tenure_months, d.compounding_frequency, d.start_date)
              : null;

            if (!calc || Math.abs(calc.maturityAmount - (d.maturity_amount || 0)) > 1) {
              setAutoCalculate(false);
            } else {
              setAutoCalculate(true);
            }
          }
        }
      }
      setLoading(false);
    };
    initData();
  }, [edit]);



  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!bank) newErrors.bank = 'Please select a bank';
    if (!md || md <= 0) newErrors.monthlyDeposit = 'Please enter a valid monthly deposit amount';

    let finalMaturityAmount: number | null = null;
    let finalInterestEarned: number | null = null;
    let finalMaturityDate: string | null = null;
    let finalEffectiveYield: number | null = null;

    if (autoCalculate) {
      if (!r || r <= 0) newErrors.interest = 'Please enter an interest rate';
      if (tm <= 0) newErrors.tenure = 'Please enter tenure in months';

      if (Object.keys(newErrors).length === 0 && !maturityCalc) {
        Alert.alert('Error', 'Could not calculate maturity details. Please check inputs.');
        return;
      }
      if (maturityCalc) {
        finalMaturityAmount = maturityCalc.maturityAmount;
        finalInterestEarned = maturityCalc.interestEarned;
        finalEffectiveYield = maturityCalc.effectiveYield;
        finalMaturityDate = maturityCalc.maturityDate.toISOString().split('T')[0];
      }
    } else {
      const matAmt = parseFloat(manualMaturityAmount);
      if (isNaN(matAmt) || matAmt <= 0) {
        newErrors.manualMaturityAmount = 'Please enter a valid maturity amount';
      }
      if (!manualMaturityDate.trim()) {
        newErrors.manualMaturityDate = 'Please enter a maturity date';
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(manualMaturityDate.trim())) {
        newErrors.manualMaturityDate = 'Invalid format. Use YYYY-MM-DD';
      }

      if (Object.keys(newErrors).length === 0) {
        finalMaturityAmount = matAmt;
        finalMaturityDate = manualMaturityDate.trim();

        finalInterestEarned = matAmt - (md * tm);

        if (r > 0) {
          finalEffectiveYield = r;
        } else {
          finalEffectiveYield = null;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert('Missing Fields', 'Please fill in all highlighted fields correctly.');
      return;
    }
    setErrors({});

    const finalPayments = getUpdatedRDPayments(
      existingPayments,
      md,
      tm,
      startDate
    );

    setSaving(true);
    const depositName = name || `RD - ${bank}`;

    try {
      await saveDeposit({
        id: edit || undefined,
        name: depositName,
        type: 'RD',
        bank,
        family_member_name: familyMember,
        principal_amount: md * tm,
        interest_rate: r,
        start_date: startDate,
        tenure_years: 0,
        tenure_months: tm,
        tenure_days: 0,
        compounding_frequency: compounding,
        interest_payout: 'Cumulative',
        maturity_amount: finalMaturityAmount,
        interest_earned: finalInterestEarned,
        effective_yield: finalEffectiveYield,
        maturity_date: finalMaturityDate,
        auto_renewal: autoRenewal,
        account_reference: accountRef || null,
        notes: notes || null,
        auto_calculate: autoCalculate,
        rd_payments: finalPayments,
      });
      setSaving(false);
      if (edit) {
        router.push('/' as any);
      } else {
        router.back();
      }
    } catch (error) {
      setSaving(false);
      Alert.alert('Error', 'Failed to save deposit. Please try again.');
    }
  };

  const handleAddCustomBank = async (name: string) => {
    const updated = await addCustomBank(name);
    setBanksList([...BANKS, ...updated]);
  };

  const handleAddCustomMember = async (name: string) => {
    const updated = await addFamilyMember(name);
    setMembersList(updated);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.lavender} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <ArrowLeft size={20} color={colors.text1} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TrendingUp size={18} color={colors.lavender} />
          <Text style={styles.headerTitle}>{edit ? 'Edit Recurring Deposit' : 'Add Recurring Deposit'}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAwareScrollView 
        contentContainerStyle={styles.form} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={120}
        extraHeight={120}
      >
        <FormCard>
          <FormField label="Institution / Bank" required error={errors.bank}>
            <TouchableOpacity style={[styles.dropdown, errors.bank ? styles.inputError : null]} onPress={() => setBankDropdown(true)}>
              <Text style={[styles.dropdownText, !bank && styles.placeholderText]}>
                {bank || 'Select bank...'}
              </Text>
              <ChevronDown size={16} color={colors.text4} />
            </TouchableOpacity>
          </FormField>

          <FormField label="Family Member" required>
            <TouchableOpacity style={styles.dropdown} onPress={() => setMemberDropdown(true)}>
              <Text style={styles.dropdownText}>{familyMember}</Text>
              <ChevronDown size={16} color={colors.text4} />
            </TouchableOpacity>
          </FormField>

          <FormField label="Deposit Name / Nickname">
            <TextInput
              style={styles.input}
              placeholder="e.g. Monthly Savings RD"
              placeholderTextColor={colors.text4}
              value={name}
              onChangeText={setName}
            />
          </FormField>

          <FormField label="Start Date" required>
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingRight: 8, height: 42, paddingVertical: 0 }]}>
              <TextInput
                style={{ flex: 1, fontSize: 14, color: colors.text1, height: '100%', outlineStyle: 'none' as any }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text4}
                value={startDate}
                onChangeText={setStartDate}
              />
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ padding: 4 }}>
                <Calendar size={18} color="#000000" />
              </TouchableOpacity>
            </View>
            <DatePickerModal
              visible={showDatePicker}
              currentDateStr={startDate}
              onClose={() => setShowDatePicker(false)}
              onSelect={(date) => {
                setStartDate(date);
                setShowDatePicker(false);
              }}
            />
          </FormField>

          <FormField label="Monthly Deposit" required error={errors.monthlyDeposit}>
            <View style={[styles.currencyInput, errors.monthlyDeposit ? styles.inputError : null]}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 0 }]}
                placeholder="10,000"
                placeholderTextColor={colors.text4}
                value={monthlyDeposit}
                onChangeText={(val) => { setMonthlyDeposit(val); setErrors(e => ({ ...e, monthlyDeposit: '' })); }}
                keyboardType="numeric"
              />
            </View>
          </FormField>
        </FormCard>

        <FormCard>
          <FormField label="Interest Rate (% p.a.)" required={autoCalculate} error={errors.interest}>
            <View style={[styles.suffixInput, errors.interest ? styles.inputError : null]}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
                value={interestRate}
                onChangeText={(val) => { setInterestRate(val); setErrors(e => ({ ...e, interest: '' })); }}
                keyboardType="decimal-pad"
              />
              <Text style={styles.suffix}>%</Text>
            </View>
          </FormField>

          <FormField label="Tenure (Months)" required={autoCalculate} error={errors.tenure}>
            <TextInput
              style={[styles.input, errors.tenure ? styles.inputError : null]}
              placeholder="e.g. 24"
              placeholderTextColor={colors.text4}
              value={tenureMonths}
              onChangeText={(val) => { setTenureMonths(val); setErrors(e => ({ ...e, tenure: '' })); }}
              keyboardType="number-pad"
            />
          </FormField>

          <FormField label="Compounding Frequency" required={autoCalculate}>
            <View style={styles.chips}>
              {COMPOUNDING_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, compounding === opt && styles.chipActive]}
                  onPress={() => setCompounding(opt)}
                >
                  <Text style={[styles.chipText, compounding === opt && styles.chipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FormField>
        </FormCard>

        <View style={[styles.toggleRow, { backgroundColor: colors.bgElevated, padding: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.separator, ...shadows.sm }]}>
          <Text style={styles.toggleLabel}>Auto Calculate Maturity</Text>
          <IOSSwitch
            value={autoCalculate}
            onValueChange={(val) => {
              setAutoCalculate(val);
              if (!val && maturityCalc) {
                if (!manualMaturityAmount) setManualMaturityAmount(maturityCalc.maturityAmount.toString());
                if (!manualMaturityDate) setManualMaturityDate(maturityCalc.maturityDate.toISOString().split('T')[0]);
              }
            }}
            activeColor="#22863a"
          />
        </View>

        {!autoCalculate && (
          <FormCard>
            <FormField label="Maturity Amount" required error={errors.manualMaturityAmount}>
              <View style={[styles.currencyInput, errors.manualMaturityAmount ? styles.inputError : null]}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 0 }]}
                  placeholder="Maturity amount..."
                  placeholderTextColor={colors.text4}
                  value={manualMaturityAmount}
                  onChangeText={(val) => { setManualMaturityAmount(val); setErrors(e => ({ ...e, manualMaturityAmount: '' })); }}
                  keyboardType="numeric"
                />
              </View>
            </FormField>

            <FormField label="Maturity Date" required error={errors.manualMaturityDate}>
              <View style={[styles.input, errors.manualMaturityDate ? { borderColor: colors.error, borderWidth: 1 } : null, { flexDirection: 'row', alignItems: 'center', paddingRight: 8, height: 42, paddingVertical: 0 }]}>
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: colors.text1, height: '100%', outlineStyle: 'none' as any }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.text4}
                  value={manualMaturityDate}
                  onChangeText={(val) => { setManualMaturityDate(val); setErrors(e => ({ ...e, manualMaturityDate: '' })); }}
                />
                <TouchableOpacity onPress={() => setShowMaturityDatePicker(true)} style={{ padding: 4 }}>
                  <Calendar size={18} color="#000000" />
                </TouchableOpacity>
              </View>
              <DatePickerModal
                visible={showMaturityDatePicker}
                currentDateStr={manualMaturityDate || new Date().toISOString().split('T')[0]}
                onClose={() => setShowMaturityDatePicker(false)}
                onSelect={(date) => {
                  setManualMaturityDate(date);
                  setErrors(e => ({ ...e, manualMaturityDate: '' }));
                  setShowMaturityDatePicker(false);
                }}
              />
            </FormField>


          </FormCard>
        )}

        {maturityCalc && autoCalculate && (
          <LinearGradient
            colors={['#1A1614', '#24140D', '#0F0A08']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.breakdownCard}
          >
            <View style={styles.breakdownHeader}>
              <Trophy size={18} color={colors.lavender} />
              <Text style={styles.breakdownTitle}>Maturity Breakdown</Text>
            </View>
            <Text style={[styles.breakdownAmount, { color: colors.lavender }]}>{formatCurrencyFull(maturityCalc.maturityAmount)}</Text>
            <Text style={styles.breakdownAmountLabel}>Maturity Amount</Text>

            <View style={styles.breakdownMetrics}>
              <View style={styles.breakdownMetric}>
                <Text style={styles.breakdownMetricValue}>{formatCurrencyFull(maturityCalc.interestEarned)}</Text>
                <Text style={styles.breakdownMetricLabel}>INTEREST{'\n'}EARNED</Text>
              </View>
              <View style={styles.breakdownMetric}>
                <Text style={styles.breakdownMetricValue}>{maturityCalc.effectiveYield.toFixed(2)}%</Text>
                <Text style={styles.breakdownMetricLabel}>EFFECTIVE{'\n'}YIELD</Text>
              </View>
              <View style={styles.breakdownMetric}>
                <Text style={styles.breakdownMetricValue}>{formatMaturityDate(maturityCalc.maturityDate.toISOString())}</Text>
                <Text style={styles.breakdownMetricLabel}>MATURITY{'\n'}DATE</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        <Text style={styles.sectionHeader}>Additional Details (Optional)</Text>
        <FormCard>
          <FormField label="Account / Reference Number">
            <TextInput
              style={styles.input}
              placeholder="e.g. RD-2025-001"
              placeholderTextColor={colors.text4}
              value={accountRef}
              onChangeText={setAccountRef}
            />
          </FormField>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Auto Renewal on Maturity</Text>
            <IOSSwitch
              value={autoRenewal}
              onValueChange={setAutoRenewal}
              activeColor="#22863a"
            />
          </View>

          <FormField label="Notes">
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Add any notes here..."
              placeholderTextColor={colors.text4}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </FormField>
        </FormCard>
      </KeyboardAwareScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.lavender }]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <>
              <TrendingUp size={16} color="#000000" />
              <Text style={styles.saveBtnText}>{edit ? 'Save Changes' : 'Save as RD'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <DropdownModal
        visible={bankDropdown}
        onClose={() => setBankDropdown(false)}
        options={banksList}
        value={bank}
        onSelect={setBank}
        title="Select Bank"
        onAddNew={handleAddCustomBank}
        addNewPlaceholder="Add custom bank..."
      />
      <DropdownModal
        visible={memberDropdown}
        onClose={() => setMemberDropdown(false)}
        options={membersList}
        value={familyMember}
        onSelect={setFamilyMember}
        title="Select Family Member"
        onAddNew={handleAddCustomMember}
        addNewPlaceholder="Add family member..."
      />
    </View>
  );
}

function FormCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.formCard}>{children}</View>;
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.formField}>
      <Text style={[styles.fieldLabel, error ? { color: colors.error } : null]}>
        {label}
        {required && <Text style={{ color: colors.error }}> *</Text>}
      </Text>
      {children}
      {error && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontFamily: typography.bold, color: colors.text1 },
  form: { padding: 20, gap: 14, paddingBottom: 60 },
  formCard: {
    backgroundColor: colors.bgElevated, borderRadius: radius.card, padding: 16,
    borderWidth: 1, borderColor: colors.separator, gap: 14, ...shadows.sm,
  },
  formField: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: typography.semiBold, color: colors.text2 },
  input: {
    borderWidth: 1, borderColor: colors.separator, borderRadius: radius.xs,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text1,
    backgroundColor: colors.bgBase, outlineStyle: 'none' as any,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1,
  },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.separator,
    borderRadius: radius.xs, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.bgBase,
  },
  dropdownText: { flex: 1, fontSize: 14, color: colors.text1 },
  placeholderText: { color: colors.text4 },
  currencyInput: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.separator,
    borderRadius: radius.xs, paddingHorizontal: 12, backgroundColor: colors.bgBase, outlineStyle: 'none' as any,
  },
  currencySymbol: { fontSize: 16, color: colors.text2, fontFamily: typography.semiBold, marginRight: 6 },
  suffixInput: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.separator,
    borderRadius: radius.xs, paddingHorizontal: 12, backgroundColor: colors.bgBase, outlineStyle: 'none' as any,
  },
  suffix: { fontSize: 14, color: colors.text3 },
  tenureRow: { flexDirection: 'row', gap: 10 },
  tenureItem: { width: 120, alignItems: 'center', gap: 4 },
  tenureInput: {
    borderWidth: 1, borderColor: colors.separator, borderRadius: radius.xs, paddingVertical: 10,
    fontSize: 18, fontFamily: typography.bold, color: colors.text1, backgroundColor: colors.bgBase,
    width: '100%', textAlign: 'center', outlineStyle: 'none' as any,
  },
  tenureLabel: { fontSize: 10, fontFamily: typography.bold, color: colors.text4, letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.bgBase,
  },
  chipActive: { backgroundColor: colors.lavenderSoft, borderColor: colors.lavender },
  chipText: { fontSize: 13, fontFamily: typography.semiBold, color: colors.text2 },
  chipTextActive: { color: '#000000' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, fontFamily: typography.semiBold, color: colors.text1 },
  breakdownCard: {
    borderRadius: radius.card,
    padding: 20,
    gap: 4,
    overflow: 'hidden',
  },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  breakdownTitle: { fontSize: 14, fontFamily: typography.bold, color: 'rgba(255,255,255,0.7)' },
  breakdownAmount: { fontSize: 28, fontFamily: typography.bold, letterSpacing: -0.8 },
  breakdownAmountLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 16 },
  breakdownMetrics: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  breakdownMetric: { flex: 1 },
  breakdownMetricValue: { fontSize: 13, fontFamily: typography.bold, color: colors.white },
  breakdownMetricLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: typography.semiBold, letterSpacing: 0.3, marginTop: 2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, paddingVertical: 14, gap: 8, marginTop: 4,
  },
  saveBtnText: { color: '#000000', fontSize: 15, fontFamily: typography.bold },
  sectionHeader: { fontSize: 16, fontFamily: typography.bold, color: colors.text1, marginTop: 4 },
  notesInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10, outlineStyle: 'none' as any },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: '60%', padding: 20,
  },
  modalTitle: { fontSize: 17, fontFamily: typography.bold, color: colors.text1, marginBottom: 12, textAlign: 'center' },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.separator,
  },
  modalItemActive: { backgroundColor: colors.lavenderSoft, borderRadius: radius.sm, paddingHorizontal: 8 },
  modalItemText: { flex: 1, fontSize: 15, color: colors.text1, fontFamily: typography.regular },
  modalItemTextActive: { fontFamily: typography.bold, color: '#000000' },
  loader: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: radius.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text1,
    backgroundColor: colors.bgBase,
    outlineStyle: 'none' as any,
  },
  modalAddBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.xs,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    ...shadows.sm,
  },
});
