# Pricing copy batch (James-ruled 2026-10-07, register D-ad item 5): gate evidence

Control: main 2c09138. Branch: claude/intelligent-bohr-1gztgv. Both built and served
on the same rig database (dummy env, no production data).

- hash-control-main-2c09138.json, hash-branch.json: `scripts/public-route-hashes.ts`.
  Five routes moved, exactly the named set: /about, /pricing, /services,
  /services/end-of-tenancy, /services/airbnb. The other 21 are identical
  (/join, /services/regular and /services/deep included).
- incognito-diff-rendered.txt: logged-out Chromium render (fresh context), visible text.
  /join's hero renders client side, so only a browser shows it; it renders identical to main.
- incognito-diff-meta.txt: logged-out server HTML, meta descriptions.

Checkout label (book/[id]): rendered on the rig with a synthetic cleaner (deep rate
25/hr, removed after). Choosing a service on /book/[id] routes to
/services/<service>?cleaner=<id>, whose summary already reads "Cleaning (4.5h)
£112.50" at the cleaner's own rate on main and on the branch alike. Nothing calls
setStep('details') in book/[id]/page.tsx, so the step that held the "× 1.45x"
summaries is unreachable: the label was never shown to a customer. The edit removes
the false text and the false multiplier fields; it changes no rendered output.

Chat assistant delta (James-ruled 2026-10-08, same batch): the End of Tenancy and Airbnb lines of the assistant instruction in src/app/api/chat/route.ts now read "each cleaner sets their own price by property size". Not page copy: a rebuild of this head hashes all 26 public routes identical to hash-branch.json, and the set against main is still the same six.

Amended ruling (James, 2026-10-08): the /join copy (hero and meta) was reverted to main's wording; join/page.tsx and src/lib/seo/metadata.ts are byte-identical to main 2c09138. Re-baselined: hash-branch.json and both incognito diffs regenerated from that build; against main the changed set is five routes, /join dropped, and the rendered /join is identical to main's.
