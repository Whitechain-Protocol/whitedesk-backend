import React, { useState, useEffect } from 'react';
import { StatusBar, View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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

const Stack = createStackNavigator();

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<'HelpDesk' | 'Welcome' | 'Register'>('HelpDesk');

  useEffect(() => {
    async function checkAuth() {
      try {
        const [isRegistered, storedId] = await Promise.all([
          CryptoService.checkRegistrationStatus(),
          CryptoService.getWhiteId(),
        ]);
        if (isRegistered && storedId) {
          setInitialRoute('HelpDesk');
        } else {
          setInitialRoute('Register');
        }
      } catch (err) {
        console.error('[WhiteDesk Auth Check]', err);
        setInitialRoute('Register');
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" translucent />
        <Text style={styles.splashLogo}>WhiteDesk</Text>
        <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="UserGuide" component={UserGuideScreen} />
        <Stack.Screen name="TenantSetup" component={TenantSetupScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="HelpDesk" component={HelpDeskScreen} />
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

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#F4F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    fontSize: 56,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1.5,
    fontFamily: 'Arial Black',
  },
});
