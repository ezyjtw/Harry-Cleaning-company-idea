# Hardening programme design record

The approved design reports for batches B2 to B9, committed verbatim as delivered
on 2026-10-06 and 2026-10-07, each followed by James's "Rulings and amendments"
for that batch (2026-10-07). Where a design report and its rulings differ, the
rulings win. The register (`docs/REMEDIATION_REGISTER.md`) stays the
authoritative list of entries and statuses; these files are the executable
specifications the builds follow.

## Order (James-ruled, 2026-10-07)

B2 (B2a then B2b) → B3 → B4 → B5 → B6 → B7 → B8 → pre-closure code lane → N15
(Next 15 and React 19) → B9.

Builds run sequentially, one batch at a time, and stop at every gate for
James's word before any merge, deploy, OTA publish, migration or store
submission.

## Standing laws throughout

The register's 20 rules, CLAUDE.md, the hash law on the governed public route
set, the injected-script law, the shell freeze (an OTA is its own worded
piece), word before merge, no production reads or mutations from the session,
no secret in Git, every new log line through `src/lib/log.ts`.

## Gate protocol, every batch

Checklist, results tables, deviations for ruling, parked list, UAT list, hash
sweep on the governed set, incognito diff, and a plain list of anything that
departed from the design (departures need James's word). Design reports and
gate reports stay in the full form established in B1 to B4.

## Files

- [B2.md](B2.md) service worker and customer recovery
- [B3.md](B3.md) cleaner lifecycle and concurrency
- [B4.md](B4.md) money ledger
- [B5.md](B5.md) native shell OTA lane
- [B6.md](B6.md) web platform (including the N15 scoping, B6.9)
- [B7.md](B7.md) scheduler, operations and GDPR
- [B8.md](B8.md) native rebuild bundle
- [B9.md](B9.md) full regression and register closure
- [lanes.md](lanes.md) the pre-closure code lane and the N15 lane (rulings only;
  N15's scope is B6.9)
