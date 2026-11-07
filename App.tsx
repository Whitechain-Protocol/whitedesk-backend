import React, { useState, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/services/i18nService';
import { CryptoService } from './src/services/cryptoService';
import HelpDeskScreen from './src/screens/HelpDeskScreen';
import WhiteDeskScannerScreen from './src/screens/WhiteDeskScannerScreen';
import UnifiedAuthScreen from './src/screens/auth/UnifiedAuthScreen';
import { NotificationService } from './src/services/notificationService';
import { voiceCallService } from './src/services/voiceCallService';
import { remoteDesktopService } from './src/services/remoteDesktopService';

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
          const isRemoteDesktop = initialCall?.callType === 'remote_desktop' || initialCall?.type === 'remote_desktop_offer';
          if (isRemoteDesktop) {
            if (initialCall?.callAction === 'reject') {
              void remoteDesktopService.rejectOffer();
            } else if (initialCall?.callAction === 'answer') {
              await remoteDesktopService.receiveIncomingInvite(initialCall.ticketId, initialCall.callerAlias || 'Admin');
              void remoteDesktopService.acceptOffer();
            } else {
              void remoteDesktopService.receiveIncomingInvite(initialCall.ticketId, initialCall.callerAlias || 'Admin');
            }
            if (storedId) void NotificationService.init(storedId);
            return;
          }

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

    // Üst bildirim bandına tıklanması veya ön plandayken gelen push çağrı modalını anında tetikler
    const unsubTapped = NotificationService.onIncomingCallTapped(async (event: any) => {
      console.warn('[APP] Incoming call event from notification/foreground:', event);
      const isRemoteDesktop = event?.callType === 'remote_desktop' || event?.type === 'remote_desktop_offer';
      if (isRemoteDesktop) {
        if (event?.callAction === 'reject') {
          void remoteDesktopService.rejectOffer();
        } else if (event?.callAction === 'answer') {
          await remoteDesktopService.receiveIncomingInvite(event.ticketId, event.callerAlias || 'Admin');
          void remoteDesktopService.acceptOffer();
        } else {
          void remoteDesktopService.receiveIncomingInvite(event.ticketId, event.callerAlias || 'Admin');
        }
        return;
      }

      const storedId = await CryptoService.getWhiteId().catch(() => null);
      const autoAnswer = event?.callAction === 'answer';
      if (event?.callAction === 'reject') {
        void voiceCallService.rejectCallRequest();
      } else {
        voiceCallService.presentIncomingCallFromPush(event, storedId || '', autoAnswer);
      }
    });

    // Bildirim bandındaki "Reddet" butonuna basıldığında çağrıyı reddeder
    const unsubAction = NotificationService.onIncomingCallAction((actionEvent: any) => {
      console.warn('[APP] Incoming call action event:', actionEvent);
      if (actionEvent?.action === 'reject' || actionEvent?.action === 'hangup') {
        void voiceCallService.rejectCallRequest();
        void remoteDesktopService.rejectOffer();
      }
    });

    return () => {
      unsubTapped();
      unsubAction();
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="HelpDesk" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="HelpDesk" component={HelpDeskScreen} />
        <Stack.Screen name="Auth" component={UnifiedAuthScreen} />
        <Stack.Screen name="Register" component={UnifiedAuthScreen} />
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

