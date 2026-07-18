import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// Excel-safe CSV quoting; leading =+-@ neutralised so a crafted email/postcode
// can't become a spreadsheet formula on James's machine.
function csvCell(value: string): string {
  let v = value;
  if (/^[=+\-@]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });
  }

  const entries = await prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' } });
  const lines = [
    'email,postcode,date,source',
    ...entries.map((e) =>
      [
        csvCell(e.email),
        csvCell(e.postcode),
        csvCell(e.createdAt.toISOString()),
        csvCell(e.source),
      ].join(',')
    ),
  ];

  return new NextResponse(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rena-waitlist-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
