// In-memory cache for loaded translations (strictly lazy-loaded: ONLY the active language is loaded on boot)
const loadedTranslations: Record<string, any> = {};

// Lazy loaders for all 54 languages so Hermes parses ONLY the active device language on cold boot
const lazyLoaders: Record<string, () => any> = {
  en: () => require('./en.json'),
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
  // 2nd + 3rd expansion waves (all 54 languages fully localized with 2,442 keys)
  'zh-CN': () => require('./zh-CN.json'),
  'zh-TW': () => require('./zh-TW.json'),
  'zh-HK': () => require('./zh-HK.json'),
  'zh-SG': () => require('./zh-SG.json'),
  da: () => require('./da.json'),
  el: () => require('./el.json'),
  tl: () => require('./tl.json'),
  ms: () => require('./ms.json'),
  sk: () => require('./sk.json'),
  bg: () => require('./bg.json'),
  hr: () => require('./hr.json'),
  sr: () => require('./sr.json'),
  sl: () => require('./sl.json'),
  kk: () => require('./kk.json'),
  az: () => require('./az.json'),
  bn: () => require('./bn.json'),
  ka: () => require('./ka.json'),
  uz: () => require('./uz.json'),
  ca: () => require('./ca.json'),
  eu: () => require('./eu.json'),
  is: () => require('./is.json'),
  sw: () => require('./sw.json'),
  am: () => require('./am.json'),
  ha: () => require('./ha.json'),
  ky: () => require('./ky.json'),
  mn: () => require('./mn.json'),
  sq: () => require('./sq.json'),
  ta: () => require('./ta.json'),
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
      if (lang !== 'en') return getTranslation('en');
      return {};
    }
  }
  if (lang !== 'en') {
    return getTranslation('en');
  }
  return {};
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
