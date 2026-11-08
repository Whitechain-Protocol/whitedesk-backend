import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Platform, NativeModules } from 'react-native';
import { SafeSecureStore } from './storageService';
import translations from '../locales';
import { getLocalizedLanguageName } from '../locales/languageNames';
export { getLocalizedLanguageName };

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', rtl: true },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', rtl: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', rtl: true },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာဘာသာ' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ тілі' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan dili' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbek tili' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
];

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string, paramsOrFallback?: Record<string, string | number> | string, maybeParams?: Record<string, string | number>) => string;
  languages: LanguageOption[];
  currentLanguageDetails: LanguageOption;
  getLanguageName: (targetCode: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key: string) => key,
  languages: SUPPORTED_LANGUAGES,
  currentLanguageDetails: SUPPORTED_LANGUAGES[0],
  getLanguageName: (code: string) => code,
});

export function detectDeviceLanguage(): string {
  try {
    // 1. ECMAScript Intl API (Supported natively in Hermes, V8, and Web)
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) {
      const code = intlLocale.split(/[-_]/)[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.some(l => l.code === code)) {
        return code;
      }
    }
  } catch (_) {}

  try {
    // 2. React Native NativeModules system locale fallback
    const systemLocale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;

    if (systemLocale) {
      const code = String(systemLocale).split(/[-_]/)[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.some(l => l.code === code)) {
        return code;
      }
    }
  } catch (_) {}

  return 'en';
}

let currentActiveLanguage = detectDeviceLanguage();

export const i18nService = {
  getCurrentLanguage: () => currentActiveLanguage,
  getLanguageName: (targetCode: string) => getLocalizedLanguageName(currentActiveLanguage, targetCode),
  
  t: (key: string, paramsOrFallback?: Record<string, string | number> | string, maybeParams?: Record<string, string | number>): string => {
    return resolveTranslation(currentActiveLanguage, key, paramsOrFallback, maybeParams);
  }
};

function lookupInLang(lang: string, key: string): string | undefined {
  const dict = translations[lang];
  if (!dict) return undefined;

  const keys = key.split('.');
  const value: any = keys.reduce((obj, k) => (obj && typeof obj === 'object' ? obj[k] : undefined), dict);
  if (typeof value === 'string') return value;

  if (!key.startsWith('helpdesk.') && dict.helpdesk && typeof dict.helpdesk === 'object') {
    const hdValue: any = keys.reduce((obj, k) => (obj && typeof obj === 'object' ? obj[k] : undefined), dict.helpdesk);
    if (typeof hdValue === 'string') return hdValue;
  }

  return undefined;
}

function resolveTranslation(
  lang: string,
  key: string,
  paramsOrFallback?: Record<string, string | number> | string,
  maybeParams?: Record<string, string | number>
): string {
  const fallbackStr = typeof paramsOrFallback === 'string' ? paramsOrFallback : undefined;
  const params = typeof paramsOrFallback === 'object' && paramsOrFallback !== null ? paramsOrFallback : maybeParams;

  // Try selected language
  let value = lookupInLang(lang, key);

  // Fallback to English if not found
  if (value === undefined && lang !== 'en') {
    value = lookupInLang('en', key);
  }

  // Fallback to Turkish master dictionary if not yet in English
  if (value === undefined && lang !== 'tr') {
    value = lookupInLang('tr', key);
  }

  // Fallback to provided fallback string or raw key if still not found
  if (value === undefined) {
    value = fallbackStr !== undefined ? fallbackStr : key;
  }

  // Replace parameters like {count}, {name} or {{count}}, {{name}}
  if (params) {
    let result = value;
    for (const [paramKey, paramVal] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{\\{?${paramKey}\\}?\\}`, 'g'), String(paramVal));
    }
    return result;
  }

  return value;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<string>(() => {
    return detectDeviceLanguage();
  });

  useEffect(() => {
    const initLanguage = async () => {
      try {
        const savedLang = await SafeSecureStore.getItemAsync('user_language');
        if (savedLang && SUPPORTED_LANGUAGES.some(l => l.code === savedLang)) {
          setLangState(savedLang);
          currentActiveLanguage = savedLang;
          return;
        }

        // On fresh installation, automatically initialize with the detected device language
        const detected = detectDeviceLanguage();
        setLangState(detected);
        currentActiveLanguage = detected;
      } catch (e) {
        console.warn('I18nProvider: Failed to load stored language, using detected device language', e);
        const detected = detectDeviceLanguage();
        setLangState(detected);
        currentActiveLanguage = detected;
      }
    };
    initLanguage();
  }, []);

  const setLanguage = useCallback(async (newLang: string) => {
    try {
      if (SUPPORTED_LANGUAGES.some(l => l.code === newLang)) {
        setLangState(newLang);
        currentActiveLanguage = newLang;
        await SafeSecureStore.setItemAsync('user_language', newLang);

        // Sync preferred notification language to backend
        try {
          const ownWhiteId =
            (await SafeSecureStore.getItemAsync('inwhite_id')) ||
            (await SafeSecureStore.getItemAsync('wb_white_id'));
          if (ownWhiteId) {
            const { apiClient } = require('./apiClient');
            apiClient.updatePushLanguage(ownWhiteId, newLang).catch(() => {});
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn('I18nProvider: Failed to persist language', e);
    }
  }, []);

  const t = useCallback((key: string, paramsOrFallback?: Record<string, string | number> | string, maybeParams?: Record<string, string | number>): string => {
    return resolveTranslation(language, key, paramsOrFallback, maybeParams);
  }, [language]);

  const getLanguageName = useCallback((targetCode: string): string => {
    return getLocalizedLanguageName(language, targetCode);
  }, [language]);

  const currentLanguageDetails = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, languages: SUPPORTED_LANGUAGES, currentLanguageDetails, getLanguageName }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
