import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
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
} from '@/lib/storage';
import { signIn, syncWithGoogleDrive, configureGoogleSignIn } from '@/lib/driveSync';

type SettingToggle = {
  maturityReminders: boolean;
  rdInstallmentReminders: boolean;
  appLock: boolean;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [toggles, setToggles] = useState<SettingToggle>({
    maturityReminders: true,
    rdInstallmentReminders: true,
    appLock: false,
  });

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

  const toggle = (key: keyof SettingToggle) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
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

      const blendedYield = totalInvested > 0 
        ? active.reduce((sum, d) => sum + (d.principal_amount * d.interest_rate), 0) / totalInvested
        : 0;
        
      const totalRDMonthly = active
        .filter(d => d.type === 'RD' && d.tenure_months > 0)
        .reduce((sum, d) => sum + (d.principal_amount / d.tenure_months), 0);

      const fdValue = active.filter(d => d.type === 'FD').reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);
      const rdValue = active.filter(d => d.type === 'RD').reduce((s, d) => s + (d.maturity_amount || d.principal_amount), 0);

      const bankMap: Record<string, number> = {};
      const familyMap: Record<string, number> = {};
      active.forEach(d => {
        const val = d.maturity_amount || d.principal_amount;
        bankMap[d.bank] = (bankMap[d.bank] || 0) + val;
        familyMap[d.family_member_name] = (familyMap[d.family_member_name] || 0) + val;
      });

      const html = `
        <html>
          <head>
            <title>DepositWise Portfolio Report</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #0E0F0C; background: #F4F2EC; }
              @media print {
                @page { margin: 15mm; }
                body { background: #FFFFFF; padding: 0; }
                .page-break { page-break-before: always; margin-top: 40px; }
              }
              h1 { margin-bottom: 5px; color: #0E0F0C; }
              h2 { margin-top: 40px; margin-bottom: 15px; font-size: 20px; color: #0E0F0C; border-bottom: 2px solid #EBE8E0; padding-bottom: 8px; }
              h3 { margin-top: 0; margin-bottom: 15px; font-size: 16px; color: #0E0F0C; }
              .date { color: #8A8A82; font-size: 14px; margin-bottom: 30px; }
              .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
              .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
              .card { padding: 20px; background: #fff; border-radius: 16px; border: 1px solid #EBE8E0; }
              .card-label { font-size: 12px; color: #8A8A82; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.5px; }
              .card-value { font-size: 24px; font-weight: 800; color: #0E0F0C; }
              .card-value.green { color: #22863a; }
              .card-value.lime { color: #0E0F0C; background: #D7FE47; display: inline-block; padding: 2px 8px; border-radius: 6px; }
              .list-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #EBE8E0; font-size: 14px; }
              .list-item:last-child { border-bottom: none; padding-bottom: 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #EBE8E0; }
              th { background: #0E0F0C; color: #fff; text-align: left; padding: 12px; font-weight: 600; font-size: 13px; }
              td { padding: 12px; border-bottom: 1px solid #EBE8E0; font-size: 13px; }
              .badge { padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; }
              .badge.fd { background: #22863a; color: #fff; }
              .badge.rd { background: #FF5A1F; color: #fff; }
              .muted { color: #8A8A82; font-size: 11px; display: block; margin-top: 3px; }
            </style>
          </head>
          <body>
            <h1>DepositWise Portfolio Report</h1>
            <div class="date">Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
            
            <h2>1. Portfolio Analytics</h2>
            
            <div class="grid">
              <div class="card">
                <div class="card-label">Total Invested</div>
                <div class="card-value">₹${totalInvested.toLocaleString('en-IN')}</div>
              </div>
              <div class="card">
                <div class="card-label">Estimated Interest</div>
                <div class="card-value green">₹${totalInterest.toLocaleString('en-IN')}</div>
              </div>
              <div class="card">
                <div class="card-label">Portfolio Value</div>
                <div class="card-value lime">₹${totalMaturity.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div class="grid">
              <div class="card">
                <div class="card-label">Blended Yield</div>
                <div class="card-value">${blendedYield.toFixed(2)}% <span style="font-size:12px; font-weight:400; color:#8A8A82">p.a.</span></div>
              </div>
              <div class="card">
                <div class="card-label">RD Monthly Flow</div>
                <div class="card-value">₹${totalRDMonthly.toLocaleString('en-IN')}</div>
              </div>
              <div class="card">
                <div class="card-label">Total Deposits</div>
                <div class="card-value">${active.length}</div>
              </div>
            </div>

            <div class="grid-2">
              <div class="card">
                <h3>Product Mix</h3>
                <div class="list-item">
                  <span>Fixed Deposits</span>
                  <strong>₹${fdValue.toLocaleString('en-IN')}</strong>
                </div>
                <div class="list-item">
                  <span>Recurring Deposits</span>
                  <strong>₹${rdValue.toLocaleString('en-IN')}</strong>
                </div>
              </div>
              
              <div class="card">
                <h3>Family Allocation</h3>
                ${Object.entries(familyMap).sort((a,b)=>b[1]-a[1]).map(([name, val]) => `
                  <div class="list-item">
                    <span>${name}</span>
                    <strong>₹${val.toLocaleString('en-IN')}</strong>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="card" style="margin-bottom: 40px;">
              <h3>Bank Distribution</h3>
              <div class="grid-2" style="margin-bottom: 0;">
                ${Object.entries(bankMap).sort((a,b)=>b[1]-a[1]).map(([bank, val]) => `
                  <div class="list-item">
                    <span>${bank}</span>
                    <strong>₹${val.toLocaleString('en-IN')}</strong>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="page-break"></div>
            
            <h2>2. Detailed Deposit Schedule</h2>
            <table>
              <thead>
                <tr>
                  <th>Name / Bank</th>
                  <th>Type</th>
                  <th>Holder</th>
                  <th>Principal / Installment</th>
                  <th>Rate</th>
                  <th>Maturity Amount</th>
                  <th>Maturity Date</th>
                </tr>
              </thead>
              <tbody>
                ${active.map(d => {
                  const isRD = d.type === 'RD';
                  const installment = isRD && d.tenure_months > 0 ? d.principal_amount / d.tenure_months : 0;
                  return `
                  <tr>
                    <td>
                      <strong>${d.name}</strong>
                      <span class="muted">${d.bank}</span>
                    </td>
                    <td><span class="badge ${d.type.toLowerCase()}">${d.type}</span></td>
                    <td>${d.family_member_name}</td>
                    <td>
                      ₹${d.principal_amount.toLocaleString('en-IN')}
                      ${isRD ? `<span class="muted">₹${Math.round(installment).toLocaleString('en-IN')}/mo</span>` : ''}
                    </td>
                    <td>${d.interest_rate}%</td>
                    <td>₹${(d.maturity_amount || d.principal_amount).toLocaleString('en-IN')}</td>
                    <td>${d.maturity_date ? new Date(d.maturity_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', day: 'numeric' }) : '-'}</td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `;

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
            iconColor={colors.lavender}
            iconBg={colors.lavenderSoft}
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
            iconColor={colors.text1}
            iconBg={colors.mint}
            label="Sign in to Google Drive"
            onPress={handleGoogleSignIn}
          />
        ) : (
          <SettingsRow
            Icon={CloudUpload}
            iconColor={colors.text1}
            iconBg={colors.mint}
            label={backingUp ? "Syncing..." : "Sync with Google Drive"}
            onPress={handleManualSync}
          />
        )}
        <SettingsRow
          Icon={HardDrive}
          iconColor={colors.text1}
          iconBg={colors.mint}
          label="Local Backup (JSON)"
          onPress={handleLocalBackup}
        />
        <SettingsRow
          Icon={Trash2}
          iconColor={colors.lavender}
          iconBg={colors.lavenderSoft}
          label="Clear All Data"
          onPress={handleClearData}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Export">
        <SettingsRow
          Icon={FileSpreadsheet}
          iconColor={colors.text1}
          iconBg={colors.mint}
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
          iconColor={colors.text1}
          iconBg={colors.mint}
          label="Maturity Reminders"
          value={toggles.maturityReminders}
          onToggle={() => toggle('maturityReminders')}
        />
        <SettingsToggleRow
          Icon={Bell}
          iconColor={colors.lavender}
          iconBg={colors.lavenderSoft}
          label="RD Installment Reminders"
          value={toggles.rdInstallmentReminders}
          onToggle={() => toggle('rdInstallmentReminders')}
          isLast
        />
      </SettingsSection>


      <SettingsSection title="Security">
        <SettingsToggleRow
          Icon={Lock}
          iconColor={colors.lavender}
          iconBg={colors.lavenderSoft}
          label="App Lock"
          description="Biometric / PIN authentication"
          value={toggles.appLock}
          onToggle={() => toggle('appLock')}
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
          onPress={() => {}}
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
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.bgTertiary, true: '#22863a' }}
        thumbColor={colors.white}
        {...({ activeThumbColor: colors.white } as any)}
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
