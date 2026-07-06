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

    // Validate `type` against the enum.
    const ALLOWED_TYPES = ['PHOTO', 'VIDEO', 'TEXT', 'DOCUMENT'];
    if (!ALLOWED_TYPES.includes(body.type)) {
      return NextResponse.json({ error: 'Invalid evidence type.' }, { status: 400 });
    }

    // Validate `url`: bounded length, well-formed, http(s) only (reject
    // javascript:/data:/file: and other schemes that could be stored and later
    // rendered as a link).
    if (typeof body.url !== 'string' || body.url.length > 2048) {
      return NextResponse.json({ error: 'Invalid evidence URL.' }, { status: 400 });
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'Evidence URL is malformed.' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return NextResponse.json({ error: 'Evidence URL must be http(s).' }, { status: 400 });
    }

    if (typeof body.fileName === 'string' && body.fileName.length > 255) {
      return NextResponse.json({ error: 'fileName is too long.' }, { status: 400 });
    }
    if (typeof body.description === 'string' && body.description.length > 2000) {
      return NextResponse.json({ error: 'description is too long.' }, { status: 400 });
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
