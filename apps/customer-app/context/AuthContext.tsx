import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiClient, type AuthUser } from '@rena/shared';
import { Config } from '@/constants/Config';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  api: ApiClient;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'rena_auth_token';
const api = new ApiClient(Config.apiUrl);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        api.setToken(token);
        const profile = await api.getProfile();
        setUser(profile);
      }
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      api.setToken(null);
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login({ email, password });
    api.setToken(response.token);
    await SecureStore.setItemAsync(TOKEN_KEY, response.token);
    setUser(response.user);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string, phone?: string) => {
      const response = await api.signUp({ email, password, name, phone, role: 'CLIENT' });
      api.setToken(response.token);
      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
      setUser(response.user);
    },
    []
  );

  const logout = useCallback(async () => {
    api.setToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        api,
        login,
        signUp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
