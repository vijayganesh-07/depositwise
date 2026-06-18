import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { NetInfo } from '@react-native-community/netinfo';
import { syncWithGoogleDrive } from './driveSync';

export const BACKGROUND_SYNC_TASK = 'background-gdrive-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    // Only attempt sync if we think we might have an internet connection
    // Note: NetInfo is required for checking, but we can also just try and catch
    // Since we don't have NetInfo installed, we'll rely on the fetch catching errors.
    
    console.log('Background task triggered: Running Google Drive Sync...');
    await syncWithGoogleDrive();
    
    // Return successful result
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background sync task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSyncTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 60 * 15, // 15 minutes
        stopOnTerminate: false, // android only
        startOnBoot: true, // android only
      });
      console.log('Background sync task registered successfully.');
    }
  } catch (err) {
    console.log('Background fetch task registration failed:', err);
  }
}

export async function unregisterBackgroundSyncTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      console.log('Background sync task unregistered.');
    }
  } catch (err) {
    console.log('Background fetch task unregistration failed:', err);
  }
}
