import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { exportBackupData, importBackupData, getDeposits, getAllDepositsIncludingDeleted, getPendingChanges, markAsSynced } from './storage';

const BACKUP_FILE_NAME = 'fd_vault_backup.json';

// Configure Google Sign-In with your Web Client ID
export function configureGoogleSignIn(webClientId: string) {
  GoogleSignin.configure({
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    webClientId: webClientId,
    offlineAccess: true, // required for refresh token
  });
}

export async function signIn() {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  return userInfo;
}

export async function signOut() {
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Error signing out', error);
  }
}

interface GoogleDriveFile {
  id: string;
  name: string;
}

// Search for the file specifically in the hidden appDataFolder
async function searchBackupFile(token: string): Promise<GoogleDriveFile | null> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILE_NAME}'&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive Search Failed: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  if (result.files && result.files.length > 0) {
    return result.files[0] as GoogleDriveFile;
  }
  return null;
}

// The main function used by the background task
export async function syncWithGoogleDrive(): Promise<boolean> {
  try {
    const hasPlayServices = await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    if (!hasPlayServices) return false;

    const isSignedIn = GoogleSignin.hasPreviousSignIn();
    if (!isSignedIn) return false;

    // Get the tokens silently
    const { accessToken } = await GoogleSignin.getTokens();
    if (!accessToken) return false;

    // Check if we have pending changes locally
    const pendingChanges = await getPendingChanges();
    
    // We fetch the current remote backup
    const remoteFile = await searchBackupFile(accessToken);
    let remoteBackup: any = null;

    if (remoteFile) {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${remoteFile.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (response.ok) {
        remoteBackup = await response.json();
      }
    }

    // Export current local state
    const localBackup = await exportBackupData();
    let finalBackupToUpload = localBackup;

    // VERY BASIC CONFLICT RESOLUTION:
    // If the remote backup has a newer timestamp than our local changes, and we have NO pending changes,
    // we should download.
    // If we have pending changes, we push our local state to remote (Last-Write-Wins for the device doing the edit).
    // A robust system would merge per-record timestamps, but for local-first, treating the entire DB state
    // as the source of truth if we have pending edits is the safest path without a backend.
    
    if (remoteBackup && remoteBackup.timestamp && !pendingChanges.length) {
      const remoteTime = new Date(remoteBackup.timestamp).getTime();
      const localTime = new Date(localBackup.timestamp).getTime();
      
      // If remote is newer, import it
      if (remoteTime > localTime) {
        await importBackupData(remoteBackup);
        return true; // We successfully synced by downloading
      }
    }

    // If we have pending changes, or no remote file exists, or our local is strictly newer, we upload.
    if (pendingChanges.length > 0 || !remoteFile) {
      const content = JSON.stringify(localBackup, null, 2);
      
      if (remoteFile) {
        // Update existing (PATCH)
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${remoteFile.id}?uploadType=media`;
        await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: content,
        });
      } else {
        // Create new in appDataFolder (POST)
        const boundary = 'foo_bar_baz';
        const metadata = {
          name: BACKUP_FILE_NAME,
          mimeType: 'application/json',
          parents: ['appDataFolder'], // Crucial for storing in the hidden app folder
        };

        const multipartBody =
          `\r\n--${boundary}\r\n` +
          `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\n` +
          `Content-Type: application/json\r\n\r\n` +
          `${content}\r\n` +
          `--${boundary}--` +
          `\r\n`;

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        });
      }
      
      // Mark local items as synced
      await markAsSynced(pendingChanges.map(d => d.id));
    }

    return true;
  } catch (error) {
    console.error('Google Drive Sync Error:', error);
    return false;
  }
}
