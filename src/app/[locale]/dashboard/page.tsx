import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/options';

// The customer dashboard content lives inside the account shell as the "Home"
// tab (/account). This route is kept as a role-aware redirect so every existing
// landing link — post-login/signup, booking confirmation, booking back-links,
// the navbar — keeps working. Customers land on /account; cleaners and admins
// are sent to their own dashboards.
//
// R4: this was a client component that rendered null while useSession resolved,
// then hopped — a blank white frame on every post-login landing and navbar
// "Dashboard" click. Now a server component issuing a real redirect(): no
// flash, one hop. It deliberately reads the JWT session (getServerSession),
// NOT the DB-checked getSessionUser — the middleware that routed the user here
// trusts the JWT too, and disagreeing with it is exactly what produced the
// /login ↔ /dashboard bounce loops (R3).
export default async function DashboardRedirect() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/account');
  }
  const role = session.user.role;
  if (role === 'CLEANER') redirect('/cleaner');
  if (role === 'ADMIN') redirect('/admin');
  redirect('/account');
}
