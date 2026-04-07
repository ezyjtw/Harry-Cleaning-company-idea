import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ─────────────────────────────────────────────────────

export interface PersonalData {
  fullName: string;
  email: string;
  phone: string;
  postcode: string;
  dateOfBirth: string;
  profilePhotoUri: string;
}

export interface ExperienceData {
  yearsOfExperience: string;
  serviceTypes: string[];
  specialties: string[];
  languages: string[];
  bio: string;
}

export interface PricingData {
  hourlyRate: string;
  sameDayRate: string;
  hoursPerWeek: string;
}

export type RightToWorkDocType =
  | 'uk_passport'
  | 'irish_passport'
  | 'brp'
  | 'eu_settled'
  | 'eu_pre_settled'
  | 'share_code'
  | 'visa';

export interface IdentityData {
  photoIdUri: string;
  rightToWorkDocType: RightToWorkDocType | '';
  rightToWorkDocUri: string;
  shareCode: string;
  expiryDate: string;
}

export type DbsOption = 'existing' | 'new' | '';

export interface DbsCheckData {
  dbsOption: DbsOption;
  dbsCertNumber: string;
  dbsIssueDate: string;
  dbsCertFileUri: string;
  selfieUri: string;
}

export interface PayoutData {
  ryftSetUp: boolean;
}

export interface ReviewData {
  agreedToTerms: boolean;
}

export interface OnboardingFormData {
  personal: PersonalData;
  experience: ExperienceData;
  pricing: PricingData;
  identity: IdentityData;
  dbsCheck: DbsCheckData;
  payout: PayoutData;
  review: ReviewData;
}

interface OnboardingContextType {
  formData: OnboardingFormData;
  updatePersonal: (data: Partial<PersonalData>) => void;
  updateExperience: (data: Partial<ExperienceData>) => void;
  updatePricing: (data: Partial<PricingData>) => void;
  updateIdentity: (data: Partial<IdentityData>) => void;
  updateDbsCheck: (data: Partial<DbsCheckData>) => void;
  updatePayout: (data: Partial<PayoutData>) => void;
  updateReview: (data: Partial<ReviewData>) => void;
  clearOnboarding: () => Promise<void>;
  isLoaded: boolean;
}

// ─── Defaults ──────────────────────────────────────────────────

const defaultFormData: OnboardingFormData = {
  personal: {
    fullName: '',
    email: '',
    phone: '',
    postcode: '',
    dateOfBirth: '',
    profilePhotoUri: '',
  },
  experience: {
    yearsOfExperience: '',
    serviceTypes: [],
    specialties: [],
    languages: [],
    bio: '',
  },
  pricing: {
    hourlyRate: '',
    sameDayRate: '',
    hoursPerWeek: '',
  },
  identity: {
    photoIdUri: '',
    rightToWorkDocType: '',
    rightToWorkDocUri: '',
    shareCode: '',
    expiryDate: '',
  },
  dbsCheck: {
    dbsOption: '',
    dbsCertNumber: '',
    dbsIssueDate: '',
    dbsCertFileUri: '',
    selfieUri: '',
  },
  payout: {
    ryftSetUp: false,
  },
  review: {
    agreedToTerms: false,
  },
};

const STORAGE_KEY = 'rena_cleaner_onboarding';

// ─── Context ───────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [formData, setFormData] = useState<OnboardingFormData>(defaultFormData);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as OnboardingFormData;
          setFormData(parsed);
        }
      } catch {
        // Ignore errors, use defaults
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Persist whenever formData changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(formData)).catch(() => {});
    }
  }, [formData, isLoaded]);

  const updateSection = useCallback(
    <K extends keyof OnboardingFormData>(section: K, data: Partial<OnboardingFormData[K]>) => {
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...data },
      }));
    },
    []
  );

  const updatePersonal = useCallback(
    (data: Partial<PersonalData>) => updateSection('personal', data),
    [updateSection]
  );
  const updateExperience = useCallback(
    (data: Partial<ExperienceData>) => updateSection('experience', data),
    [updateSection]
  );
  const updatePricing = useCallback(
    (data: Partial<PricingData>) => updateSection('pricing', data),
    [updateSection]
  );
  const updateIdentity = useCallback(
    (data: Partial<IdentityData>) => updateSection('identity', data),
    [updateSection]
  );
  const updateDbsCheck = useCallback(
    (data: Partial<DbsCheckData>) => updateSection('dbsCheck', data),
    [updateSection]
  );
  const updatePayout = useCallback(
    (data: Partial<PayoutData>) => updateSection('payout', data),
    [updateSection]
  );
  const updateReview = useCallback(
    (data: Partial<ReviewData>) => updateSection('review', data),
    [updateSection]
  );

  const clearOnboarding = useCallback(async () => {
    setFormData(defaultFormData);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        formData,
        updatePersonal,
        updateExperience,
        updatePricing,
        updateIdentity,
        updateDbsCheck,
        updatePayout,
        updateReview,
        clearOnboarding,
        isLoaded,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return context;
}
