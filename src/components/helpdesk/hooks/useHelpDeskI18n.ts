import { useCallback } from 'react';
import { useTranslation } from '../../../services/i18nService';

export function useHelpDeskI18n() {
  const { t: baseT, language } = useTranslation();
  const currentLanguage: 'tr' | 'en' = language === 'tr' ? 'tr' : 'en';

  const getHelpDeskString = useCallback(
    (
      key: string,
      paramsOrFallback?: Record<string, string | number> | string,
      maybeParams?: Record<string, string | number>
    ): string => {
      return baseT(key, paramsOrFallback, maybeParams);
    },
    [baseT]
  );

  const t = getHelpDeskString;

  const getLabel = useCallback(
    (
      key: string,
      trOrParams?: string | Record<string, string | number>,
      en?: string,
      maybeParams?: Record<string, string | number>
    ): string => {
      const params =
        typeof trOrParams === 'object' && trOrParams !== null ? trOrParams : maybeParams;
      const tr = typeof trOrParams === 'string' ? trOrParams : undefined;

      const localized = baseT(key, params);
      if (
        localized &&
        localized !== key &&
        localized !== '[object Object]'
      ) {
        return localized;
      }
      if (language !== 'tr' && en !== undefined) return en;
      if (tr !== undefined) return tr;
      return localized || key;
    },
    [baseT, language]
  );

  return {
    language,
    locale: language,
    activeLocale: language,
    currentLanguage,
    t,
    getHelpDeskString,
    getLabel,
  };
}
