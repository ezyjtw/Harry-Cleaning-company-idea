import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { ComplianceSchedulerService } from '@/lib/services/compliance-scheduler.service';

/**
 * GET /api/admin/compliance — Get compliance dashboard data
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') || 'overview';

  try {
    if (section === 'dpa') {
      const agreements = await prisma.dpaAgreement.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ agreements });
    }

    if (section === 'breaches') {
      const breaches = await prisma.breachIncident.findMany({
        orderBy: { detectedAt: 'desc' },
      });
      return NextResponse.json({ breaches });
    }

    if (section === 'ico') {
      const registration = await prisma.icoRegistration.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ registration });
    }

    // Overview: aggregate compliance metrics
    const [pendingVerifications, expiringRtw, activeDpas, pendingDeletions, openBreaches, icoReg] =
      await Promise.all([
        prisma.documentUpload.count({
          where: { isVerified: false, isDestroyed: false },
        }),
        prisma.cleanerProfile.count({
          where: {
            rightToWorkStatus: 'VERIFIED',
            rightToWorkExpiresAt: {
              not: null,
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.dpaAgreement.count({ where: { status: 'ACTIVE' } }),
        prisma.dataDeletionRequest.count({ where: { status: 'PENDING' } }),
        prisma.breachIncident.count({
          where: { status: { not: 'RESOLVED' } },
        }),
        prisma.icoRegistration.findFirst({ orderBy: { createdAt: 'desc' } }),
      ]);

    return NextResponse.json({
      overview: {
        pendingVerifications,
        expiringRtw,
        activeDpas,
        pendingDeletions,
        openBreaches,
        icoRegistered: !!icoReg?.registrationNumber,
        icoStatus: icoReg?.status || 'NOT_REGISTERED',
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminCompliance] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch compliance data' }, { status: 500 });
  }
}

/**
 * POST /api/admin/compliance — Run compliance jobs or create records
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action } = body;
    // Use the verified admin ID, not the untrusted body adminId
    const adminId = admin.id;

    if (action === 'run_all_jobs') {
      const results = await ComplianceSchedulerService.runAllJobs();
      return NextResponse.json({ message: 'Compliance jobs completed', results });
    }

    if (action === 'create_dpa') {
      const dpa = await prisma.dpaAgreement.create({
        data: {
          processorName: body.processorName,
          processorType: body.processorType,
          dataCategories: body.dataCategories || [],
          legalBasis: body.legalBasis || 'contract',
          agreementDate: body.agreementDate ? new Date(body.agreementDate) : null,
          expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
          documentRef: body.documentRef,
          contactEmail: body.contactEmail,
          status: body.status || 'PENDING',
          reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
          notes: body.notes,
        },
      });

      await AuditService.log({
        userId: adminId,
        action: 'DPA_AGREEMENT_CREATED',
        entityType: 'DpaAgreement',
        entityId: dpa.id,
        metadata: { processorName: body.processorName },
      });

      return NextResponse.json({ message: 'DPA agreement created', dpa }, { status: 201 });
    }

    if (action === 'update_dpa') {
      const dpa = await prisma.dpaAgreement.update({
        where: { id: body.dpaId },
        data: {
          status: body.status,
          reviewDate: body.reviewDate ? new Date(body.reviewDate) : undefined,
          notes: body.notes,
          agreementDate: body.agreementDate ? new Date(body.agreementDate) : undefined,
          expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
          documentRef: body.documentRef,
        },
      });

      await AuditService.log({
        userId: adminId,
        action: 'DPA_AGREEMENT_UPDATED',
        entityType: 'DpaAgreement',
        entityId: dpa.id,
        metadata: { status: body.status },
      });

      return NextResponse.json({ message: 'DPA agreement updated', dpa });
    }

    if (action === 'report_breach') {
      const breach = await prisma.breachIncident.create({
        data: {
          title: body.title,
          description: body.description,
          severity: body.severity || 'MEDIUM',
          dataTypesAffected: body.dataTypesAffected || [],
          individualsAffected: body.individualsAffected || 0,
          detectedAt: body.detectedAt ? new Date(body.detectedAt) : new Date(),
          reportedBy: adminId,
          isNotifiable: body.isNotifiable || false,
        },
      });

      await AuditService.log({
        userId: adminId,
        action: 'DATA_BREACH_DETECTED',
        entityType: 'BreachIncident',
        entityId: breach.id,
        metadata: {
          severity: body.severity,
          title: body.title,
          isNotifiable: body.isNotifiable,
        },
      });

      return NextResponse.json({ message: 'Breach incident recorded', breach }, { status: 201 });
    }

    if (action === 'update_breach') {
      const updates: Record<string, unknown> = {};
      if (body.status) updates.status = body.status;
      if (body.containedAt) updates.containedAt = new Date(body.containedAt);
      if (body.resolvedAt) updates.resolvedAt = new Date(body.resolvedAt);
      if (body.reportedToIcoAt) updates.reportedToIcoAt = new Date(body.reportedToIcoAt);
      if (body.icoNotificationRef) updates.icoNotificationRef = body.icoNotificationRef;
      if (body.rootCause) updates.rootCause = body.rootCause;
      if (body.remedialActions) updates.remedialActions = body.remedialActions;
      if (body.lessonsLearned) updates.lessonsLearned = body.lessonsLearned;

      const breach = await prisma.breachIncident.update({
        where: { id: body.breachId },
        data: updates,
      });

      const auditAction =
        body.status === 'REPORTED_TO_ICO'
          ? 'DATA_BREACH_REPORTED_ICO'
          : body.status === 'RESOLVED'
            ? 'DATA_BREACH_RESOLVED'
            : 'ADMIN_ACTION';

      await AuditService.log({
        userId: adminId,
        action: auditAction,
        entityType: 'BreachIncident',
        entityId: breach.id,
        metadata: { status: body.status },
      });

      return NextResponse.json({ message: 'Breach incident updated', breach });
    }

    if (action === 'update_ico') {
      const ico = await prisma.icoRegistration.upsert({
        where: { id: body.icoId || 'new' },
        create: {
          registrationNumber: body.registrationNumber,
          registeredName: body.registeredName || 'Rena Cleaning Network',
          registrationDate: body.registrationDate ? new Date(body.registrationDate) : null,
          renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
          feeAmount: body.feeAmount,
          status: body.status || 'PENDING',
          dpoName: body.dpoName,
          dpoEmail: body.dpoEmail,
          dpoPhone: body.dpoPhone,
          notes: body.notes,
        },
        update: {
          registrationNumber: body.registrationNumber,
          registeredName: body.registeredName,
          registrationDate: body.registrationDate ? new Date(body.registrationDate) : undefined,
          renewalDate: body.renewalDate ? new Date(body.renewalDate) : undefined,
          feeAmount: body.feeAmount,
          status: body.status,
          dpoName: body.dpoName,
          dpoEmail: body.dpoEmail,
          dpoPhone: body.dpoPhone,
          notes: body.notes,
        },
      });

      await AuditService.log({
        userId: adminId,
        action: 'ADMIN_ACTION',
        entityType: 'IcoRegistration',
        entityId: ico.id,
        metadata: { action: 'ICO_REGISTRATION_UPDATED', status: body.status },
      });

      return NextResponse.json({ message: 'ICO registration updated', ico });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminCompliance] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process compliance action' },
      { status: 500 }
    );
  }
}
