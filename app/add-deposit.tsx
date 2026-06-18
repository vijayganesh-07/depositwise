import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock, TrendingUp, X } from 'lucide-react-native';
import { colors, radius, shadows, typography } from '@/constants/theme';

export default function AddDepositScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={() => router.back()} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Add New Deposit</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <X size={18} color={colors.text3} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Choose the type of deposit to add</Text>

        <View style={styles.options}>
          <TouchableOpacity
            style={[styles.option, styles.fdOption]}
            onPress={() => router.replace('/add-fd' as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.mint }]}>
              <Lock size={28} color={colors.text1} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Fixed Deposit</Text>
              <Text style={styles.optionDesc}>Lump sum investment at a fixed interest rate</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, styles.rdOption]}
            onPress={() => router.replace('/add-rd' as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.lavenderSoft }]}>
              <TrendingUp size={28} color={colors.lavender} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Recurring Deposit</Text>
              <Text style={styles.optionDesc}>Monthly installments with compound interest</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.separator,
    alignSelf: 'center',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { flex: 1, fontSize: 20, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.4 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { fontSize: 14, color: colors.text3, marginBottom: 24, fontFamily: typography.regular },

  options: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  fdOption: {
    backgroundColor: colors.bgElevated,
  },
  rdOption: {
    backgroundColor: colors.bgElevated,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 17, fontFamily: typography.bold, color: colors.text1, marginBottom: 4 },
  optionDesc: { fontSize: 13, color: colors.text3, lineHeight: 18, fontFamily: typography.regular },
});
