import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, DeviceEventEmitter } from 'react-native';

export type RDPayment = {
  month: number;
  amount: number;
  due_date: string;
  status: 'paid' | 'pending';
  paid_date?: string | null;
};

export interface Deposit {
  id: string;
  name: string;
  type: 'FD' | 'RD';
  bank: string;
  family_member_name: string;
  principal_amount: number;
  interest_rate: number;
  start_date: string;
  tenure_years: number;
  tenure_months: number;
  tenure_days: number;
  compounding_frequency: string;
  interest_payout: string;
  maturity_amount: number | null;
  interest_earned: number | null;
  effective_yield: number | null;
  maturity_date: string | null;
  status: 'active' | 'matured' | 'closed';
  auto_renewal: boolean;
  account_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  rd_payments?: RDPayment[] | null;
  updatedAt?: string;
  deleted?: boolean;
  sync_pending?: boolean;
}

const STORAGE_KEYS = {
  DEPOSITS: 'fd_vault_deposits',
  FAMILY_MEMBERS: 'fd_vault_family_members',
  CUSTOM_BANKS: 'fd_vault_custom_banks',
  GOOGLE_CLIENT_ID: 'fd_vault_google_client_id',
};

// Seed sample family members
const DEFAULT_FAMILY_MEMBERS: string[] = []; // Replaced by dynamic user profile loading

// Seed sample deposits (matching the prototype database migrations)
const SEED_DEPOSITS: Deposit[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Short Term Park',
    type: 'FD',
    bank: 'Axis Bank',
    family_member_name: 'Self',
    principal_amount: 100000,
    interest_rate: 7.25,
    start_date: '2023-06-01',
    tenure_years: 1,
    tenure_months: 0,
    tenure_days: 0,
    compounding_frequency: 'Quarterly',
    interest_payout: 'Cumulative (At Maturity)',
    maturity_amount: 103381,
    interest_earned: 3381,
    effective_yield: 7.36,
    maturity_date: '2024-06-01',
    status: 'matured',
    auto_renewal: false,
    account_reference: 'AX-001',
    notes: 'Short term park',
    created_at: new Date('2023-06-01').toISOString(),
    updated_at: new Date('2023-06-01').toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Car Downpayment',
    type: 'FD',
    bank: 'HDFC Bank',
    family_member_name: 'Self',
    principal_amount: 400000,
    interest_rate: 7.10,
    start_date: '2024-01-15',
    tenure_years: 2,
    tenure_months: 0,
    tenure_days: 0,
    compounding_frequency: 'Quarterly',
    interest_payout: 'Cumulative (At Maturity)',
    maturity_amount: 429798,
    interest_earned: 29798,
    effective_yield: 7.36,
    maturity_date: '2026-06-26',
    status: 'active',
    auto_renewal: false,
    account_reference: 'HD-109',
    notes: 'Car fund',
    created_at: new Date('2024-01-15').toISOString(),
    updated_at: new Date('2024-01-15').toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Emergency Fund',
    type: 'FD',
    bank: 'SBI',
    family_member_name: 'Self',
    principal_amount: 500000,
    interest_rate: 6.80,
    start_date: '2024-03-01',
    tenure_years: 3,
    tenure_months: 0,
    tenure_days: 0,
    compounding_frequency: 'Quarterly',
    interest_payout: 'Cumulative (At Maturity)',
    maturity_amount: 612000,
    interest_earned: 112000,
    effective_yield: 7.20,
    maturity_date: '2027-03-01',
    status: 'active',
    auto_renewal: false,
    account_reference: 'SB-Emergency',
    notes: 'Emergency backup money',
    created_at: new Date('2024-03-01').toISOString(),
    updated_at: new Date('2024-03-01').toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Tax Saver FD',
    type: 'FD',
    bank: 'ICICI Bank',
    family_member_name: 'Spouse',
    principal_amount: 150000,
    interest_rate: 7.50,
    start_date: '2024-04-01',
    tenure_years: 5,
    tenure_months: 0,
    tenure_days: 0,
    compounding_frequency: 'Annually',
    interest_payout: 'Cumulative (At Maturity)',
    maturity_amount: 215000,
    interest_earned: 65000,
    effective_yield: 7.45,
    maturity_date: '2029-04-01',
    status: 'active',
    auto_renewal: true,
    account_reference: 'IC-Tax',
    notes: '5 year lock-in tax saver',
    created_at: new Date('2024-04-01').toISOString(),
    updated_at: new Date('2024-04-01').toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Monthly Income',
    type: 'RD',
    bank: 'SBI',
    family_member_name: 'Spouse',
    principal_amount: 120000, // 10000 * 12
    interest_rate: 6.50,
    start_date: '2024-01-01',
    tenure_years: 0,
    tenure_months: 12,
    tenure_days: 0,
    compounding_frequency: 'Quarterly',
    interest_payout: 'Cumulative',
    maturity_amount: 125000,
    interest_earned: 5000,
    effective_yield: 6.60,
    maturity_date: '2025-01-01',
    status: 'active',
    auto_renewal: false,
    account_reference: 'SB-RD-01',
    notes: 'Monthly recurring deposit',
    created_at: new Date('2024-01-01').toISOString(),
    updated_at: new Date('2024-01-01').toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Child Education',
    type: 'FD',
    bank: 'HDFC Bank',
    family_member_name: 'Child',
    principal_amount: 200000,
    interest_rate: 7.20,
    start_date: '2023-12-01',
    tenure_years: 5,
    tenure_months: 0,
    tenure_days: 0,
    compounding_frequency: 'Quarterly',
    interest_payout: 'Cumulative (At Maturity)',
    maturity_amount: 285000,
    interest_earned: 85000,
    effective_yield: 7.25,
    maturity_date: '2028-12-01',
    status: 'active',
    auto_renewal: false,
    account_reference: 'HD-Child-Ed',
    notes: 'Long term educational planning',
    created_at: new Date('2023-12-01').toISOString(),
    updated_at: new Date('2023-12-01').toISOString(),
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    name: 'House Down Payment',
    type: 'RD',
    bank: 'ICICI Bank',
    family_member_name: 'Self',
    principal_amount: 480000, // 20000 * 24
    interest_rate: 6.75,
    start_date: '2024-02-01',
    tenure_years: 0,
    tenure_months: 24,
    tenure_days: 0,
    compounding_frequency: 'Quarterly',
    interest_payout: 'Cumulative',
    maturity_amount: 520000,
    interest_earned: 40000,
    effective_yield: 6.80,
    maturity_date: '2026-02-01',
    status: 'active',
    auto_renewal: false,
    account_reference: 'IC-House-RD',
    notes: 'House saving plan',
    created_at: new Date('2024-02-01').toISOString(),
    updated_at: new Date('2024-02-01').toISOString(),
  }
];

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

async function getDynamicKey(baseKey: string): Promise<string> {
  try {
    const profileStr = await AsyncStorage.getItem('google_user_profile');
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      if (profile && profile.email) {
        return `${profile.email}_${baseKey}`;
      }
    }
  } catch (error) {
    console.error('Failed to parse user profile for dynamic key:', error);
  }
  return baseKey; // Default fallback for offline users
}

// Base helper functions
async function readKey<T>(baseKey: string, fallback: T): Promise<T> {
  try {
    const key = await getDynamicKey(baseKey);
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Failed to read key ${baseKey} from storage:`, error);
    return fallback;
  }
}

async function writeKey<T>(baseKey: string, value: T): Promise<void> {
  try {
    const key = await getDynamicKey(baseKey);
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write key ${baseKey} to storage:`, error);
  }
}

// Deposits CRUD
export async function getDeposits(): Promise<Deposit[]> {
  const all = await readKey<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
  return all.filter(d => !d.deleted);
}

export async function getAllDepositsIncludingDeleted(): Promise<Deposit[]> {
  return readKey<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
}

export async function getDepositById(id: string): Promise<Deposit | null> {
  const list = await getDeposits();
  return list.find(d => d.id === id) || null;
}

export async function saveDeposit(deposit: Partial<Deposit> & { type: 'FD' | 'RD'; name: string; bank: string }): Promise<Deposit> {
  const list = await getAllDepositsIncludingDeleted();
  const now = new Date().toISOString();

  let savedDeposit: Deposit;

  if (deposit.id) {
    // Update existing
    const index = list.findIndex(d => d.id === deposit.id);
    if (index !== -1) {
      savedDeposit = {
        ...list[index],
        ...deposit,
        updatedAt: now,
        sync_pending: true,
        deleted: false,
      } as Deposit;
      list[index] = savedDeposit;
    } else {
      // If ID passed but not found, treat as new
      savedDeposit = {
        ...deposit,
        id: deposit.id,
        created_at: now,
        updated_at: now,
        updatedAt: now,
        sync_pending: true,
        deleted: false,
      } as Deposit;
      list.push(savedDeposit);
    }
  } else {
    // Create new
    savedDeposit = {
      ...deposit,
      id: generateUUID(),
      status: deposit.status || 'active',
      auto_renewal: deposit.auto_renewal ?? false,
      created_at: now,
      updated_at: now,
      updatedAt: now,
      sync_pending: true,
      deleted: false,
    } as Deposit;
    list.push(savedDeposit);
  }

  await writeKey(STORAGE_KEYS.DEPOSITS, list);
  DeviceEventEmitter.emit('deposits_changed');
  triggerAutoBackup();
  return savedDeposit;
}

export async function deleteDeposit(id: string): Promise<void> {
  const list = await getAllDepositsIncludingDeleted();
  const index = list.findIndex(d => d.id === id);
  if (index !== -1) {
    list[index] = {
      ...list[index],
      deleted: true,
      sync_pending: true,
      updatedAt: new Date().toISOString(),
    };
    await writeKey(STORAGE_KEYS.DEPOSITS, list);
    DeviceEventEmitter.emit('deposits_changed');
    triggerAutoBackup();
  }
}

export function getUpdatedRDPayments(
  existingPayments: RDPayment[] | null | undefined,
  monthlyDeposit: number,
  tenureMonths: number,
  startDate: string
): RDPayment[] {
  const payments: RDPayment[] = [];
  const start = new Date(startDate);

  for (let i = 1; i <= tenureMonths; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(start.getMonth() + i - 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const existing = existingPayments?.find(p => p.month === i);

    payments.push({
      month: i,
      amount: monthlyDeposit,
      due_date: dueDateStr,
      status: existing ? existing.status : 'pending',
      paid_date: existing ? existing.paid_date : null,
    });
  }
  return payments;
}

export async function getCurrentUserName(): Promise<string> {
  try {
    const profileStr = await AsyncStorage.getItem('google_user_profile');
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      if (profile && profile.name) {
        // Return first name or full name, or just name
        return profile.name;
      }
    }
  } catch (error) {
    console.error('Failed to get user name:', error);
  }
  return 'Self';
}

export async function getFamilyMembers(): Promise<string[]> {
  const userName = await getCurrentUserName();
  const list = await readKey<string[]>(STORAGE_KEYS.FAMILY_MEMBERS, []);
  
  if (list.length === 0) {
    const defaultList = [userName];
    await writeKey<string[]>(STORAGE_KEYS.FAMILY_MEMBERS, defaultList);
    return defaultList;
  }
  
  // Optionally ensure the signed in user is always present
  if (!list.includes(userName) && userName !== 'Self') {
    const updated = [userName, ...list].filter(name => name !== 'Self'); // swap Self for actual name if they just signed in
    await writeKey<string[]>(STORAGE_KEYS.FAMILY_MEMBERS, updated);
    return updated;
  }

  return list;
}

export async function addFamilyMember(name: string): Promise<string[]> {
  const list = await getFamilyMembers();
  const trimmed = name.trim();
  if (trimmed && !list.includes(trimmed)) {
    const updated = [...list, trimmed];
    await writeKey(STORAGE_KEYS.FAMILY_MEMBERS, updated);
    triggerAutoBackup();
    return updated;
  }
  return list;
}

// Custom Banks CRUD
export async function getCustomBanks(): Promise<string[]> {
  return readKey<string[]>(STORAGE_KEYS.CUSTOM_BANKS, []);
}

export async function addCustomBank(name: string): Promise<string[]> {
  const list = await getCustomBanks();
  const trimmed = name.trim();
  if (trimmed && !list.includes(trimmed)) {
    const updated = [...list, trimmed];
    await writeKey(STORAGE_KEYS.CUSTOM_BANKS, updated);
    triggerAutoBackup();
    return updated;
  }
  return list;
}

const DEFAULT_CLIENT_ID = '382316142315-4i7o6jvach3fgp6un7n7shisf475u04u.apps.googleusercontent.com';

export async function getGoogleClientId(): Promise<string> {
  return DEFAULT_CLIENT_ID;
}

export async function saveGoogleClientId(clientId: string): Promise<void> {
  // Now using hardcoded client ID
}

// Database Export/Import
export interface BackupData {
  deposits: Deposit[];
  familyMembers: string[];
  customBanks: string[];
  version: string;
  timestamp: string;
}

export async function exportBackupData(): Promise<BackupData> {
  const deposits = await getAllDepositsIncludingDeleted();
  const familyMembers = await getFamilyMembers();
  const customBanks = await getCustomBanks();

  return {
    deposits,
    familyMembers,
    customBanks,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  };
}

export async function importBackupData(data: BackupData): Promise<void> {
  if (!data || !Array.isArray(data.deposits)) {
    throw new Error('Invalid backup format');
  }

  await writeKey(STORAGE_KEYS.DEPOSITS, data.deposits);

  if (Array.isArray(data.familyMembers)) {
    await writeKey(STORAGE_KEYS.FAMILY_MEMBERS, data.familyMembers);
  }
  if (Array.isArray(data.customBanks)) {
    await writeKey(STORAGE_KEYS.CUSTOM_BANKS, data.customBanks);
  }
  DeviceEventEmitter.emit('deposits_changed');
}

// ==========================================
// SYNC ENGINE HELPERS
// ==========================================

export async function getPendingChanges(): Promise<Deposit[]> {
  const all = await getAllDepositsIncludingDeleted();
  return all.filter(d => d.sync_pending);
}

export async function markAsSynced(syncedIds: string[]): Promise<void> {
  try {
    const all = await getAllDepositsIncludingDeleted();
    const updated = all.map(d => {
      if (syncedIds.includes(d.id)) {
        return { ...d, sync_pending: false };
      }
      return d;
    });
    // Remove permanently deleted items only after they've synced
    const finalDeposits = updated.filter(d => !(d.deleted && !d.sync_pending));
    await writeKey(STORAGE_KEYS.DEPOSITS, finalDeposits);
  } catch (e) {
    console.error('Error marking as synced', e);
  }
}

export async function triggerAutoBackup(): Promise<void> {
  // If we're not on web, try running the sync immediately when data changes
  if (Platform.OS !== 'web') {
    import('./driveSync').then(({ syncWithGoogleDrive }) => {
      syncWithGoogleDrive().catch(err => {
        console.error('Background auto-backup failed:', err);
      });
    });
  }
}

export type UserProfile = {
  name: string;
  email: string;
  picture: string;
};

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const val = await AsyncStorage.getItem('google_user_profile');
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

// Authentication status helpers
export async function isAuthenticated(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // On web, check if we have a stored access token AND user profile
    try {
      const token = localStorage.getItem('google_access_token');
      const profile = await AsyncStorage.getItem('google_user_profile');
      return !!(token && profile);
    } catch {
      return false;
    }
  }
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    return GoogleSignin.hasPreviousSignIn();
  } catch {
    return false;
  }
}

export async function signOutLocally(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      const { signOut } = await import('./driveSync');
      await signOut();
    }
    DeviceEventEmitter.emit('deposits_changed');
  } catch (error) {
    console.error('Failed to sign out locally:', error);
  }
}

export async function clearAllData(): Promise<void> {
  try {
    const depKey = await getDynamicKey(STORAGE_KEYS.DEPOSITS);
    const famKey = await getDynamicKey(STORAGE_KEYS.FAMILY_MEMBERS);
    const bankKey = await getDynamicKey(STORAGE_KEYS.CUSTOM_BANKS);
    
    await AsyncStorage.removeItem(depKey);
    await AsyncStorage.removeItem(famKey);
    await AsyncStorage.removeItem(bankKey);
    DeviceEventEmitter.emit('deposits_changed');
  } catch (error) {
    console.error('Failed to clear all data:', error);
  }
}

// Web-compatible auth helpers (used by web OAuth redirect flow in _layout.tsx)
export async function fetchAndSaveUserProfile(token: string): Promise<UserProfile | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const profile: UserProfile = {
      name: data.name || '',
      email: data.email || '',
      picture: data.picture || '',
    };
    await AsyncStorage.setItem('google_user_profile', JSON.stringify(profile));
    DeviceEventEmitter.emit('deposits_changed');
    return profile;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }
}

export async function backupToGoogleDrive(token: string): Promise<void> {
  const BACKUP_FILE_NAME = 'fd_vault_backup.json';
  const backup = await exportBackupData();
  const content = JSON.stringify(backup, null, 2);

  // Check if file already exists
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();
  const existingFile = searchData.files?.[0];

  if (existingFile) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: content,
    });
  } else {
    const boundary = 'foo_bar_baz';
    const metadata = { name: BACKUP_FILE_NAME, mimeType: 'application/json', parents: ['appDataFolder'] };
    const body =
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      `${content}\r\n--${boundary}--\r\n`;
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }
}

export async function restoreFromGoogleDrive(token: string): Promise<void> {
  const BACKUP_FILE_NAME = 'fd_vault_backup.json';
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();
  const existingFile = searchData.files?.[0];
  if (!existingFile) throw new Error('No backup file found in Google Drive.');

  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!fileRes.ok) throw new Error('Failed to download backup file.');
  const backup = await fileRes.json();
  await importBackupData(backup);
  DeviceEventEmitter.emit('deposits_changed');
}

