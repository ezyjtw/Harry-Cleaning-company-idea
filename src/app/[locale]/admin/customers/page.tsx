import { prisma } from '@/lib/db/prisma';

import AdminCustomersClient from './AdminCustomersClient';

export const dynamic = 'force-dynamic';

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  bookingsCount: number;
  totalSpent: number;
  status: 'active' | 'suspended' | 'inactive';
}

async function getCustomers(): Promise<{ customers: CustomerRow[]; total: number }> {
  const users = await prisma.user.findMany({
    where: { role: 'CLIENT', isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      accountStatus: true,
      isSuspended: true,
      _count: { select: { bookingsAsClient: true } },
      bookingsAsClient: {
        where: { payment: { status: 'SUCCEEDED' } },
        select: { totalPrice: true },
      },
    },
  });

  const customers: CustomerRow[] = users.map((u) => {
    let status: CustomerRow['status'] = 'active';
    if (u.isSuspended || u.accountStatus === 'SUSPENDED') status = 'suspended';
    else if (u.accountStatus === 'DEACTIVATED') status = 'inactive';

    const totalSpent = u.bookingsAsClient.reduce((sum, b) => sum + Number(b.totalPrice), 0);

    return {
      id: u.id.substring(0, 8).toUpperCase(),
      name: u.name || 'Unknown',
      email: u.email,
      joinDate: u.createdAt.toISOString().split('T')[0],
      bookingsCount: u._count.bookingsAsClient,
      totalSpent: Math.round(totalSpent * 100) / 100,
      status,
    };
  });

  return { customers, total: customers.length };
}

export default async function AdminCustomersPage() {
  const { customers, total } = await getCustomers();
  return <AdminCustomersClient customers={customers} total={total} />;
}
