import { createInstance, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import korean from '../vendor/docmost/client/locales/ko-KR.json';

export const docmostI18n: i18n = createInstance();
void docmostI18n.use(initReactI18next).init({
  lng: 'ko-KR', fallbackLng: 'en', initAsync: false, showSupportNotice: false,
  interpolation: { escapeValue: false },
  resources: { 'ko-KR': { translation: korean } },
});
