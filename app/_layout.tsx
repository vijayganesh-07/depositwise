import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { configureGoogleSignIn } from '@/lib/driveSync';
import { registerBackgroundSyncTask } from '@/lib/backgroundTasks';
import { getGoogleClientId } from '@/lib/storage';

SplashScreen.preventAutoHideAsync();


export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || error) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  useEffect(() => {
    // Initialize Google Sign-in config
    getGoogleClientId().then(clientId => {
      configureGoogleSignIn(clientId);
    });

    if (Platform.OS !== 'web') {
      registerBackgroundSyncTask();
    }
  }, []);

  useEffect(() => {
    // 1. Process Google OAuth Redirect on Web
    if (Platform.OS === 'web' && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('google_access_token', token);
        import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
          AsyncStorage.setItem('google_access_token', token);
        });
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        const action = localStorage.getItem('google_pending_action');
        if (action === 'backup') {
          localStorage.removeItem('google_pending_action');
          import('@/lib/storage').then(async ({ backupToGoogleDrive }) => {
            try {
              await backupToGoogleDrive(token);
              alert('Backup to Google Drive succeeded!');
            } catch (err: any) {
              alert('Backup failed: ' + err.message);
            }
          });
        } else if (action === 'restore') {
          localStorage.removeItem('google_pending_action');
          import('@/lib/storage').then(async ({ restoreFromGoogleDrive }) => {
            try {
              await restoreFromGoogleDrive(token);
              alert('Restore from Google Drive succeeded!');
              import('react-native').then(({ DeviceEventEmitter }) => {
                DeviceEventEmitter.emit('deposits_changed');
              });
            } catch (err: any) {
              alert('Restore failed: ' + err.message);
            }
          });
        } else {
          localStorage.removeItem('google_pending_action');
          import('@/lib/storage').then(async ({ fetchAndSaveUserProfile, restoreFromGoogleDrive }) => {
            try {
              await fetchAndSaveUserProfile(token);
              try {
                await restoreFromGoogleDrive(token);
              } catch (restoreErr) {
                console.log('No backup file to restore or auto-restore failed:', restoreErr);
              }
              import('react-native').then(({ DeviceEventEmitter }) => {
                DeviceEventEmitter.emit('deposits_changed');
              });
            } catch (err: any) {
              console.error('Failed to initialize user details after sign in:', err);
            }
          });
        }
      }
    }

    // 2. Perform in-app maturity check alert on app load
    import('@/lib/storage').then(async ({ getDeposits }) => {
      try {
        const list = await getDeposits();
        const active = list.filter(d => d.status === 'active' && d.maturity_date);
        const maturingSoon = active.filter(d => {
          const mDate = new Date(d.maturity_date!);
          const diffTime = mDate.getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 3;
        });

        if (maturingSoon.length > 0) {
          const names = maturingSoon.map(d => `${d.name} (${d.bank})`).join(', ');
          setTimeout(() => {
            if (Platform.OS === 'web') {
              alert(`Maturity Alert: The following deposits are maturing within 3 days:\n\n${names}`);
            } else {
              import('react-native').then(({ Alert }) => {
                Alert.alert(
                  'Maturity Alert',
                  `The following deposits are maturing within 3 days:\n\n${maturingSoon.map(d => `• ${d.name} at ${d.bank}`).join('\n')}`
                );
              });
            }
          }, 1500);
        }
      } catch (e) {
        console.log('Failed to run maturity alert check:', e);
      }
    });
  }, []);

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="deposit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="add-deposit" options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="add-fd" options={{ headerShown: false }} />
        <Stack.Screen name="add-rd" options={{ headerShown: false }} />
        <Stack.Screen name="calculator" options={{ headerShown: false }} />
        <Stack.Screen name="calendar" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
