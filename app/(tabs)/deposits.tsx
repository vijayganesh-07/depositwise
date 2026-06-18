import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  DeviceEventEmitter,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Search, Plus, ChevronDown, TrendingUp, Check, SlidersHorizontal } from 'lucide-react-native';
import { colors, radius, shadows, typography } from '@/constants/theme';
import { getDeposits, Deposit, getFamilyMembers } from '@/lib/storage';
import { formatCurrencyFull, getMaturityLabel, getDaysUntilMaturity } from '@/lib/calculations';

const TYPE_FILTERS = ['All', 'FD', 'RD', 'Matured', 'Closed'];
const SORT_OPTIONS = ['Maturity Date', 'Principal: High to Low', 'Principal: Low to High', 'Interest Rate: High to Low'];

function FilterModal({
  visible, onClose, options, value, onSelect, title,
}: {
  visible: boolean; onClose: () => void; options: string[]; value: string; onSelect: (v: string) => void; title: string;
}) {
  const [localVisible, setLocalVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(300))[0];

  useEffect(() => {
    if (visible) {
      setLocalVisible(true);
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
        setLocalVisible(false);
      });
    }
  }, [visible]);

  return (
    <Modal visible={localVisible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        />
        <Animated.View
          style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item === value && styles.modalItemActive]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[styles.modalItemText, item === value && styles.modalItemTextActive]}>{item}</Text>
                {item === value && <Check size={16} color={colors.text1} />}
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function DepositsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [selectedBank, setSelectedBank] = useState('All Banks');
  const [selectedMember, setSelectedMember] = useState('All Members');
  const [selectedSort, setSelectedSort] = useState('Maturity Date');

  const [banksList, setBanksList] = useState<string[]>([]);
  const [membersList, setMembersList] = useState<string[]>([]);

  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const fetchDeposits = async () => {
    try {
      const data = await getDeposits();
      setDeposits(data);

      const uniqueBanks = Array.from(new Set(data.map(d => d.bank))).sort();
      setBanksList(['All Banks', ...uniqueBanks]);

      const members = await getFamilyMembers();
      setMembersList(['All Members', ...members]);
    } catch (error) {
      console.error('Failed to fetch deposits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDeposits(); }, []));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('deposits_changed', () => {
      fetchDeposits();
    });
    return () => {
      sub.remove();
    };
  }, []);

  const onRefresh = () => { setRefreshing(true); fetchDeposits(); };

  const filtered = deposits.filter(d => {
    const label = getMaturityLabel(d.maturity_date, d.status);
    const isMatured = d.status === 'matured' || label === 'Matured';
    const isClosed = d.status === 'closed' || label === 'Closed';

    const matchFilter =
      (activeFilter === 'All' && !isClosed) ||
      (activeFilter === 'FD' && d.type === 'FD' && !isClosed) ||
      (activeFilter === 'RD' && d.type === 'RD' && !isClosed) ||
      (activeFilter === 'Matured' && isMatured && !isClosed) ||
      (activeFilter === 'Closed' && isClosed);

    const matchSearch =
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.bank.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.family_member_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchBank = selectedBank === 'All Banks' || d.bank === selectedBank;
    const matchMember = selectedMember === 'All Members' || d.family_member_name === selectedMember;

    return matchFilter && matchSearch && matchBank && matchMember;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (selectedSort === 'Maturity Date') {
      if (!a.maturity_date) return 1;
      if (!b.maturity_date) return -1;
      return new Date(a.maturity_date).getTime() - new Date(b.maturity_date).getTime();
    }
    if (selectedSort === 'Principal: High to Low') {
      return b.principal_amount - a.principal_amount;
    }
    if (selectedSort === 'Principal: Low to High') {
      return a.principal_amount - b.principal_amount;
    }
    if (selectedSort === 'Interest Rate: High to Low') {
      return b.interest_rate - a.interest_rate;
    }
    return 0;
  });

  const totalValue = filtered.reduce((sum, d) => sum + (d.maturity_amount || d.principal_amount), 0);

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.text1} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Deposits</Text>
            <Text style={styles.headerSub}>{filtered.length} deposits · {formatCurrencyFull(totalValue)}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(!showSearch)}>
              <Search size={18} color={colors.text2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.text1 }]}
              onPress={() => router.push('/add-deposit' as any)}
            >
              <Plus size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {showSearch && (
          <View style={styles.searchBar}>
            <Search size={15} color={colors.text4} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search deposits..."
              placeholderTextColor={colors.text4}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}

        {/* Type Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {TYPE_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sort/Filter Dropdowns */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filtersRow, { marginTop: 8, paddingBottom: 4 }]}
        >
          <TouchableOpacity style={styles.dropdownSelector} onPress={() => setSortModalVisible(true)}>
            <SlidersHorizontal size={12} color={colors.text3} />
            <Text style={styles.dropdownSelectorText}>{selectedSort.split(':')[0]}</Text>
            <ChevronDown size={12} color={colors.text3} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownSelector} onPress={() => setBankModalVisible(true)}>
            <Text style={styles.dropdownSelectorText}>{selectedBank}</Text>
            <ChevronDown size={12} color={colors.text3} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownSelector} onPress={() => setMemberModalVisible(true)}>
            <Text style={styles.dropdownSelectorText}>{selectedMember}</Text>
            <ChevronDown size={12} color={colors.text3} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text1} />}
      >
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <TrendingUp size={28} color={colors.text3} />
            </View>
            <Text style={styles.emptyTitle}>No deposits found</Text>
            <Text style={styles.emptyDesc}>Tap + to add your first deposit</Text>
          </View>
        ) : (
          sorted.map(deposit => <DepositCard key={deposit.id} deposit={deposit} onPress={() => router.push(`/deposit/${deposit.id}` as any)} />)
        )}
      </ScrollView>

      <FilterModal
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        options={SORT_OPTIONS}
        value={selectedSort}
        onSelect={setSelectedSort}
        title="Sort Deposits By"
      />
      <FilterModal
        visible={bankModalVisible}
        onClose={() => setBankModalVisible(false)}
        options={banksList}
        value={selectedBank}
        onSelect={setSelectedBank}
        title="Filter by Bank"
      />
      <FilterModal
        visible={memberModalVisible}
        onClose={() => setMemberModalVisible(false)}
        options={membersList}
        value={selectedMember}
        onSelect={setSelectedMember}
        title="Filter by Family Member"
      />
    </View>
  );
}

function DepositCard({ deposit, onPress }: { deposit: Deposit; onPress: () => void }) {
  const isFD = deposit.type === 'FD';
  const label = getMaturityLabel(deposit.maturity_date, deposit.status);
  const isMatured = deposit.status === 'matured' || label === 'Matured';
  const isClosed = deposit.status === 'closed' || label === 'Closed';

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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardIcon, {
        backgroundColor: isFD ? colors.mint : colors.lavender,
      }]}>
        <Text style={{
          fontSize: 12,
          fontFamily: typography.bold,
          color: isFD ? colors.text1 : colors.white,
        }}>
          {deposit.type}
        </Text>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.cardName}>{deposit.name}</Text>
          <Text style={styles.cardAmount}>{formatCurrencyFull(deposit.maturity_amount || deposit.principal_amount)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardBank}>{deposit.bank} · {deposit.family_member_name}</Text>
          <View style={[styles.badge, { backgroundColor: accentSoft }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>{label}</Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{deposit.interest_rate}% p.a.</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>Principal: {formatCurrencyFull(deposit.principal_amount)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  loader: { flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: colors.bgBase,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitle: { fontSize: 26, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.8 },
  headerSub: { fontSize: 13, color: colors.text3, marginTop: 2, fontFamily: typography.regular },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text1, fontFamily: typography.regular, outlineStyle: 'none' as any },
  filtersRow: { gap: 8, paddingRight: 20 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  filterChipActive: { backgroundColor: colors.text1, borderColor: colors.text1 },
  filterChipText: { fontSize: 13, fontFamily: typography.semiBold, color: colors.text3 },
  filterChipTextActive: { color: colors.white },

  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.separator,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    gap: 5,
  },
  dropdownSelectorText: {
    fontSize: 12,
    fontFamily: typography.semiBold,
    color: colors.text2,
  },

  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 10 },

  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: { fontSize: 15, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.2, flex: 1 },
  cardAmount: { fontSize: 15, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.3 },
  cardBank: { fontSize: 12, color: colors.text3, flex: 1, fontFamily: typography.regular },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontFamily: typography.bold },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  metaText: { fontSize: 11, color: colors.text4, fontFamily: typography.regular },
  metaDot: { fontSize: 11, color: colors.text4 },

  emptyState: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.separator,
    gap: 8,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: typography.bold, color: colors.text1, marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: colors.text3, fontFamily: typography.regular },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14,15,12,0.5)',
    justifyContent: 'flex-end',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.separator,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: typography.bold,
    color: colors.text1,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  modalItemActive: { backgroundColor: colors.bgBase, borderRadius: radius.sm, paddingHorizontal: 12, marginHorizontal: -8 },
  modalItemText: { flex: 1, fontSize: 15, color: colors.text1, fontFamily: typography.medium },
  modalItemTextActive: { fontFamily: typography.bold, color: colors.text1 },
});
