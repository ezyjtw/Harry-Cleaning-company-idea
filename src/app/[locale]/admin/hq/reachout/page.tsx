import { RoomShell } from '../HqKit';

import ReachoutBoard from './ReachoutBoard';

export const dynamic = 'force-dynamic';

// R9 HQ — Reachout room: the cleaner-recruitment pipeline board. Prospects by
// status (found / contacted / replied / stalled / joined), add/edit, notes
// history per prospect, next-action dates with overdue highlighting. Seeded
// once by the Decision-2 migration (§7 pair as contacted, other incomplete
// signups as found); everything after is hand-run from this board.
export default function ReachoutRoom() {
  return (
    <RoomShell
      title="Reachout"
      subtitle="The recruitment pipeline. Overdue next-actions glow red; a prospect with an account links to her dossier."
    >
      <ReachoutBoard />
    </RoomShell>
  );
}
