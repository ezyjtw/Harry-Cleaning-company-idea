"use client";

import { useState } from "react";

type Period = "week" | "month" | "year" | "custom";

interface Payout {
  id: string;
  date: string;
  amount: number;
  status: "completed" | "pending" | "processing";
  reference: string;
}

interface ServiceBreakdown {
  type: string;
  count: number;
  amount: number;
}

const mockPayouts: Payout[] = [
  { id: "P-001", date: "2026-03-13", amount: 245.00, status: "completed", reference: "PAY-2026031301" },
  { id: "P-002", date: "2026-03-10", amount: 180.50, status: "completed", reference: "PAY-2026031001" },
  { id: "P-003", date: "2026-03-07", amount: 320.00, status: "completed", reference: "PAY-2026030701" },
  { id: "P-004", date: "2026-03-03", amount: 195.00, status: "completed", reference: "PAY-2026030301" },
  { id: "P-005", date: "2026-02-28", amount: 410.00, status: "completed", reference: "PAY-2026022801" },
  { id: "P-006", date: "2026-03-14", amount: 165.00, status: "processing", reference: "PAY-2026031401" },
];

const mockBreakdown: ServiceBreakdown[] = [
  { type: "Regular Clean", count: 12, amount: 720 },
  { type: "Deep Clean", count: 4, amount: 480 },
  { type: "End of Tenancy", count: 2, amount: 360 },
  { type: "AirBnB Turnover", count: 3, amount: 270 },
];

const periodLabels: Record<Period, string> = {
  week: "This Week",
  month: "This Month",
  year: "This Year",
  custom: "Custom",
};

export default function EarningsPage() {
  const [period, setPeriod] = useState<Period>("month");

  const totalEarnings = 1830;
  const platformFees = 183;
  const netEarnings = totalEarnings - platformFees;

  const getStatusBadge = (status: Payout["status"]) => {
    const styles = {
      completed: "bg-green-100 text-green-700",
      pending: "bg-yellow-100 text-yellow-700",
      processing: "bg-blue-100 text-blue-700",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
          <p className="text-gray-500 mt-1">Track your income and payouts</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Earnings</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">£{totalEarnings.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">Before platform fees</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Platform Fees (10%)</p>
          <p className="text-3xl font-bold text-red-600 mt-1">-£{platformFees.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">Commission deducted</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-5">
          <p className="text-sm font-medium text-green-700">Net Earnings</p>
          <p className="text-3xl font-bold text-green-700 mt-1">£{netEarnings.toFixed(2)}</p>
          <p className="text-xs text-green-600 mt-1">Amount paid to you</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payout history */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Payout History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mockPayouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{payout.date}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">£{payout.amount.toFixed(2)}</td>
                    <td className="px-6 py-4">{getStatusBadge(payout.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{payout.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Service breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">By Service Type</h2>
          </div>
          <div className="p-6 space-y-4">
            {mockBreakdown.map((item) => {
              const percentage = (item.amount / totalEarnings) * 100;
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.type}</span>
                    <span className="text-sm text-gray-500">£{item.amount}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{item.count} bookings</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
