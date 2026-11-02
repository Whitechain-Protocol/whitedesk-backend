import { useCallback } from 'react';
import { useTranslation } from '../../../services/i18nService';
import helpdeskLang from '../../../locales/helpdeskLang.json';

export function useHelpDeskI18n() {
  const { t: baseT, language } = useTranslation();
  const currentLanguage: 'tr' | 'en' = language === 'tr' ? 'tr' : 'en';

  const getHelpDeskString = useCallback((key: string, params?: Record<string, string | number>): string => {
    const rawKey = key.replace(/^helpdesk\./, '');
    const currentLangDict = (helpdeskLang as Record<string, Record<string, string>>)[language];
    let val: string | undefined;
    if (currentLangDict && currentLangDict[rawKey]) {
      val = currentLangDict[rawKey];
    } else {
      const enDict = (helpdeskLang as Record<string, Record<string, string>>)['en'];
      if (enDict && enDict[rawKey]) {
        val = enDict[rawKey];
      }
    }
    if (val) {
      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          val = val!.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        });
      }
      return val;
    }
    return baseT(key, params);
  }, [baseT, language]);

  const t = getHelpDeskString;

  const getLabel = useCallback((key: string, tr: string, en: string): string => {
    if (key.startsWith('common.')) {
      const cVal = baseT(key);
      if (cVal && !cVal.includes('.') && cVal !== key) {
        return cVal;
      }
    }
    const localized = getHelpDeskString(key);
    if (localized && localized !== key && !localized.startsWith('helpdesk.') && !localized.startsWith('settings.') && localized !== '[object Object]') {
      return localized;
    }
    return language === 'en' ? en : tr;
  }, [baseT, getHelpDeskString, language]);

  return {
    language,
    currentLanguage,
    t,
    getHelpDeskString,
    getLabel,
  };
}
