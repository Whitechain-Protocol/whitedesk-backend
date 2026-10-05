import * as SecureStore from 'expo-secure-store';

/**
 * SafeSecureStore - Native-only secure storage wrapper
 * Explicitly configures keychain/keystore parameters and biometric authentication options
 * to safeguard sensitive cryptographic materials such as private keys and mnemonics.
 */
export const SafeSecureStore = {
  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      const isSensitive = key.includes('private') || key.includes('mnemonic') || key.includes('key');
      
      // For sensitive private keys, restrict accessibility to when the device is unlocked
      const options = isSensitive ? {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
        requireAuthentication: false,
      } : {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      };

      await SecureStore.setItemAsync(key, value, options as any);
    } catch (err) {
      console.error(`SafeSecureStore: Failed to set item for key ${key}:`, err);
      // Don't throw here to prevent app crash, but log it
    }
  },

  async getItemAsync(key: string): Promise<string | null> {
    try {
      const isSensitive = key.includes('private') || key.includes('mnemonic') || key.includes('key');
      
      const options = isSensitive ? {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
        authenticationPrompt: 'Authorize inWhite to decrypt your secure asymmetric keys',
      } : undefined;

      return await SecureStore.getItemAsync(key, options as any);
    } catch (err) {
      console.error(`SafeSecureStore: Failed to get item for key ${key}:`, err);
      return null;
    }
  },

  async deleteItemAsync(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.error(`SafeSecureStore: Failed to delete item for key ${key}:`, err);
    }
  }
};
