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

interface StripeElementsInstance {
  create(
    type: string,
    options?: Record<string, unknown>
  ): {
    mount(el: HTMLElement): void;
    on(event: string, handler: (ev: unknown) => void): void;
    destroy(): void;
  };
  getElement(type: string): unknown;
}

declare global {
  interface Window {
    openCookieSettings?: () => void;
    Stripe?: (publishableKey: string) => {
      elements(options?: Record<string, unknown>): StripeElementsInstance;
      confirmPayment(
        options: Record<string, unknown>
      ): Promise<{ error?: { message: string }; paymentIntent?: { status: string } }>;
    };
  }
}
