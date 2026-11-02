import React, { useState, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/services/i18nService';
import { CryptoService } from './src/services/cryptoService';
import HelpDeskScreen from './src/screens/HelpDeskScreen';
import WhiteDeskScannerScreen from './src/screens/WhiteDeskScannerScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import UserGuideScreen from './src/screens/UserGuideScreen';
import TenantSetupScreen from './src/screens/TenantSetupScreen';
import UnifiedAuthScreen from './src/screens/auth/UnifiedAuthScreen';
import { NotificationService } from './src/services/notificationService';
import { voiceCallService } from './src/services/voiceCallService';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef<any>();

function AppContent() {
  useEffect(() => {
    async function checkAuth() {
      try {
        const [initialCall, isRegistered, storedId] = await Promise.all([
          NotificationService.getInitialCallIntent().catch(() => null),
          CryptoService.checkRegistrationStatus().catch(() => false),
          CryptoService.getWhiteId().catch(() => null),
        ]);

        if (initialCall?.ticketId || initialCall?.callerWhiteId) {
          console.warn('[APP] Instant cold start incoming call detected:', initialCall);
          const autoAnswer = initialCall?.callAction === 'answer';
          if (initialCall?.callAction === 'reject') {
            void voiceCallService.rejectCallRequest();
          } else {
            voiceCallService.presentIncomingCallFromPush(initialCall, storedId || '', autoAnswer);
          }
          if (storedId) void NotificationService.init(storedId);
          return;
        }

        if (isRegistered && storedId) {
          void NotificationService.init(storedId);
        } else {
          // Kayıtlı değilse sessizce Register ekranına yönlendir
          if (navigationRef.isReady()) {
            navigationRef.reset({
              index: 0,
              routes: [{ name: 'Register' }],
            });
          }
        }
      } catch (err) {
        console.error('[WhiteDesk Auth Check]', err);
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Register' }],
          });
        }
      }
    }
    checkAuth();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="HelpDesk" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="HelpDesk" component={HelpDeskScreen} />
        <Stack.Screen name="Auth" component={UnifiedAuthScreen} />
        <Stack.Screen name="Register" component={UnifiedAuthScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="UserGuide" component={UserGuideScreen} />
        <Stack.Screen name="TenantSetup" component={TenantSetupScreen} />
        <Stack.Screen 
          name="WhiteDeskScanner" 
          component={WhiteDeskScannerScreen} 
          options={{ presentation: 'modal' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" translucent />
        <AppContent />
      </I18nProvider>
    </SafeAreaProvider>
  );
}

