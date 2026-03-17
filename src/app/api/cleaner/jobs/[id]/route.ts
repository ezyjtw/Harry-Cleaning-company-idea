import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─── Types ──────────────────────────────────────────────

type JobStatus = 'PENDING' | 'ACCEPTED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface Job {
  id: string;
  status: JobStatus;
  customerName: string;
  customerEmail: string;
  address: string;
  postcode: string;
  date: string;
  time: string;
  duration: number;
  serviceType: string;
  totalPrice: number;
  notes: string;
  cleanerNotes?: string;
  distanceKm: number;
  estimatedTravelMins: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Valid status transitions ───────────────────────────

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

// ─── Distance calculation (Haversine) ───────────────────

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ─── Mock data ──────────────────────────────────────────

const CLEANER_LOCATION = { lat: 51.5074, lon: -0.1278 }; // Central London

const mockJobs: Record<string, Job> = {
  'job-001': {
    id: 'job-001',
    status: 'PENDING',
    customerName: 'Alice Johnson',
    customerEmail: 'alice@example.com',
    address: '15 Baker Street',
    postcode: 'NW1 6XE',
    date: '2026-03-20',
    time: '10:00',
    duration: 3,
    serviceType: 'DEEP_CLEAN',
    totalPrice: 120,
    notes: 'Two-bedroom flat, pet-friendly products preferred',
    distanceKm: calculateDistance(CLEANER_LOCATION.lat, CLEANER_LOCATION.lon, 51.5238, -0.1585),
    estimatedTravelMins: 15,
    createdAt: '2026-03-17T08:00:00Z',
    updatedAt: '2026-03-17T08:00:00Z',
  },
  'job-002': {
    id: 'job-002',
    status: 'ACCEPTED',
    customerName: 'Bob Smith',
    customerEmail: 'bob@example.com',
    address: '42 Oxford Street',
    postcode: 'W1D 1BN',
    date: '2026-03-18',
    time: '14:00',
    duration: 2,
    serviceType: 'REGULAR',
    totalPrice: 70,
    notes: 'Key under the mat',
    distanceKm: calculateDistance(CLEANER_LOCATION.lat, CLEANER_LOCATION.lon, 51.5154, -0.1415),
    estimatedTravelMins: 10,
    createdAt: '2026-03-16T12:00:00Z',
    updatedAt: '2026-03-16T14:00:00Z',
  },
  'job-003': {
    id: 'job-003',
    status: 'IN_PROGRESS',
    customerName: 'Carol Davis',
    customerEmail: 'carol@example.com',
    address: '8 Kensington Road',
    postcode: 'W8 5SE',
    date: '2026-03-17',
    time: '09:00',
    duration: 4,
    serviceType: 'END_OF_TENANCY',
    totalPrice: 200,
    notes: 'Three-bedroom house, oven clean included',
    cleanerNotes: 'Arrived on time, starting with kitchen',
    distanceKm: calculateDistance(CLEANER_LOCATION.lat, CLEANER_LOCATION.lon, 51.501, -0.1903),
    estimatedTravelMins: 20,
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-03-17T09:05:00Z',
  },
};

// ─── Route context ──────────────────────────────────────

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/cleaner/jobs/[id] ─────────────────────────

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const job = mockJobs[id];
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      job,
      distance: {
        km: job.distanceKm,
        estimatedTravelMins: job.estimatedTravelMins,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Jobs] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}

// ─── PATCH /api/cleaner/jobs/[id] ───────────────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const job = mockJobs[id];
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const { status, notes } = body;

    // Validate status is provided
    if (!status || typeof status !== 'string') {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    // Validate status value
    const validStatuses: JobStatus[] = ['ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];
    if (!validStatuses.includes(status as JobStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate status transition
    const allowedTransitions = VALID_TRANSITIONS[job.status];
    if (!allowedTransitions.includes(status as JobStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${job.status} to ${status}. Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none'}`,
        },
        { status: 400 }
      );
    }

    // Update the mock job
    const updatedJob: Job = {
      ...job,
      status: status as JobStatus,
      cleanerNotes: notes ?? job.cleanerNotes,
      updatedAt: new Date().toISOString(),
    };

    // Update in-memory store
    mockJobs[id] = updatedJob;

    return NextResponse.json({
      message: `Job status updated to ${status}`,
      job: updatedJob,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Jobs] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}
