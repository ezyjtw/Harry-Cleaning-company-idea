'use client';

import { useCallback, useEffect, useState } from 'react';

interface XeroStatus {
  configured: boolean;
  connected: boolean;
  tenantName: string | null;
  expiresAt: string | null;
}

interface XeroAccount {
  code: string;
  name: string;
  type: string;
  taxType: string;
  status: string;
}

export default function AdminXeroPage() {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [accounts, setAccounts] = useState<XeroAccount[] | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/admin/xero/status');
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    loadStatus();
    // Surface the OAuth callback result (?connected=1 / ?error=...).
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) setMsg('Connected to Xero successfully.');
    else if (params.get('error')) setMsg(`Xero connect failed: ${params.get('error')}`);
  }, [loadStatus]);

  async function readAccounts() {
    setLoadingAccounts(true);
    setAccounts(null);
    try {
      const res = await fetch('/api/admin/xero/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error || 'Could not read the chart of accounts.');
      }
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function disconnect() {
    await fetch('/api/admin/xero/disconnect', { method: 'POST' });
    setAccounts(null);
    await loadStatus();
    setMsg('Disconnected from Xero.');
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Xero (Accounting)</h1>
      <p className="mt-1 text-sm text-gray-500">
        Connect Rena to your Xero organisation. This chunk only connects and reads your chart of
        accounts — no transactions are pushed to Xero yet.
      </p>

      {msg && (
        <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
          {msg}
        </div>
      )}

      {!status ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : !status.configured ? (
        <div className="mt-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Xero is not configured on the server (missing XERO_CLIENT_ID / XERO_CLIENT_SECRET /
          XERO_REDIRECT_URI). The integration is dormant until these are set.
        </div>
      ) : (
        <div className="mt-6 rounded border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {status.connected
                  ? `Connected: ${status.tenantName || 'Xero org'}`
                  : 'Not connected'}
              </p>
              {status.connected && status.expiresAt && (
                <p className="mt-0.5 text-xs text-gray-500">
                  Access token valid until {new Date(status.expiresAt).toLocaleString('en-GB')}{' '}
                  (auto-refreshes).
                </p>
              )}
            </div>
            {status.connected ? (
              <button
                onClick={disconnect}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Disconnect
              </button>
            ) : (
              <a
                href="/api/admin/xero/connect"
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Connect Xero
              </a>
            )}
          </div>

          {status.connected && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <button
                onClick={readAccounts}
                disabled={loadingAccounts}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingAccounts ? 'Reading…' : 'Read chart of accounts'}
              </button>

              {accounts && (
                <div className="mt-4 max-h-96 overflow-auto rounded border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Tax</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a, i) => (
                        <tr key={`${a.code}-${i}`} className="border-t border-gray-100">
                          <td className="px-3 py-1.5 font-mono text-xs">{a.code}</td>
                          <td className="px-3 py-1.5">{a.name}</td>
                          <td className="px-3 py-1.5 text-gray-600">{a.type}</td>
                          <td className="px-3 py-1.5 text-gray-600">{a.taxType}</td>
                          <td className="px-3 py-1.5 text-gray-600">{a.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {accounts && accounts.length === 0 && (
                <p className="mt-3 text-sm text-gray-500">No accounts returned.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
