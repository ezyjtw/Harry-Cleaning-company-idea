// RENA-054 (B2b, James-ruled amendment 4): one field error primitive.
// A field error is announced through its field: the input carries
// aria-invalid and aria-describedby pointing at this paragraph, so a screen
// reader reads it when the field takes focus. It is NOT role="alert" by
// default; alert is opt-in for submit, async and form-level failures.
// Every attribute exists only while an error exists, so error-free markup is
// byte-identical to before (the hash law's public routes).

export function fieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

/** Props for the described field: empty while there is no error. */
export function fieldErrorProps(
  fieldId: string,
  message: string | null | undefined
): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  return message ? { 'aria-invalid': true, 'aria-describedby': fieldErrorId(fieldId) } : {};
}

export default function FieldError({
  fieldId,
  message,
  alert = false,
  className = 'mt-2 font-jost text-sm text-danger',
}: {
  fieldId: string;
  message: string | null | undefined;
  /** Opt in only for a submit, async or form-level failure. */
  alert?: boolean;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p id={fieldErrorId(fieldId)} role={alert ? 'alert' : undefined} className={className}>
      {message}
    </p>
  );
}
