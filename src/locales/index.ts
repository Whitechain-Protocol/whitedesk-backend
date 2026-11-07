import en from './en.json';

// In-memory cache for loaded translations (only English loaded at cold boot)
const loadedTranslations: Record<string, any> = {
  en,
};

// Lazy loaders for all other languages so Hermes parses ONLY en.json on cold boot
const lazyLoaders: Record<string, () => any> = {
  tr: () => require('./tr.json'),
  de: () => require('./de.json'),
  fr: () => require('./fr.json'),
  es: () => require('./es.json'),
  it: () => require('./it.json'),
  pt: () => require('./pt.json'),
  nl: () => require('./nl.json'),
  sv: () => require('./sv.json'),
  no: () => require('./no.json'),
  fi: () => require('./fi.json'),
  ru: () => require('./ru.json'),
  uk: () => require('./uk.json'),
  pl: () => require('./pl.json'),
  cs: () => require('./cs.json'),
  hu: () => require('./hu.json'),
  ro: () => require('./ro.json'),
  et: () => require('./et.json'),
  lt: () => require('./lt.json'),
  lv: () => require('./lv.json'),
  ja: () => require('./ja.json'),
  zh: () => require('./zh.json'),
  ko: () => require('./ko.json'),
  vi: () => require('./vi.json'),
  th: () => require('./th.json'),
  id: () => require('./id.json'),
  my: () => require('./my.json'),
  ar: () => require('./ar.json'),
  fa: () => require('./fa.json'),
  he: () => require('./he.json'),
  ur: () => require('./ur.json'),
  hi: () => require('./hi.json'),
  // 2nd+3rd expansion waves: zh-CN reuses the existing Simplified Chinese pack (zh.json).
  // da, el, tl, zh-TW, zh-HK, zh-SG, ms, sk, bg, hr, sr, sl, kk, az, bn, ka, uz, ca, eu, is
  // and sw intentionally have no loader yet — getTranslation() automatically falls back to
  // English until their own JSON packs are created.
  'zh-CN': () => require('./zh.json'),
};

export function getTranslation(lang: string): any {
  if (loadedTranslations[lang]) {
    return loadedTranslations[lang];
  }
  if (lazyLoaders[lang]) {
    try {
      const loaded = lazyLoaders[lang]();
      loadedTranslations[lang] = loaded;
      return loaded;
    } catch {
      return loadedTranslations['en'] || {};
    }
  }
  return loadedTranslations['en'] || {};
}

// Proxy for complete backward compatibility with `translations[lang]`
export const translations: Record<string, any> = new Proxy(loadedTranslations, {
  get(target, prop: string) {
    if (typeof prop === 'string') {
      return getTranslation(prop);
    }
    return target[prop];
  }
});

export default translations;
