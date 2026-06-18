import { useState, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { Home, Building2, BarChart3, Settings, TrendingUp } from 'lucide-react-native';
import { colors, radius, typography, shadows } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGoogleClientId, isAuthenticated, fetchAndSaveUserProfile, restoreFromGoogleDrive } from '@/lib/storage';

const TABS = [
  { name: 'index', label: 'Home', Icon: Home },
  { name: 'deposits', label: 'Deposits', Icon: Building2 },
  { name: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { name: 'settings', label: 'Settings', Icon: Settings },
];

const GoogleIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </Svg>
);

import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

function OnboardingScreen({ onSignInSuccess }: { onSignInSuccess: () => void }) {
  const [signingIn, setSigningIn] = useState(false);
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    getGoogleClientId().then((id) => setClientId(id || ''));
  }, []);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'depositwise',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'dummy-client-id',
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      redirectUri,
      responseType: 'token',
      usePKCE: false,
      prompt: AuthSession.Prompt.SelectAccount,
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const handleToken = async () => {
        setSigningIn(true);
        try {
          const token = response.params.access_token;
          if (token) {
            await AsyncStorage.setItem('google_access_token', token);
            await fetchAndSaveUserProfile(token);
            try {
              await restoreFromGoogleDrive(token);
            } catch (restoreErr) {
              console.log('No backup found or restore failed. Starting fresh:', restoreErr);
              const { clearAllData } = await import('@/lib/storage');
              await clearAllData();
            }
            DeviceEventEmitter.emit('deposits_changed');
            onSignInSuccess();
          }
        } catch (error) {
          console.error(error);
          Alert.alert('Error', 'Google Sign-in failed.');
        } finally {
          setSigningIn(false);
        }
      };
      handleToken();
    } else if (response?.type === 'error') {
      Alert.alert('Authentication Error', response.error?.message || 'Something went wrong.');
    }
  }, [response]);

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      // On web: use direct OAuth implicit flow redirect
      const redirectUri = window.location.origin + window.location.pathname;
      const scope = [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' ');
      localStorage.removeItem('google_pending_action'); // fallback signin action
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
    // On Android: use native Google Sign-In via AuthSession
    if (!clientId) {
      Alert.alert('Configuration Missing', 'Please set up a valid Google Client ID in Settings first.');
      return;
    }
    setSigningIn(true);
    try {
      await promptAsync();
    } catch (e) {
      console.error(e);
      setSigningIn(false);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.bgBase }]}>
      {/* Decorative blobs */}
      <View style={[styles.blob, { backgroundColor: colors.mint, top: -80, right: -80, width: 260, height: 260 }]} />
      <View style={[styles.blob, { backgroundColor: colors.lavenderSoft, bottom: -60, left: -60, width: 220, height: 220 }]} />

      <View style={styles.onboardingContainer}>
        <View style={styles.onboardingCard}>
          {/* Logo */}
          <View style={styles.logoBadge}>
            <TrendingUp size={28} color={colors.text1} strokeWidth={2.5} />
          </View>

          <Text style={styles.onboardingTitle}>DepositWise</Text>
          <Text style={styles.onboardingSubtitle}>
            Your premium companion for tracking Fixed Deposits & Recurring Deposits offline.
          </Text>

          <View style={styles.featuresList}>
            <FeatureRow text="Private-by-design local storage" />
            <FeatureRow text="Automatic interest & yield forecasts" />
            <FeatureRow text="Secure cloud backups via Google Drive" />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleSignIn}
            disabled={signingIn}
            activeOpacity={0.85}
          >
            {signingIn ? (
              <ActivityIndicator size="small" color={colors.text1} />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureBullet} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function CustomTabBar({ state, navigation, authenticated, onSignInPrompt }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.barWrapper, { paddingBottom: insets.bottom || 8 }]} pointerEvents="box-none">
      <View style={styles.barContainer}>
        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
          const isFocused = state.index === routeIndex && routeIndex !== -1;

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => {
                if (!authenticated) {
                  onSignInPrompt();
                } else {
                  routeIndex !== -1 && navigation.navigate(tab.name);
                }
              }}
              activeOpacity={0.7}
            >
              {isFocused ? (
                <View style={styles.activePill}>
                  <tab.Icon
                    size={20}
                    color={colors.text1}
                    strokeWidth={2.5}
                  />
                  <Text style={styles.pillText}>
                    {tab.label}
                  </Text>
                </View>
              ) : (
                <View style={styles.inactiveTab}>
                  <tab.Icon
                    size={22}
                    color={'rgba(255,255,255,0.5)'}
                    strokeWidth={2}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const checkAuth = async () => {
    const auth = await isAuthenticated();
    setAuthenticated(auth);
  };

  useEffect(() => {
    checkAuth();
    const sub = Linking.addEventListener('url', checkAuth);
    const interval = setInterval(checkAuth, 1000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  const handleSignInPrompt = () => {
    Alert.alert('Sign In Required', 'Please sign in using the "Continue with Google" button.');
  };

  if (authenticated === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgBase, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.text1} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <CustomTabBar authenticated={authenticated} onSignInPrompt={handleSignInPrompt} {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="deposits" />
        <Tabs.Screen name="analytics" />
        <Tabs.Screen name="settings" />
      </Tabs>

      {authenticated === false && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
          <OnboardingScreen onSignInSuccess={() => setAuthenticated(true)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Tab Bar
  barWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    zIndex: 10,
  },
  barContainer: {
    marginHorizontal: 20,
    marginBottom: Platform.OS === 'ios' ? 12 : 16,
    borderRadius: 28,
    backgroundColor: colors.text1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 10,
    ...shadows.md,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    backgroundColor: colors.mint,
  },
  pillText: {
    fontSize: 13,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.2,
  },
  inactiveTab: {
    padding: 8,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.separator,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  // Onboarding
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.25,
  },
  onboardingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  onboardingCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.bento,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.separator,
    ...shadows.md,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  onboardingTitle: {
    fontSize: 28,
    fontFamily: typography.bold,
    color: colors.text1,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  onboardingSubtitle: {
    fontSize: 14,
    fontFamily: typography.regular,
    color: colors.text3,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  featuresList: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text1,
  },
  featureText: {
    fontSize: 14,
    fontFamily: typography.medium,
    color: colors.text2,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text1,
    borderRadius: radius.sm,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    gap: 12,
  },
  googleBtnText: {
    color: colors.white,
    fontFamily: typography.bold,
    fontSize: 15,
  },
});
