'use client';

import { PASSWORD_RULES } from '@/lib/utils/password-policy';

export default function PasswordRequirements({ password }: { password: string }) {
  if (!password) return null;

  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li key={rule.label} className="flex items-center gap-1.5">
            {passed ? (
              <svg className="h-3.5 w-3.5 text-teal" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-ink-3/40" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="10" r="3" />
              </svg>
            )}
            <span
              className={`font-jost text-[11px] ${passed ? 'text-teal' : 'text-ink-3/60'}`}
            >
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
