import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import home from './home';
import detail from './detail';
import utils from './utils';

export const LANGUAGE_STORAGE_KEY = 'aobobo-language';
export type Language = 'en' | 'zh-CN';

export function getInitialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'zh-CN') return saved;
  } catch {
    // Language selection still works when browser storage is unavailable.
  }
  const browserLanguage = typeof navigator === 'undefined' ? '' : navigator.language;
  return /^zh(?:-|$)/i.test(browserLanguage) ? 'zh-CN' : 'en';
}

// Chinese source phrases are the keys, keeping both catalogs in sync.
export const english = { ...home, ...detail, ...utils };
const chinese = Object.fromEntries(Object.keys(english).map((key) => [key, key]));
const i18n = createInstance();

function applyLanguage(language: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  dayjs.locale(language === 'zh-CN' ? 'zh-cn' : 'en');
}

i18n.on('languageChanged', (language) => {
  applyLanguage(language);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Persistence is optional in private or restricted browsing contexts.
  }
});

void i18n.use(initReactI18next).init({
  resources: { en: { translation: english }, 'zh-CN': { translation: chinese } },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'zh-CN'],
  load: 'currentOnly',
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export const t = i18n.t.bind(i18n);
export default i18n;
