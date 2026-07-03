'use client';

import { useEffect } from 'react';

// Root global error boundary. This replaces the ENTIRE document (including the
// root layout) when a hard crash happens above the locale layout, so it renders
// with NO app CSS — the Tailwind/token stylesheet is not guaranteed to be
// present. Everything here is therefore inline-styled and self-contained, using
// literal brand hex values (primary #16296b, ink #1B2A4A, page #FAFBFC) and a
// serif stack that approximates Newsreader without depending on the font loader.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#FAFBFC',
          color: '#1B2A4A',
          fontFamily:
            "'Jost', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: '420px', textAlign: 'center' }}>
          <div
            style={{
              margin: '0 auto 20px',
              height: '64px',
              width: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '9999px',
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
            }}
            aria-hidden="true"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          <h1
            style={{
              margin: '0 0 8px',
              fontSize: '26px',
              fontWeight: 600,
              color: '#1B2A4A',
              fontFamily: "'Newsreader', Georgia, 'Times New Roman', serif",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: '15px', lineHeight: 1.6, color: '#3D5170' }}>
            We hit an unexpected error. Please try again, or return to the home page.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={reset}
              style={{
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '10px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: '#16296b',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                borderRadius: '10px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#3D5170',
                backgroundColor: '#ffffff',
                border: '1px solid #E4E9F0',
              }}
            >
              Go to home page
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
