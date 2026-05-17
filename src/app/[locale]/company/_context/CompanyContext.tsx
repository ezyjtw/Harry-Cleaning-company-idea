'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface CompanyData {
  id: string;
  name: string;
  logo: string | null;
  verificationStatus: string;
}

interface CompanyContextValue {
  company: CompanyData | null;
  loading: boolean;
  error: string | null;
}

const CompanyContext = createContext<CompanyContextValue>({
  company: null,
  loading: true,
  error: null,
});

export function useCompany() {
  return useContext(CompanyContext);
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/companies/mine')
      .then((res) => {
        if (!res.ok) throw new Error('No company found');
        return res.json();
      })
      .then((data) => {
        setCompany({
          id: data.company.id,
          name: data.company.name,
          logo: data.company.logo,
          verificationStatus: data.company.verificationStatus,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CompanyContext.Provider value={{ company, loading, error }}>
      {children}
    </CompanyContext.Provider>
  );
}
