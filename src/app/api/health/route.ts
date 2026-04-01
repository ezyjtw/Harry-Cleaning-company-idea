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

  return NextResponse.json(health, {
    status: health.status === 'ok' ? 200 : 503,
  });
}
