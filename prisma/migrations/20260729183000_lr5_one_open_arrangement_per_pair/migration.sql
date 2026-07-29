-- LR-5 (James-ruled): one open arrangement per customer+cleaner pair is now a
-- DB INVARIANT, not just an application check — the proposal endpoint's
-- read-then-create guard provably loses a two-simultaneous-POST race (driven
-- 5/5 before this fix). Partial unique indexes cover both identity shapes;
-- the endpoint catches the violation and returns the same honest 409.
-- Raw SQL (partial/expression indexes are not expressible in schema.prisma).

CREATE UNIQUE INDEX "RecurringAgreement_open_client_pair_key"
  ON "RecurringAgreement" ("clientId", "cleanerId")
  WHERE "status" IN ('PENDING_CLEANER_ACCEPTANCE', 'ACTIVE') AND "clientId" IS NOT NULL;

CREATE UNIQUE INDEX "RecurringAgreement_open_guest_pair_key"
  ON "RecurringAgreement" (lower("guestEmail"), "cleanerId")
  WHERE "status" IN ('PENDING_CLEANER_ACCEPTANCE', 'ACTIVE') AND "guestEmail" IS NOT NULL;
