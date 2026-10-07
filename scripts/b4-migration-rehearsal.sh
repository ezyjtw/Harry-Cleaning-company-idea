#!/usr/bin/env bash
# B4.10 step 4: the money ledger migration rehearsed on production-shaped data.
#
# For each run: a scratch database is migrated to the pre-B4 schema (every
# migration before 20261008090000), filled by a generator with the legacy
# shapes production holds (single and comma-joined transfer ids, allocation
# JSON with and without refund ids, legacy null-allocation records in every
# status, a refund id shared by two records, PARTIALLY_REFUNDED and
# REVERSAL_ONLY bookings, the two fee rows), then `prisma migrate deploy`
# applies the B4 migrations. The script asserts the counts and derived
# states, that no booking payment state moved, that the schema matches the
# datamodel, then re-runs the backfill section and asserts nothing changed
# (idempotence). Synthetic rows only; never pointed at production.
#
# Usage: scripts/b4-migration-rehearsal.sh [runs=2] [bookings=600]
# Needs a local Postgres the URL below can create databases on.
set -euo pipefail

RUNS="${1:-2}"
N="${2:-600}"
BASE_URL="${REHEARSAL_BASE_URL:-postgresql://rena:rena@127.0.0.1:5432}"
DB=rena_b4_rehearsal
URL="$BASE_URL/$DB"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/prisma/migrations/20261008091000_money_ledger/migration.sql"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

case "$BASE_URL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing: the rehearsal only runs against a local Postgres." >&2; exit 2 ;;
esac

q() { psql "$URL" -v ON_ERROR_STOP=1 -tAqc "$1"; }
fail() { echo "FAIL: $*" >&2; exit 1; }
eq() { [ "$1" = "$2" ] || fail "$3: expected $2, got $1"; echo "  ok  $3 = $1"; }

# The pre-B4 tree: the schema on main and every migration before B4.
mkdir -p "$WORK/pre/migrations"
git -C "$ROOT" show main:prisma/schema.prisma > "$WORK/pre/schema.prisma"
for d in "$ROOT"/prisma/migrations/*/; do
  name="$(basename "$d")"
  [[ "$name" < "20261008090000" ]] && cp -r "$d" "$WORK/pre/migrations/$name"
done
cp "$ROOT/prisma/migrations/migration_lock.toml" "$WORK/pre/migrations/"

# The backfill section alone, for the idempotence re-run.
sed -n '/^-- ─── Backfill/,$p' "$MIG" > "$WORK/backfill.sql"

snapshot() {
  q "SELECT md5(string_agg(t, '|' ORDER BY t)) FROM (
       SELECT 'ts:'||\"id\"||':'||coalesce(\"amountPence\"::text,'null')||':'||\"status\"||':'||\"kind\" AS t FROM \"TransferSlice\"
       UNION ALL SELECT 'rs:'||\"id\"||':'||\"status\"||':'||\"requestedPence\"||':'||\"executedPence\"||':'||coalesce(\"stripeRefundId\",'') FROM \"RefundSlice\"
       UNION ALL SELECT 'rr:'||\"id\"||':'||coalesce(\"requestedPence\"::text,'null')||':'||\"status\" FROM \"RefundRecord\"
       UNION ALL SELECT 'pc:'||\"key\" FROM \"PlatformConfig\") x"
}

for run in $(seq 1 "$RUNS"); do
  echo "── Run $run of $RUNS ($N bookings) ──"
  psql "$BASE_URL/postgres" -qc "DROP DATABASE IF EXISTS $DB" >/dev/null
  psql "$BASE_URL/postgres" -qc "CREATE DATABASE $DB" >/dev/null
  DATABASE_URL="$URL" npx prisma migrate deploy --schema "$WORK/pre/schema.prisma" >/dev/null
  echo "  pre-B4 schema migrated ($(ls "$WORK/pre/migrations" | grep -c _) migrations)"

  # ── Generator: production-shaped legacy money rows ──────────────────────
  psql "$URL" -v ON_ERROR_STOP=1 -q <<SQL
INSERT INTO "User" ("id","email","role","updatedAt") VALUES
  ('reh_cleaner','rehearsal-cleaner@integration.invalid','CLEANER',now()),
  ('reh_client','rehearsal-client@integration.invalid','CLIENT',now());
INSERT INTO "PlatformConfig" ("id","key","value","updatedAt") VALUES
  ('reh_pc1','cleaner_fee_pct','0.10',now()),('reh_pc2','customer_fee_pct','0.06',now()),
  ('reh_pc3','deep_multiplier','1.45',now())
ON CONFLICT ("key") DO NOTHING;
-- Bookings, by shape (i mod 10):
--  0 released, one transfer id          1 released, two ids comma-joined
--  2 released, three ids with spaces    3 pending, no transfer
--  4 refunded via allocation (2 entries, both ids)
--  5 allocation, one entry without a refund id
--  6 legacy null allocation, SUCCEEDED with id (PARTIALLY_REFUNDED)
--  7 legacy null allocation, FAILED with no id
--  8 legacy REVERSAL_ONLY with no id   9 legacy PENDING with no id
INSERT INTO "Booking" ("id","clientId","cleanerId","serviceType","date","startTime","duration",
  "totalPrice","totalAmountCharged","platformFee","cleanerEarnings","status","paymentStatus",
  "transferStatus","stripePaymentIntentId","stripeChargeId","stripeTransferId","updatedAt")
SELECT 'reh_b'||i, 'reh_client', 'reh_cleaner', 'regular', date '2026-06-01' + (i % 90), '10:00', 3,
  60, 60, 10, 50, 'COMPLETED',
  CASE WHEN i % 10 IN (4) THEN 'REFUNDED' WHEN i % 10 IN (5,6) THEN 'PARTIALLY_REFUNDED' ELSE 'SUCCEEDED' END::"PaymentStatus",
  CASE WHEN i % 10 IN (0,1,2) THEN 'RELEASED' WHEN i % 10 = 4 THEN 'REFUNDED' ELSE 'PENDING' END,
  'pi_reh_'||i, 'ch_reh_'||i,
  CASE i % 10 WHEN 0 THEN 'tr_reh_'||i||'_a'
              WHEN 1 THEN 'tr_reh_'||i||'_a,tr_reh_'||i||'_b'
              WHEN 2 THEN 'tr_reh_'||i||'_a, tr_reh_'||i||'_b ,tr_reh_'||i||'_c'
              ELSE NULL END,
  now()
FROM generate_series(1, $N) i;
-- Shape 4: allocation with two entries, both carrying refund ids.
INSERT INTO "RefundRecord" ("id","bookingId","amount","reason","status","stripeRefundId","allocation","updatedAt")
SELECT 'reh_r'||i, 'reh_b'||i, 60, 'legacy full', 'SUCCEEDED', 're_reh_'||i||'_t',
  jsonb_build_array(jsonb_build_object('pi','pi_reh_'||i||'_t','refundId','re_reh_'||i||'_t','amountPence',1000),
                    jsonb_build_object('pi','pi_reh_'||i,'refundId','re_reh_'||i||'_o','amountPence',5000)), now()
FROM generate_series(1, $N) i WHERE i % 10 = 4;
-- Shape 5: allocation with one entry lacking a refund id.
INSERT INTO "RefundRecord" ("id","bookingId","amount","reason","status","allocation","updatedAt")
SELECT 'reh_r'||i, 'reh_b'||i, 20, 'legacy partial', 'SUCCEEDED',
  jsonb_build_array(jsonb_build_object('pi','pi_reh_'||i,'amountPence',2000)), now()
FROM generate_series(1, $N) i WHERE i % 10 = 5;
-- Shapes 6 to 9: legacy null allocation.
INSERT INTO "RefundRecord" ("id","bookingId","amount","reason","status","stripeRefundId","updatedAt")
SELECT 'reh_r'||i, 'reh_b'||i,
  CASE i % 10 WHEN 6 THEN 25 ELSE 30 END, 'legacy',
  CASE i % 10 WHEN 6 THEN 'SUCCEEDED' WHEN 7 THEN 'FAILED' WHEN 8 THEN 'REVERSAL_ONLY' ELSE 'PENDING' END,
  CASE i % 10 WHEN 6 THEN 're_reh_'||i ELSE NULL END, now()
FROM generate_series(1, $N) i WHERE i % 10 IN (6,7,8,9);
-- One refund id shared by two records (the second record's allocation
-- repeats the first's id): the catch-all keeps it in the ledger.
INSERT INTO "RefundRecord" ("id","bookingId","amount","reason","status","allocation","updatedAt")
VALUES ('reh_r_dup','reh_b4',10,'legacy duplicate id','SUCCEEDED',
  jsonb_build_array(jsonb_build_object('pi','pi_reh_4','refundId','re_reh_4_o','amountPence',1000)), now());
SQL

  pre_pay="$(q "SELECT md5(string_agg(\"id\"||':'||\"paymentStatus\"||':'||\"transferStatus\", '|' ORDER BY \"id\")) FROM \"Booking\"")"
  ids_expected="$(q "SELECT count(*) FROM \"Booking\" b, unnest(string_to_array(b.\"stripeTransferId\", ',')) t WHERE btrim(t) <> ''")"
  records="$(q "SELECT count(*) FROM \"RefundRecord\"")"

  # ── The B4 migrations, as production will run them ───────────────────
  DATABASE_URL="$URL" npx prisma migrate deploy --schema "$ROOT/prisma/schema.prisma" > "$WORK/deploy.log"
  grep -q "20261008091000_money_ledger" "$WORK/deploy.log" || fail "B4 migration not applied"
  echo "  B4 migrations applied"
  diff_out="$(DATABASE_URL="$URL" npx prisma migrate diff --from-url "$URL" --to-schema-datamodel "$ROOT/prisma/schema.prisma" 2>&1)"
  echo "$diff_out" | grep -qE "empty migration|No difference detected" || fail "schema drift after deploy: $diff_out"
  echo "  ok  schema equals the datamodel (empty diff)"

  eq "$(q "SELECT count(*) FROM \"TransferSlice\"")" "$ids_expected" "transfer slices = legacy transfer ids"
  eq "$(q "SELECT count(*) FROM \"TransferSlice\" WHERE \"amountPence\" IS NULL AND \"status\"='NEEDS_RECONCILE' AND \"kind\"='ADOPTED'")" "$ids_expected" "every adopted slice NEEDS_RECONCILE with a null amount"
  eq "$(q "SELECT count(*) FROM \"TransferSlice\" WHERE \"stripeTransferId\" <> btrim(\"stripeTransferId\")")" "0" "transfer ids trimmed"
  eq "$(q "SELECT count(*) FROM \"RefundRecord\" r WHERE NOT EXISTS (SELECT 1 FROM \"RefundSlice\" s WHERE s.\"refundRecordId\"=r.\"id\")")" "0" "every legacy refund record has a slice"
  eq "$(q "SELECT count(*) FROM \"RefundSlice\" WHERE \"executedPence\" <> 0")" "0" "no legacy slice claims executed money"
  eq "$(q "SELECT count(*) FROM \"RefundSlice\" WHERE \"status\"='SUCCEEDED'")" "0" "no legacy slice is SUCCEEDED (never guessed)"
  eq "$(q "SELECT count(*) FROM \"RefundSlice\" WHERE \"stripeRefundId\" IS NOT NULL AND \"status\"<>'NEEDS_RECONCILE'")" "0" "slices with a refund id are NEEDS_RECONCILE"
  eq "$(q "SELECT count(*) FROM \"RefundSlice\" s JOIN \"RefundRecord\" r ON r.\"id\"=s.\"refundRecordId\" WHERE s.\"status\"='FAILED' AND (r.\"status\" NOT IN ('FAILED','REVERSAL_ONLY') OR s.\"stripeRefundId\" IS NOT NULL)")" "0" "FAILED only for definitive legacy failures with no id"
  eq "$(q "SELECT count(*) FROM \"RefundSlice\" WHERE \"refundRecordId\" IN ('reh_r4','reh_r_dup') AND \"stripeRefundId\" IS NULL AND \"status\"='NEEDS_RECONCILE' AND \"lastReconcileResult\" LIKE '%shared%'")" "1" "the shared-id record is kept, NEEDS_RECONCILE with no id"
  eq "$(q "SELECT count(*) FROM \"RefundRecord\" WHERE \"requestedPence\" IS NULL OR \"requestedPence\" <> round(\"amount\"*100)")" "0" "requestedPence = legacy amount"
  eq "$(q "SELECT count(*) FROM \"PlatformConfig\" WHERE \"key\" IN ('cleaner_fee_pct','customer_fee_pct')")" "0" "fee rows deleted"
  eq "$(q "SELECT count(*) FROM \"PlatformConfig\" WHERE \"key\"='deep_multiplier'")" "1" "other config untouched"
  eq "$(q "SELECT md5(string_agg(\"id\"||':'||\"paymentStatus\"||':'||\"transferStatus\", '|' ORDER BY \"id\")) FROM \"Booking\"")" "$pre_pay" "no booking payment or transfer state rewritten"
  eq "$(q "SELECT count(*) FROM \"RefundRecord\"")" "$records" "refund records unchanged in number"
  echo "  slices by status: $(q "SELECT string_agg(\"status\"||'='||c, ', ' ORDER BY \"status\") FROM (SELECT \"status\", count(*) c FROM \"RefundSlice\" GROUP BY 1) x")"

  # ── Idempotence: the backfill again changes nothing ───────────────────
  before="$(snapshot)"
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$WORK/backfill.sql" >/dev/null
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$WORK/backfill.sql" >/dev/null
  eq "$(snapshot)" "$before" "backfill re-run twice: ledger unchanged"
  # And migrate deploy again is a no-op.
  DATABASE_URL="$URL" npx prisma migrate deploy --schema "$ROOT/prisma/schema.prisma" | grep -q "No pending migrations" || fail "second deploy not a no-op"
  echo "  ok  second migrate deploy: no pending migrations"
done

psql "$BASE_URL/postgres" -qc "DROP DATABASE IF EXISTS $DB" >/dev/null
echo "REHEARSAL PASSED ($RUNS runs)"
