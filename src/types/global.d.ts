import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    role: 'CLIENT' | 'CLEANER' | 'ADMIN';
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: 'CLIENT' | 'CLEANER' | 'ADMIN';
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'CLIENT' | 'CLEANER' | 'ADMIN';
  }
}

interface RyftInstance {
  init(config: { publicApiKey: string; environment: string }): void;
  renderDropIn(
    element: HTMLElement,
    config: {
      clientSecret: string;
      appearance?: Record<string, unknown>;
      onPaymentResult?: (result: { status: string }) => void;
      onPaymentError?: (error: { message: string }) => void;
    }
  ): void;
}

declare global {
  interface Window {
    openCookieSettings?: () => void;
    Ryft?: RyftInstance;
  }
}
