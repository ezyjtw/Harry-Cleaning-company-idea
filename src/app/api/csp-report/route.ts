import { NextResponse } from 'next/server';

import { parseCspReports } from '@/lib/http/csp-report';
import { log } from '@/lib/log';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// RENA-005 (B6.1): CSP violation reports. Always 204; rate limited to 60 a
// minute per IP; logged through log.ts with the document path, the directive
// and the blocked host only (src/lib/http/csp-report.ts).
const NO_CONTENT = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  const limit = checkRateLimit(`csp-report:${getClientIp(request)}`, 60, 60 * 1000);
  if (!limit.allowed) return NO_CONTENT();
  let body: unknown = null;
  try {
    body = JSON.parse((await request.text()).slice(0, 64 * 1024));
  } catch {
    return NO_CONTENT();
  }
  const contentType = request.headers.get('content-type') ?? '';
  for (const v of parseCspReports(contentType, body).slice(0, 20))
    log.warn('csp', 'violation', {
      route: v.documentPath,
      directive: v.directive,
      blockedHost: v.blockedHost,
    });
  return NO_CONTENT();
}
