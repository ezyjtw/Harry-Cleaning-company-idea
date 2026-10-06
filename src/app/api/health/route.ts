import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

// RENA-061 (remediation register, B0): the probe answers 503 when the database
// is unreachable. Railway's healthcheck is a deploy-cutover probe only (traffic
// switches once the path returns 200 within healthcheckTimeout; nothing polls
// afterwards), so a 503 can never restart-loop a running service, and a deploy
// whose database is unreachable at cutover is correctly refused. The start
// command runs `prisma migrate deploy` before `next start`, so the database is
// reachable by the time the probe runs. An external uptime monitor polls this
// path and alerts on non-200 (James-side step in the register).
//
// force-dynamic is load-bearing: a GET route handler that touches no request
// data is otherwise prerendered into Next's static route cache, and the rig
// proved it (the probe kept answering a cached 200 with a frozen timestamp
// while Postgres was stopped). Every call must run SELECT 1.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const health: {
    status: string;
    timestamp: string;
    version: string;
    database: string;
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    database: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
  } catch {
    health.status = 'degraded';
    health.database = 'disconnected';
  }

  const status = health.database === 'connected' ? 200 : 503;
  return NextResponse.json(health, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
