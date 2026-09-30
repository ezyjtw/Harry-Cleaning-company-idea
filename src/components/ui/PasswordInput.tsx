'use client';

import { useState } from 'react';

// R12 Lane 1 (James-ruled): every public password field carries the show/hide
// eye. One shared control so the grammar is identical on the join wizard,
// login, signup and reset pages (and, by inheritance, both apps' in-shell
// renders of those pages). Margin classes belong on wrapperClassName so the
// eye centres on the input itself.
export default function PasswordInput({
  wrapperClassName,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <input {...props} type={show ? 'text' : 'password'} className={`${className ?? ''} pr-11`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        data-testid="password-toggle"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 transition-colors hover:text-ink-2"
      >
        {show ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
