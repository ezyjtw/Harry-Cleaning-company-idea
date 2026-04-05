import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

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

  // Always return 200 so Railway's health check passes even if the
  // database is temporarily unreachable (e.g. during cold-start).
  // The response body still reports the actual status for monitoring.
  return NextResponse.json(health, { status: 200 });
}
