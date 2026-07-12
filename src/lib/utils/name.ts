// Name display normalisation (James-ruled): lowercase-entered names render
// properly cased everywhere. Rules — deliberately NOT over-engineered:
//   • each space-separated word: first letter capitalised, rest lowercased
//   • hyphenated segments each capitalise ("anne-marie" → "Anne-Marie")
//   • apostrophe segments each capitalise ("o'brien" → "O'Brien")
//   • Mc/Mac get no special inner casing beyond the first letter ("mcdonald"
//     → "Mcdonald") — per the ruling, don't guess deeper
//   • already-mixed-case input is normalised the same way (idempotent)
// Used at display in the shared render surfaces AND on save (wizard, signup,
// profile edits) so the data itself heals going forward.

export function displayName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((seg) =>
          seg
            .split("'")
            .map((part) =>
              part.length > 0 ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part
            )
            .join("'")
        )
        .join('-')
    )
    .join(' ');
}
