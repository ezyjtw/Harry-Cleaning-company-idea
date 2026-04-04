import { useEffect } from 'react';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Checks for OTA updates on app launch and prompts the user to restart.
 * Add <UpdateChecker /> to your root layout.
 */
export function UpdateChecker() {
  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    if (__DEV__) return;

    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert(
          'Update Available',
          'A new version has been downloaded. Restart to apply the update.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Restart', onPress: () => Updates.reloadAsync() },
          ]
        );
      }
    } catch {
      // silently fail
    }
  }

  return null;
}
