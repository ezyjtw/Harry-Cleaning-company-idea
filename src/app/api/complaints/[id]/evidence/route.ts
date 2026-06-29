import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // SECURITY: only the complaint's filer (or an admin) may attach evidence.
    const requester = await getSessionUser();
    if (!requester) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const required = ['type', 'url'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    if (complaint.filedById !== requester.id && requester.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const evidence = await prisma.complaintEvidence.create({
      data: {
        complaintId: id,
        type: body.type,
        url: body.url,
        fileName: body.fileName || null,
        description: body.description || null,
      },
    });

    return NextResponse.json({ message: 'Evidence added', evidence }, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error adding evidence:', error);
    return NextResponse.json({ error: 'Failed to add evidence' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // SECURITY: only the complaint's filer (or an admin) may read its evidence.
    const requester = await getSessionUser();
    if (!requester) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await context.params;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    if (complaint.filedById !== requester.id && requester.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const evidence = await prisma.complaintEvidence.findMany({
      where: { complaintId: id },
      orderBy: { uploadedAt: 'asc' },
    });

    return NextResponse.json({ evidence });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching evidence:', error);
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}
