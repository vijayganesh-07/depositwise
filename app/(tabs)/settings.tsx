import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  Platform,
  Clipboard,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CloudUpload,
  CloudDownload,
  HardDrive,
  FileSpreadsheet,
  FileText,
  Bell,
  Palette,
  Lock,
  Info,
  ChevronRight,
  LogOut,
  Trash2,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, radius, shadows, typography } from '@/constants/theme';
import {
  exportBackupData,
  getGoogleClientId,
  getUserProfile,
  signOutLocally,
  UserProfile,
  isAuthenticated,
  getNotificationToggles,
  setNotificationToggles,
  getAllDepositsIncludingDeleted,
} from '@/lib/storage';
import { signIn, syncWithGoogleDrive, configureGoogleSignIn } from '@/lib/driveSync';
import { syncNotifications, requestNotificationPermissions } from '@/lib/notifications';
import IOSSwitch from '@/components/IOSSwitch';
import { isAppLockEnabled, setAppLockEnabled, isBiometricAvailable } from '@/lib/appLock';

type SettingToggle = {
  maturityReminders: boolean;
  rdInstallmentReminders: boolean;
  appLock: boolean;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [toggles, setToggles] = useState<SettingToggle>({
    maturityReminders: true,
    rdInstallmentReminders: true,
    appLock: false,
  });

  // Load persisted app lock state and notification toggles
  useEffect(() => {
    isAppLockEnabled().then(enabled => {
      setToggles(prev => ({ ...prev, appLock: enabled }));
    });
    getNotificationToggles().then(notifToggles => {
      setToggles(prev => ({ ...prev, ...notifToggles }));
    });
  }, []);

  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const loadProfile = async () => {
    const auth = await isAuthenticated();
    setIsSignedIn(auth);
    const profile = await getUserProfile();
    setUserProfile(profile);
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      const confirmSignOut = window.confirm(
        'Are you sure you want to sign out of DepositWise? Your local data will remain, but automatic Google Drive sync will be disabled.'
      );
      if (confirmSignOut) {
        signOutLocally().then(() => {
          setUserProfile(null);
          setIsSignedIn(false);
          router.replace('/');
        });
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out of DepositWise? Your local data will remain, but automatic Google Drive sync will be disabled.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              await signOutLocally();
              setUserProfile(null);
              setIsSignedIn(false);
              router.replace('/');
            },
          },
        ]
      );
    }
  };

  const handleClearData = () => {
    const message = 'Are you sure you want to delete all your deposits, custom banks, and family members? This action is permanent and cannot be undone unless you have a Google Drive backup.';

    if (Platform.OS === 'web') {
      const confirmClear = window.confirm(message);
      if (confirmClear) {
        import('@/lib/storage').then(async ({ clearAllData }) => {
          await clearAllData();
          Alert.alert('Cleared', 'All local data has been deleted.');
        });
      }
    } else {
      Alert.alert(
        'Clear All Data',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Everything',
            style: 'destructive',
            onPress: async () => {
              const { clearAllData } = await import('@/lib/storage');
              await clearAllData();
              Alert.alert('Cleared', 'All local data has been deleted.');
            },
          },
        ]
      );
    }
  };

  const toggle = async (key: 'maturityReminders' | 'rdInstallmentReminders') => {
    const newVal = !toggles[key];
    const newToggles = { ...toggles, [key]: newVal };
    setToggles(newToggles);
    await setNotificationToggles({
      maturityReminders: newToggles.maturityReminders,
      rdInstallmentReminders: newToggles.rdInstallmentReminders,
    });

    if (newVal) {
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Please enable notifications in your device settings.');
      }
    }

    const deposits = await getAllDepositsIncludingDeleted();
    await syncNotifications(deposits, newToggles);
  };

  const handleAppLockToggle = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'App Lock is only available on Android.');
      return;
    }
    const currentlyEnabled = toggles.appLock;
    if (!currentlyEnabled) {
      // Turning ON — check device capability first
      const available = await isBiometricAvailable();
      if (!available) {
        Alert.alert(
          'Not Available',
          'No biometrics or device PIN found. Please set up fingerprint, face unlock, or a screen lock PIN in your device settings first.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    const newValue = !currentlyEnabled;
    await setAppLockEnabled(newValue);
    setToggles(prev => ({ ...prev, appLock: newValue }));
    if (newValue) {
      Alert.alert('App Lock Enabled', 'DepositWise will require biometric or PIN authentication each time you open the app.');
    }
  };

  const [clientId, setClientId] = useState('');
  useEffect(() => {
    getGoogleClientId().then((id) => setClientId(id || ''));
  }, []);

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      // On web, use the OAuth redirect flow
      const clientId = await getGoogleClientId();
      const redirectUri = window.location.origin + window.location.pathname;
      const scope = [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' ');
      localStorage.setItem('google_pending_action', 'signin');
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(scope)}&` +
        `prompt=select_account`;
      window.location.href = authUrl;
      return;
    }
    // On Android: use native Google Sign-In
    if (!clientId) {
      Alert.alert('Configuration Missing', 'Please configure your Google Web Client ID below first.');
      return;
    }
    try {
      configureGoogleSignIn(clientId);
      const userInfo = await signIn();
      if (userInfo) {
        setIsSignedIn(true);
        Alert.alert('Signed In', `Welcome! Your data will now automatically back up in the background.`);
        router.replace('/');
      }
    } catch (error: any) {
      Alert.alert('Sign-In Error', error.message || 'Could not sign in to Google.');
    }
  };

  const handleManualSync = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Web Testing', 'Google Auto-Sync is an Android feature. Please build the APK to test native sync.');
      return;
    }
    setBackingUp(true);
    try {
      const success = await syncWithGoogleDrive();
      if (success) {
        Alert.alert('Sync Complete', 'Your local changes were synced with Google Drive.');
      } else {
        Alert.alert('Sync Status', 'No pending changes to sync, or you are not signed in.');
      }
    } catch (error: any) {
      Alert.alert('Sync Error', error.message || 'Failed to sync with Google Drive.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleLocalBackup = async () => {
    try {
      const data = await exportBackupData();
      const content = JSON.stringify(data, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fd_vault_local_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Clipboard.setString(content);
        Alert.alert('Backup Copied', 'JSON backup has been copied to your clipboard!');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to generate local backup: ' + err.message);
    }
  };

  const handleExcelExport = async () => {
    try {
      const { getDeposits } = await import('@/lib/storage');
      const list = await getDeposits();
      const active = list.filter(d => d.status !== 'closed');

      if (active.length === 0) {
        Alert.alert('No Data', 'You do not have any active deposits to export.');
        return;
      }

      const headers = ['Deposit Name', 'Type', 'Bank', 'Family Member', 'Principal Amount', 'Interest Rate (%)', 'Start Date', 'Maturity Amount', 'Maturity Date', 'Status'];
      const rows = active.map(d => [
        `"${d.name.replace(/"/g, '""')}"`,
        d.type,
        `"${d.bank.replace(/"/g, '""')}"`,
        `"${d.family_member_name.replace(/"/g, '""')}"`,
        d.principal_amount,
        d.interest_rate,
        d.start_date,
        d.maturity_amount || d.principal_amount,
        d.maturity_date || '-',
        d.status
      ]);

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depositwise_portfolio_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Clipboard.setString(csvContent);
        Alert.alert('Export Copied', 'CSV formatted portfolio has been copied to your clipboard!');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to export to Excel: ' + err.message);
    }
  };

  const handlePdfExport = async () => {
    try {
      const { getDeposits } = await import('@/lib/storage');
      const list = await getDeposits();
      const active = list.filter(d => d.status !== 'closed');

      if (active.length === 0) {
        Alert.alert('No Data', 'You do not have any active deposits to export.');
        return;
      }

      const totalInvested = active.reduce((sum, d) => sum + d.principal_amount, 0);
      const totalMaturity = active.reduce((sum, d) => sum + (d.maturity_amount || d.principal_amount), 0);
      const totalInterest = totalMaturity - totalInvested;
      const overallGainPct = totalInvested > 0 ? ((totalInterest / totalInvested) * 100).toFixed(1) : '0.0';

      const blendedYield = totalInvested > 0
        ? active.reduce((sum, d) => sum + (d.principal_amount * d.interest_rate), 0) / totalInvested
        : 0;

      const totalRDMonthly = active
        .filter(d => d.type === 'RD' && d.tenure_months > 0)
        .reduce((sum, d) => sum + (d.principal_amount / d.tenure_months), 0);

      const fdCount = active.filter(d => d.type === 'FD').length;
      const rdCount = active.filter(d => d.type === 'RD').length;
      const fdValue = active.filter(d => d.type === 'FD').reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);
      const rdValue = active.filter(d => d.type === 'RD').reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);

      const bankMap: Record<string, number> = {};
      const familyMap: Record<string, number> = {};
      active.forEach(d => {
        const val = d.maturity_amount || d.principal_amount;
        bankMap[d.bank] = (bankMap[d.bank] || 0) + val;
        familyMap[d.family_member_name] = (familyMap[d.family_member_name] || 0) + val;
      });

      const bankEntries = Object.entries(bankMap).sort((a, b) => b[1] - a[1]);
      const familyEntries = Object.entries(familyMap).sort((a, b) => b[1] - a[1]);
      const CHART_COLORS = ['#FF5A1F','#8b5cf6','#f43f5e','#0ea5e9','#f59e0b','#ec4899','#6366f1','#10b981'];

      const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

      const barRow = (label: string, value: number, total: number, color: string, sub?: string, badgeHtml?: string) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return `
          <div class="bar-item" style="display:flex; align-items:flex-start; gap:12px;">
            ${badgeHtml ? badgeHtml : ''}
            <div style="flex:1;">
              <div class="bar-header">
                <span class="bar-label">${label}${sub ? `<span class="bar-sub">&nbsp;${sub}</span>` : ''}</span>
                <span class="bar-pct">${pct}%</span>
              </div>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${color};"></div></div>
              <div class="bar-amount">${fmt(value)}</div>
            </div>
          </div>`;
      };

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>DepositWise Portfolio Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f8fafc; color: #0f172a; font-size: 13px; line-height: 1.5; }
    @media print {
      @page { size: A4; margin: 12mm 14mm; }
      body { background: #fff; }
      .page { page-break-after: always; padding: 0; }
      .page:last-child { page-break-after: avoid; }
    }
    .page { padding: 32px 36px 40px; min-height: 100vh; background: #fff; }
    .hero { background: #0E0F0C; border-radius: 16px; padding: 28px 32px 24px; margin-bottom: 24px; color: #fff; }
    .hero-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
    .hero-logo { width: 36px; height: 36px; background: rgba(255,255,255,0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .hero-title { font-size: 18px; font-weight: 700; color: #fff; }
    .hero-subtitle { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 1px; }
    .hero-amount { font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-bottom: 6px; }
    .hero-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.55); margin-bottom: 20px; }
    .hero-stats { display: flex; gap: 0; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 18px; }
    .hero-stat { flex: 1; text-align: center; }
    .hero-stat + .hero-stat { border-left: 1px solid rgba(255,255,255,0.12); }
    .hero-stat-label { font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .hero-stat-value { font-size: 16px; font-weight: 700; color: #fff; }
    .green-text { color: #86efac !important; }
    .metrics-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    .metric-card { background: #fff; border: 1px solid #D7FE47; border-radius: 12px; padding: 14px 16px; border-left-width: 1px; }
    .metric-card.active-deposits { background: #FF5A1F; border-color: #E04A10; }
    .metric-card.active-deposits .metric-label, .metric-card.active-deposits .metric-sub { color: rgba(255,255,255,0.9); }
    .metric-card.active-deposits .metric-value { color: #fff; }
    .metric-card.rd-flow { background: #0E0F0C; border-color: #2C2D2A; }
    .metric-card.rd-flow .metric-label, .metric-card.rd-flow .metric-sub { color: #B0AFA8; }
    .metric-card.rd-flow .metric-value { color: #fff; }
    .metric-label { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
    .metric-value { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .metric-sub { font-size: 10px; color: #94a3b8; margin-top: 3px; }
    .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 3px; }
    .section-sub { font-size: 11px; color: #94a3b8; margin-bottom: 14px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
    .bar-item { margin-bottom: 14px; }
    .bar-item:last-child { margin-bottom: 0; }
    .bar-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
    .bar-label { font-size: 12px; font-weight: 600; color: #1e293b; }
    .bar-sub { font-size: 10px; font-weight: 400; color: #94a3b8; }
    .bar-pct { font-size: 12px; font-weight: 700; color: #0f172a; }
    .bar-track { height: 7px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 3px; }
    .bar-fill { height: 7px; border-radius: 4px; }
    .bar-amount { font-size: 10px; color: #64748b; }
    .product-badge { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; margin-top: 2px; }
    .bank-dot { width: 10px; height: 10px; border-radius: 5px; margin-top: 5px; }
    .avatar-circle { width: 30px; height: 30px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin-top: 2px; }
    .page1-title { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin-bottom: 4px; }
    .page1-date { font-size: 12px; color: #94a3b8; margin-bottom: 20px; }
    .page1-badges { margin-bottom: 8px; }
    .page1-badge { background: #f0f4ff; border: 1px solid #c7d2fe; color: #4f46e5; font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px; display: inline-block; margin-right: 6px; }
    .page1-badge.green { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
    table { width: 100%; border-collapse: collapse; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; }
    thead tr { background: #0E0F0C; }
    th { color: #fff; text-align: left; padding: 11px 13px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:nth-child(even) { background: #fafbff; }
    td { padding: 10px 13px; vertical-align: top; }
    .td-name { font-weight: 700; color: #0f172a; font-size: 12px; }
    .td-bank { font-size: 10px; color: #64748b; margin-top: 2px; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 700; }
    .badge-fd { background: #f3e8ff; color: #8b5cf6; }
    .badge-rd { background: #FFE8DF; color: #FF5A1F; }
    .td-amount { font-weight: 700; color: #0f172a; font-size: 12px; }
    .td-maturity { color: #10b981; font-weight: 700; font-size: 12px; }
    .td-rate { color: #8b5cf6; font-weight: 700; font-size: 12px; }
    .td-date { color: #475569; font-size: 11px; }
    .td-holder { font-size: 11px; color: #475569; }
    .table-summary td { font-weight: 700; color: #0E0F0C; font-size: 12px; padding: 12px 13px; border-top: 2px solid #0E0F0C !important; background: #f8fafc; }
    .footer { text-align: center; color: #cbd5e1; font-size: 10px; margin-top: 28px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>

<!-- PAGE 1 — DEPOSIT SCHEDULE -->
<div class="page">
  <div class="page1-badges">
    <span class="page1-badge">Page 1 of 2</span>
    <span class="page1-badge green">${active.length} Active Deposits</span>
  </div>
  <div class="page1-title">Deposit Schedule</div>
  <div class="page1-date">DepositWise Portfolio Report &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Deposit Name</th>
        <th>Type</th>
        <th>Holder</th>
        <th>Start Date</th>
        <th>Tenure</th>
        <th>Principal</th>
        <th>Rate</th>
        <th>Maturity Value</th>
        <th>Maturity Date</th>
      </tr>
    </thead>
    <tbody>
      ${active.map((d, i) => {
        const isRD = d.type === 'RD';
        const installment = isRD && d.tenure_months > 0 ? Math.round(d.principal_amount / d.tenure_months) : 0;
        const matDate = d.maturity_date ? new Date(d.maturity_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        const startDate = d.start_date ? new Date(d.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        
        let tenureStr = '—';
        if (d.start_date && d.maturity_date) {
          const start = new Date(d.start_date);
          const end = new Date(d.maturity_date);
          const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
          if (months >= 12) {
            const yrs = Math.floor(months / 12);
            const mos = months % 12;
            tenureStr = mos > 0 ? `${yrs}y ${mos}m` : `${yrs} yr`;
          } else {
            tenureStr = `${months} mo`;
          }
        } else if (d.tenure_months) {
          tenureStr = `${d.tenure_months} mo`;
        }

        return `
      <tr>
        <td style="color:#94a3b8; font-size:10px; font-weight:600;">${i + 1}</td>
        <td><div class="td-name">${d.name}</div><div class="td-bank">${d.bank}</div></td>
        <td><span class="badge ${d.type === 'FD' ? 'badge-fd' : 'badge-rd'}">${d.type}</span></td>
        <td class="td-holder">${d.family_member_name}</td>
        <td class="td-date">${startDate}</td>
        <td class="td-date">${tenureStr}</td>
        <td><div class="td-amount">${fmt(d.principal_amount)}</div>${isRD ? `<div class="td-bank">${fmt(installment)}/mo</div>` : ''}</td>
        <td class="td-rate">${d.interest_rate}%</td>
        <td class="td-maturity">${fmt(d.maturity_amount || d.principal_amount)}</td>
        <td class="td-date">${matDate}</td>
      </tr>`;
      }).join('')}
      <tr class="table-summary">
        <td colspan="6" style="text-align:right; color:#8b5cf6; font-size:11px;">PORTFOLIO TOTAL</td>
        <td>${fmt(totalInvested)}</td>
        <td style="color:#94a3b8; font-size:11px;">${blendedYield.toFixed(2)}% avg</td>
        <td>${fmt(totalMaturity)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">DepositWise &nbsp;·&nbsp; Your personal fixed deposit tracker &nbsp;·&nbsp; Continued on Page 2 →</div>
</div>

<!-- PAGE 2 — ANALYTICS -->
<div class="page">
  <div class="hero">
    <div class="hero-brand">
      <div class="hero-logo">📊</div>
      <div>
        <div class="hero-title">Portfolio Analytics</div>
        <div class="hero-subtitle">DepositWise &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
      </div>
    </div>
    <div class="hero-label">Total Portfolio Value</div>
    <div class="hero-amount">${fmt(totalMaturity)}</div>
    <div class="hero-stats">
      <div class="hero-stat">
        <div class="hero-stat-label">Invested</div>
        <div class="hero-stat-value">${fmt(totalInvested)}</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-label">Interest Earned</div>
        <div class="hero-stat-value green-text">${fmt(totalInterest)}</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-label">Overall Gain</div>
        <div class="hero-stat-value green-text">+${overallGainPct}%</div>
      </div>
    </div>
  </div>

  <div class="metrics-row">
    <div class="metric-card">
      <div class="metric-label">Blended Yield</div>
      <div class="metric-value">${blendedYield.toFixed(2)}%</div>
      <div class="metric-sub">Weighted avg rate p.a.</div>
    </div>
    <div class="metric-card active-deposits">
      <div class="metric-label">Active Deposits</div>
      <div class="metric-value">${active.length}</div>
      <div class="metric-sub">${fdCount} FD &nbsp;·&nbsp; ${rdCount} RD</div>
    </div>
    <div class="metric-card rd-flow">
      <div class="metric-label">RD Monthly Flow</div>
      <div class="metric-value">${fmt(Math.round(totalRDMonthly))}</div>
      <div class="metric-sub">Cash flow required</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="section-title">Product Mix</div>
      <div class="section-sub">FD vs RD by maturity value</div>
      ${fdValue > 0 ? barRow('Fixed Deposits', fdValue, totalMaturity, '#0E0F0C', `${fdCount} deposits`, `<div class="product-badge" style="background:#D7FE47; color:#0E0F0C;">FD</div>`) : ''}
      ${rdValue > 0 ? barRow('Recurring Deposits', rdValue, totalMaturity, '#0E0F0C', `${rdCount} deposits`, `<div class="product-badge" style="background:#FF5A1F; color:#fff;">RD</div>`) : ''}
    </div>
    <div class="card">
      <div class="section-title">Family Allocation</div>
      <div class="section-sub">Wealth distributed by member</div>
      ${familyEntries.map(([name, val], i) => {
         const color = CHART_COLORS[i % CHART_COLORS.length];
         const badgeHtml = `<div class="avatar-circle" style="background:${color}22; color:${color}">${name.charAt(0).toUpperCase()}</div>`;
         return barRow(name, val, totalMaturity, color, undefined, badgeHtml);
      }).join('')}
    </div>
  </div>

  <div class="card">
    <div class="section-title">Bank Distribution</div>
    <div class="section-sub">Maturity value by institution</div>
    <div class="grid-2" style="margin-bottom:0;">
      ${bankEntries.map(([bank, val], i) => {
         const color = CHART_COLORS[i % CHART_COLORS.length];
         const badgeHtml = `<div class="bank-dot" style="background:${color};"></div>`;
         return barRow(bank, val, totalMaturity, color, undefined, badgeHtml);
      }).join('')}
    </div>
  </div>

  <div class="footer">DepositWise &nbsp;·&nbsp; Your personal fixed deposit tracker &nbsp;·&nbsp; This report is auto-generated and for reference only.</div>
</div>

</body>
</html>`;

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          Alert.alert('Popup Blocked', 'Please allow popups to export your PDF report.');
          return;
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to export to PDF: ' + err.message);
    }
  };


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Settings</Text>

      {isSignedIn && (
        <SettingsSection title="Account">
          <View style={styles.profileRow}>
            {userProfile?.picture ? (
              <Image source={{ uri: userProfile.picture }} style={styles.profilePic} referrerPolicy="no-referrer" />
            ) : (
              <View style={styles.profilePicPlaceholder}>
                <Text style={styles.profileInitial}>
                  {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'G'}
                </Text>
              </View>
            )}
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{userProfile?.name || 'Google User'}</Text>
              <Text style={styles.profileEmail}>{userProfile?.email || 'Connected'}</Text>
            </View>
          </View>
          <SettingsRow
            Icon={LogOut}
            iconColor="#b91c1c"
            iconBg="#fee2e2"
            label="Sign Out"
            onPress={handleSignOut}
            isLast
          />
        </SettingsSection>
      )}

      <SettingsSection title="Backup & Data">
        {!isSignedIn ? (
          <SettingsRow
            Icon={CloudUpload}
            iconColor={colors.text3}
            iconBg={colors.bgBase}
            label="Sign in to Google Drive"
            onPress={handleGoogleSignIn}
          />
        ) : (
          <SettingsRow
            Icon={CloudUpload}
            iconColor={colors.text3}
            iconBg={colors.bgBase}
            label={backingUp ? "Syncing..." : "Sync with Google Drive"}
            onPress={handleManualSync}
          />
        )}

        <SettingsRow
          Icon={Trash2}
          iconColor="#b91c1c"
          iconBg="#fee2e2"
          label="Clear All Data"
          onPress={handleClearData}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Export">
        <SettingsRow
          Icon={FileSpreadsheet}
          iconColor="#15803d"
          iconBg="#dcfce7"
          label="Export to Excel"
          onPress={handleExcelExport}
        />
        <SettingsRow
          Icon={FileText}
          iconColor={colors.lavender}
          iconBg={colors.lavenderSoft}
          label="Export to PDF"
          onPress={handlePdfExport}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsToggleRow
          Icon={Bell}
          iconColor="#b45309"
          iconBg="#fef3c7"
          label="Maturity Reminders"
          value={toggles.maturityReminders}
          onToggle={() => toggle('maturityReminders')}
        />
        <SettingsToggleRow
          Icon={Bell}
          iconColor="#b45309"
          iconBg="#fef3c7"
          label="RD Installment Reminders"
          value={toggles.rdInstallmentReminders}
          onToggle={() => toggle('rdInstallmentReminders')}
          isLast
        />
      </SettingsSection>


      <SettingsSection title="Security">
        <SettingsToggleRow
          Icon={Lock}
          iconColor={toggles.appLock ? '#6366f1' : colors.text3}
          iconBg={toggles.appLock ? '#ede9fe' : colors.bgBase}
          label="App Lock"
          description="Require fingerprint / PIN on open"
          value={toggles.appLock}
          onToggle={handleAppLockToggle}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow
          Icon={Info}
          iconColor={colors.text3}
          iconBg={colors.bgBase}
          label="DepositWise"
          value="v1.0.0"
          onPress={() => { }}
        />
        <View style={[styles.row, { borderBottomWidth: 0, paddingVertical: 14 }]}>
          <Text style={styles.aboutText}>
            DepositWise helps you track all your Fixed Deposits and Recurring Deposits in one place.
          </Text>
        </View>
      </SettingsSection>
    </ScrollView>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({
  Icon, iconColor, iconBg, label, value, onPress, isLast,
}: {
  Icon: any; iconColor: string; iconBg: string; label: string; value?: string; onPress: () => void; isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        <ChevronRight size={16} color={colors.text4} />
      </View>
    </TouchableOpacity>
  );
}

function SettingsToggleRow({
  Icon, iconColor, iconBg, label, description, value, onToggle, isLast,
}: {
  Icon: any; iconColor: string; iconBg: string; label: string; description?: string; value: boolean; onToggle: () => void; isLast?: boolean;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description && <Text style={styles.rowDesc}>{description}</Text>}
      </View>
      <IOSSwitch
        value={value}
        onValueChange={onToggle}
        activeColor="#22863a"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 8 },

  pageTitle: { fontSize: 28, fontFamily: typography.bold, color: colors.text1, letterSpacing: -0.8, marginBottom: 8 },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.bold,
    color: colors.text3,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.separator,
    overflow: 'hidden',
    ...shadows.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: typography.medium, color: colors.text1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, fontFamily: typography.regular, color: colors.text3 },
  rowDesc: { fontSize: 12, fontFamily: typography.regular, color: colors.text3, marginTop: 1 },
  aboutText: { fontSize: 13, fontFamily: typography.regular, color: colors.text3, lineHeight: 20 },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  profilePic: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profilePicPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.text1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: colors.mint,
    fontSize: 20,
    fontFamily: typography.bold,
  },
  profileDetails: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 16,
    fontFamily: typography.bold,
    color: colors.text1,
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: typography.regular,
    color: colors.text3,
  },

  inputCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    gap: 8,
    ...shadows.sm,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.text2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  clientIdInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: radius.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: typography.regular,
    color: colors.text1,
    backgroundColor: colors.bgBase,
    outlineStyle: 'none' as any,
  },
  saveInputBtn: {
    backgroundColor: colors.text1,
    borderRadius: radius.xs,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveInputBtnText: {
    color: colors.mint,
    fontFamily: typography.bold,
    fontSize: 14,
  },
  inputHelp: {
    fontSize: 11,
    fontFamily: typography.regular,
    color: colors.text4,
    lineHeight: 16,
  },
});
