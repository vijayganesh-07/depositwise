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
  DeviceEventEmitter,
  Animated,
  FlatList,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Search, Plus, ChevronDown, TrendingUp, Check, SlidersHorizontal, Lock, X } from 'lucide-react-native';
import { colors, radius, shadows, typography } from '@/constants/theme';
import { getDeposits, Deposit, getFamilyMembers } from '@/lib/storage';
import { formatCurrencyFull, formatMaturityDate, getMaturityLabel, getDaysUntilMaturity } from '@/lib/calculations';

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
  const params = useLocalSearchParams();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Matured' | 'Closed'>('Active');
  const [typeFilter, setTypeFilter] = useState<'All' | 'FD' | 'RD'>((params.typeFilter as any) || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [selectedBank, setSelectedBank] = useState((params.bankFilter as string) || 'All Banks');
  const [selectedMember, setSelectedMember] = useState((params.memberFilter as string) || 'All Members');
  const [selectedSort, setSelectedSort] = useState('Maturity Date');

  useEffect(() => {
    // When navigating from analytics, only one filter param is sent at a time.
    // Clear all other filters first so they don't stack up.
    if (params.typeFilter) {
      setTypeFilter(params.typeFilter as any);
      setSelectedBank('All Banks');
      setSelectedMember('All Members');
      setSearchQuery('');
    } else if (params.bankFilter) {
      setSelectedBank(params.bankFilter as string);
      setTypeFilter('All');
      setSelectedMember('All Members');
      setSearchQuery('');
    } else if (params.memberFilter) {
      setSelectedMember(params.memberFilter as string);
      setTypeFilter('All');
      setSelectedBank('All Banks');
      setSearchQuery('');
    }
  }, [params.typeFilter, params.bankFilter, params.memberFilter]);

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

    let matchStatus = false;
    if (statusFilter === 'Active') {
      matchStatus = !isMatured && !isClosed;
    } else if (statusFilter === 'Matured') {
      matchStatus = isMatured && !isClosed;
    } else if (statusFilter === 'Closed') {
      matchStatus = isClosed;
    }

    const matchType = typeFilter === 'All' || d.type === typeFilter;

    const matchSearch =
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.bank.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.family_member_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchBank = selectedBank === 'All Banks' || d.bank === selectedBank;
    const matchMember = selectedMember === 'All Members' || d.family_member_name === selectedMember;

    return matchStatus && matchType && matchSearch && matchBank && matchMember;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (selectedSort.startsWith('Maturity')) {
      if (!a.maturity_date) return 1;
      if (!b.maturity_date) return -1;
      return new Date(a.maturity_date).getTime() - new Date(b.maturity_date).getTime();
    }
    if (selectedSort === 'Principal: High to Low') return b.principal_amount - a.principal_amount;
    if (selectedSort === 'Principal: Low to High') return a.principal_amount - b.principal_amount;
    if (selectedSort === 'Interest Rate: High to Low') return b.interest_rate - a.interest_rate;
    return 0;
  });

  let emptyTitle = 'No deposits found';
  let emptyDesc = 'Tap + to add your first deposit';

  if (searchQuery || typeFilter !== 'All' || selectedBank !== 'All Banks' || selectedMember !== 'All Members') {
    emptyTitle = 'No matches found';
    emptyDesc = 'Try adjusting your filters or search query';
  } else if (statusFilter === 'Active') {
    emptyTitle = 'No active deposits';
    emptyDesc = 'Tap + to add your first deposit';
  } else if (statusFilter === 'Matured') {
    emptyTitle = 'No matured deposits';
    emptyDesc = 'Wait until your active deposits reach maturity';
  } else if (statusFilter === 'Closed') {
    emptyTitle = 'No closed deposits';
    emptyDesc = 'Matured deposits that you have closed will appear here';
  }

  const totalValue = filtered.reduce((sum, d) => sum + (d.maturity_amount || d.principal_amount), 0);

  const hasFilters = typeFilter !== 'All' || selectedBank !== 'All Banks' || selectedMember !== 'All Members' || searchQuery !== '';

  const clearFilters = () => {
    setTypeFilter('All');
    setSelectedBank('All Banks');
    setSelectedMember('All Members');
    setSearchQuery('');
    setStatusFilter('Active');
    setSelectedSort('Maturity Date');
    router.setParams({ typeFilter: '', bankFilter: '', memberFilter: '' });
  };

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

        {/* Status Navigation Bar */}
        <View style={styles.statusBar}>
          {['Active', 'Matured', 'Closed'].map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.statusTab, statusFilter === status && styles.statusTabActive]}
              onPress={() => setStatusFilter(status as any)}
            >
              <Text style={[styles.statusTabText, statusFilter === status && styles.statusTabTextActive]}>{status}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Type Navigation Bar */}
        <View style={styles.statusBar}>
          {['All', 'FD', 'RD'].map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.statusTab, typeFilter === type && styles.statusTabActive]}
              onPress={() => setTypeFilter(type as any)}
            >
              <Text style={[styles.statusTabText, typeFilter === type && styles.statusTabTextActive]}>
                {type === 'All' ? 'All Types' : type === 'FD' ? 'FD' : 'RD'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sort/Filter Dropdowns */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filtersRow, { marginTop: 12, paddingBottom: 4 }]}
        >
          {hasFilters && (
            <TouchableOpacity style={styles.clearFilterBtn} onPress={clearFilters}>
              <X size={12} color={colors.text2} />
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.dropdownSelector} onPress={() => setSortModalVisible(true)}>
            <SlidersHorizontal size={12} color={colors.text3} />
            <Text style={styles.dropdownSelectorText}>Sort: {selectedSort.split(':')[0]}</Text>
            <ChevronDown size={12} color={colors.text3} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownSelector} onPress={() => setBankModalVisible(true)}>
            <Text style={styles.dropdownSelectorText}>Bank: {selectedBank === 'All Banks' ? 'All' : selectedBank}</Text>
            <ChevronDown size={12} color={colors.text3} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownSelector} onPress={() => setMemberModalVisible(true)}>
            <Text style={styles.dropdownSelectorText}>Member: {selectedMember === 'All Members' ? 'All' : selectedMember}</Text>
            <ChevronDown size={12} color={colors.text3} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text1} />}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
      >
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <TrendingUp size={28} color={colors.text3} />
            </View>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyDesc}>{emptyDesc}</Text>
          </View>
        ) : (
          sorted.map(deposit => <DepositCard key={deposit.id} deposit={deposit} onPress={() => router.push(`/deposit/${deposit.id}` as any)} />)
        )}
      </KeyboardAwareScrollView>

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
    accentColor = '#b91c1c';
    accentSoft = '#fee2e2';
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
        <View style={styles.cardMeta}>
          <Text style={[styles.metaText, { color: isAboutToMature ? '#b45309' : isMatured ? colors.text3 : colors.text3 }]}>
            {isMatured ? 'Matured' : isClosed ? 'Closed'  : 'Matures'}: {formatMaturityDate(deposit.maturity_date)}
          </Text>
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
  statusBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  statusTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  statusTabActive: {
    backgroundColor: colors.text1,
  },
  statusTabText: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.text3,
    textAlign: 'center',
  },
  statusTabTextActive: {
    color: colors.white,
  },

  typeCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    alignItems: 'flex-start',
    gap: 8,
  },
  typeCardActive: {
    borderColor: colors.text1,
    backgroundColor: '#FAFAFA',
  },
  typeCardIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCardText: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.text2,
  },
  typeCardTextActive: {
    color: colors.text1,
    fontFamily: typography.bold,
  },

  filtersRow: { gap: 8, paddingRight: 20 },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.separator,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    gap: 4,
  },
  clearFilterText: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.text2,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.separator,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    gap: 6,
  },
  dropdownSelectorText: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.text1,
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
