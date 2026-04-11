import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'ro', name: 'Romanian', nativeName: 'Romana' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Bulgarski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugues' },
  { code: 'es', name: 'Spanish', nativeName: 'Espanol' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Ukrainska' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuviu' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviesu' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
];

const LANGUAGE_STORAGE_KEY = '@rena_cleaner_language';

interface LanguageContextType {
  language: string;
  setLanguage: (code: string) => Promise<void>;
  currentLanguage: Language;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  currentLanguage: SUPPORTED_LANGUAGES[0],
  t: (key: string) => key,
});

/**
 * Basic translation dictionaries. In production, these would be loaded
 * from JSON files or a remote translation service.
 */
const translations: Record<string, Record<string, string>> = {
  en: {
    'settings.title': 'Settings',
    'settings.availability': 'Availability',
    'settings.availableNow': 'Available Now',
    'settings.availableNowHint': 'Show as available for same-day bookings',
    'settings.notifications': 'Notifications',
    'settings.pushNotifications': 'Push Notifications',
    'settings.emailNotifications': 'Email Notifications',
    'settings.language': 'Language',
    'settings.selectLanguage': 'App Language',
    'settings.documents': 'Documents',
    'settings.dbsCertificate': 'DBS Certificate',
    'settings.rightToWork': 'Right to Work',
    'settings.identityVerification': 'Identity Verification',
    'settings.legal': 'Legal',
    'settings.terms': 'Terms & Conditions',
    'settings.privacy': 'Privacy Policy',
    'settings.about': 'About Rena',
    'settings.support': 'Support',
    'settings.contactSupport': 'Contact Support',
    'settings.helpCentre': 'Help Centre',
    'tabs.home': 'Home',
    'tabs.jobs': 'Jobs',
    'tabs.messages': 'Messages',
    'tabs.earnings': 'Earnings',
    'tabs.profile': 'Profile',
  },
  pl: {
    'settings.title': 'Ustawienia',
    'settings.availability': 'Dostepnosc',
    'settings.availableNow': 'Dostepny teraz',
    'settings.availableNowHint': 'Pokaz jako dostepny na dzis',
    'settings.notifications': 'Powiadomienia',
    'settings.pushNotifications': 'Powiadomienia push',
    'settings.emailNotifications': 'Powiadomienia e-mail',
    'settings.language': 'Jezyk',
    'settings.selectLanguage': 'Jezyk aplikacji',
    'settings.documents': 'Dokumenty',
    'settings.dbsCertificate': 'Certyfikat DBS',
    'settings.rightToWork': 'Prawo do pracy',
    'settings.identityVerification': 'Weryfikacja tozsamosci',
    'settings.legal': 'Prawne',
    'settings.terms': 'Regulamin',
    'settings.privacy': 'Polityka prywatnosci',
    'settings.about': 'O Rena',
    'settings.support': 'Wsparcie',
    'settings.contactSupport': 'Kontakt z pomoca',
    'settings.helpCentre': 'Centrum pomocy',
    'tabs.home': 'Glowna',
    'tabs.jobs': 'Zlecenia',
    'tabs.messages': 'Wiadomosci',
    'tabs.earnings': 'Zarobki',
    'tabs.profile': 'Profil',
  },
  ro: {
    'settings.title': 'Setari',
    'settings.availability': 'Disponibilitate',
    'settings.availableNow': 'Disponibil acum',
    'settings.availableNowHint': 'Arata ca disponibil pentru rezervari de azi',
    'settings.notifications': 'Notificari',
    'settings.pushNotifications': 'Notificari push',
    'settings.emailNotifications': 'Notificari email',
    'settings.language': 'Limba',
    'settings.selectLanguage': 'Limba aplicatiei',
    'settings.documents': 'Documente',
    'settings.dbsCertificate': 'Certificat DBS',
    'settings.rightToWork': 'Dreptul de munca',
    'settings.identityVerification': 'Verificarea identitatii',
    'settings.legal': 'Legal',
    'settings.terms': 'Termeni si conditii',
    'settings.privacy': 'Politica de confidentialitate',
    'settings.about': 'Despre Rena',
    'settings.support': 'Suport',
    'settings.contactSupport': 'Contacteaza suportul',
    'settings.helpCentre': 'Centrul de ajutor',
    'tabs.home': 'Acasa',
    'tabs.jobs': 'Locuri de munca',
    'tabs.messages': 'Mesaje',
    'tabs.earnings': 'Castiguri',
    'tabs.profile': 'Profil',
  },
  bg: {
    'settings.title': 'Nastroiki',
    'settings.availability': 'Nalichnost',
    'settings.availableNow': 'Nalichen sega',
    'settings.availableNowHint': 'Pokazhi kato nalichen za dneshen den',
    'settings.notifications': 'Saobshteniya',
    'settings.pushNotifications': 'Push saobshteniya',
    'settings.emailNotifications': 'Imeil saobshteniya',
    'settings.language': 'Ezik',
    'settings.selectLanguage': 'Ezik na prilozhenieto',
    'settings.documents': 'Dokumenti',
    'settings.dbsCertificate': 'DBS sertifikat',
    'settings.rightToWork': 'Pravo na rabota',
    'settings.identityVerification': 'Verifikatsiya na samolichnostta',
    'settings.legal': 'Pravni',
    'settings.terms': 'Usloviya',
    'settings.privacy': 'Politika za poveritelnost',
    'settings.about': 'Za Rena',
    'settings.support': 'Podkrepa',
    'settings.contactSupport': 'Svarzhi se s podkrepa',
    'settings.helpCentre': 'Tsentar za pomosht',
    'tabs.home': 'Nachalo',
    'tabs.jobs': 'Rabota',
    'tabs.messages': 'Saobshteniya',
    'tabs.earnings': 'Prihodi',
    'tabs.profile': 'Profil',
  },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
      if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
        setLanguageState(stored);
      }
    });
  }, []);

  const setLanguage = useCallback(async (code: string) => {
    setLanguageState(code);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  }, []);

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const t = useCallback(
    (key: string): string => {
      return translations[language]?.[key] || translations.en?.[key] || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, currentLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
