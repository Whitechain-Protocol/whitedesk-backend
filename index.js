import * as Crypto from 'expo-crypto';

// Polyfill crypto.getRandomValues for Hermes / React Native cryptographic operations
if (typeof globalThis.crypto !== 'object' || !globalThis.crypto) {
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto.getRandomValues = function (array) {
    return Crypto.getRandomValues(array);
  };
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
