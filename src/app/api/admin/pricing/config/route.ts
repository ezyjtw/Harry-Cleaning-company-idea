import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';

async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== 'ADMIN') {
    return null;
  }
  return user;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.platformConfig.findMany({ orderBy: { key: 'asc' } });
    return NextResponse.json(configs);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

const updateSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { key, value } = updateSchema.parse(body);

    const config = await prisma.platformConfig.update({
      where: { key },
      data: { value },
    });

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
