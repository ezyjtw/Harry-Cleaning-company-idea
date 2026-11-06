// B7b delta (James, 6 Nov; the second auditor's safety amendment): the
// retention arming gate. The six retention jobs are UNARMED by default: they
// run the exact eligibility and legal-hold queries, mutate nothing, and log
// per-class eligible and held counts only. The state is code-owned:
//   - one PlatformConfig row, RETENTION_MODE_KEY, created here if missing
//     with the value 'dry_run'; no seed touches it (seed-reference-data.ts
//     never names the key, checked by arming.test.ts);
//   - outside every editable config allowlist
//     (EDITABLE_PLATFORM_CONFIG_KEYS, checked by arming.test.ts), so no admin
//     screen or route can write it;
//   - armed only when the value is exactly ARMED, which no code path writes:
//     arming is James's separate explicit word after he has reviewed the
//     first production dry-run counts, recorded in the register, and applied
//     as a one-off statement he runs himself. A deploy, a seed or elapsed
//     time can never arm it; any other value, a missing row or a read error
//     reads as dry run.
import { prisma } from '@/lib/db/prisma';

export const RETENTION_MODE_KEY = 'retention_mode';
export const DRY_RUN = 'dry_run';
export const ARMED = 'armed';
export type RetentionMode = typeof DRY_RUN | typeof ARMED;

export async function getRetentionMode(): Promise<RetentionMode> {
  try {
    const row = await prisma.platformConfig.findUnique({ where: { key: RETENTION_MODE_KEY } });
    if (!row) {
      await prisma.platformConfig
        .create({
          data: {
            key: RETENTION_MODE_KEY,
            value: DRY_RUN,
            description:
              "Retention jobs: dry_run (count only, the default) or armed (mutate). Armed only on James's explicit word; never by code, seed or deploy.",
          },
        })
        .catch(() => undefined);
      return DRY_RUN;
    }
    return row.value === ARMED ? ARMED : DRY_RUN;
  } catch {
    return DRY_RUN;
  }
}
