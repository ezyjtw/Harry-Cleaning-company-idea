# Pricing copy batch (James-ruled 2026-10-07, register D-ad item 5): gate evidence

Control: main 2c09138. Branch: claude/intelligent-bohr-1gztgv. Both built and served
on the same rig database (dummy env, no production data).

- hash-control-main-2c09138.json, hash-branch.json: `scripts/public-route-hashes.ts`.
  Six routes moved, exactly the named set: /about, /join, /pricing, /services,
  /services/end-of-tenancy, /services/airbnb. The other 20 are identical
  (/services/regular and /services/deep included).
- incognito-diff-rendered.txt: logged-out Chromium render (fresh context), visible text.
  /join's hero renders client side, so only a browser shows it.
- incognito-diff-meta.txt: logged-out server HTML, meta descriptions.

Checkout label (book/[id]): rendered on the rig with a synthetic cleaner (deep rate
25/hr, removed after). Choosing a service on /book/[id] routes to
/services/<service>?cleaner=<id>, whose summary already reads "Cleaning (4.5h)
£112.50" at the cleaner's own rate on main and on the branch alike. Nothing calls
setStep('details') in book/[id]/page.tsx, so the step that held the "× 1.45x"
summaries is unreachable: the label was never shown to a customer. The edit removes
the false text and the false multiplier fields; it changes no rendered output.
