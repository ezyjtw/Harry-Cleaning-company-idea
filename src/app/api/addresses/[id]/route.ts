import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getSessionUser } from '@/lib/auth/session';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await context.params;

    const address = await prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== user.id) {
      return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
    }

    await prisma.address.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const address = await prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== user.id) {
      return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
    }

    if (body.isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id },
      data: { isDefault: body.isDefault ?? address.isDefault },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
