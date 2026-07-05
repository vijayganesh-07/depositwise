import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const APP_LOCK_KEY = 'depositwise_app_lock_enabled';

/** Returns true if App Lock is currently enabled in settings. */
export async function isAppLockEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(APP_LOCK_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/** Saves the App Lock preference. */
export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_KEY, enabled ? 'true' : 'false');
}

/** Returns true if the device has enrolled biometrics or device PIN. */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

/**
 * Prompts the user for biometric / device credential authentication.
 * Returns true if authentication succeeded, false otherwise.
 */
export async function authenticate(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock DepositWise',
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
