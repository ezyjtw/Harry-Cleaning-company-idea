'use client';

import type { ChangeEvent, ReactNode } from 'react';

/** Surface card with a Newsreader title row + optional right-hand action slot. */
export function AccountSection({
  title,
  action,
  tone = 'default',
  children,
}: {
  title: string;
  action?: ReactNode;
  tone?: 'default' | 'danger';
  children?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border bg-surface p-6 ${tone === 'danger' ? 'border-danger/30' : 'border-line'}`}
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          className={`font-newsreader text-xl font-semibold ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label + 10px hairline input. Disabled = page-tinted + muted note. `after`
 *  renders below the input (e.g. PasswordRequirements). Logic stays in the caller. */
export function Field({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required,
  disabled,
  minLength,
  placeholder,
  note,
  inputClassName,
  after,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  minLength?: number;
  placeholder?: string;
  note?: string;
  inputClassName?: string;
  after?: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-jost text-sm font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        disabled={disabled}
        minLength={minLength}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`mt-1 w-full rounded-[10px] border border-line px-3 py-2 text-sm text-ink transition-colors placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          disabled ? 'bg-page text-ink-3' : 'bg-surface'
        } ${inputClassName ?? ''}`}
      />
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
      {after}
    </div>
  );
}

/** Navy-on / line-off switch. The caller owns the state + optimistic logic. */
export function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-line'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
