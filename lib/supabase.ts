import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const storage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
        setItem: (key: string, value: string) => {
          localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          localStorage.removeItem(key);
          return Promise.resolve();
        },
      }
    : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Deposit = {
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
};

export type FamilyMember = {
  id: string;
  name: string;
  created_at: string;
};
