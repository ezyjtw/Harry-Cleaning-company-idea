import type { EvidenceType } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

interface AddDisputeEvidenceInput {
  type: EvidenceType;
  url: string;
  fileName?: string;
  description?: string;
}

// ─── Service ────────────────────────────────────────────────

export class DisputeEvidenceService {
  static async addDisputeEvidence(
    disputeId: string,
    uploadedBy: string,
    input: AddDisputeEvidenceInput
  ) {
    return prisma.disputeEvidence.create({
      data: {
        disputeId,
        uploadedBy,
        type: input.type,
        url: input.url,
        fileName: input.fileName,
        description: input.description,
      },
    });
  }

  static async getDisputeEvidence(disputeId: string) {
    return prisma.disputeEvidence.findMany({
      where: { disputeId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  static async removeEvidence(evidenceId: string) {
    return prisma.disputeEvidence.delete({
      where: { id: evidenceId },
    });
  }
}
