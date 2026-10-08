// RENA-100: the dashboards' one question: is there an unfinished application,
// and which step (1 based) has it reached? null when there is none to show.
export async function fetchUnfinishedApplicationStep(): Promise<number | null> {
  try {
    const res = await fetch('/api/cleaners/application', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    if (body.status === 'IN_PROGRESS')
      return Math.min(7, Math.max(1, Number(body.draft?.currentStep ?? 0) + 1));
    if (body.status === 'NONE') return 1;
    return null;
  } catch {
    return null;
  }
}
