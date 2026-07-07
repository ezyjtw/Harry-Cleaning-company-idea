'use client';

import { useCallback, useEffect, useState } from 'react';

interface XeroStatus {
  configured: boolean;
  connected: boolean;
  tenantName: string | null;
  expiresAt: string | null;
}

interface XeroAccount {
  accountID: string;
  code: string;
  name: string;
  type: string;
  taxType: string;
  status: string;
}

interface XeroMapping {
  bankAccountCode: string | null;
  commissionAccountCode: string | null;
  feeAccountCode: string | null;
  clearingAccountCode: string | null;
  stripeFeeAccountCode: string | null;
  settlementBankAccountCode: string | null;
  pushEnabled: boolean;
}

// `idKey` = which identifier the dropdown option carries (and gets stored):
//   BANK accounts have no `code`, so the bank slot uses `accountID`;
//   income/clearing (line-item) accounts use `code`.
// `only` filters the account list for that slot.
interface Role {
  key: keyof XeroMapping;
  label: string;
  hint: string;
  required: boolean;
  idKey: 'accountID' | 'code';
  only: (a: XeroAccount) => boolean;
}

const ROLES: Role[] = [
  {
    key: 'commissionAccountCode',
    label: 'Commission income',
    hint: "Rena's commission → income",
    required: true,
    idKey: 'code',
    only: (a) => !!a.code,
  },
  {
    key: 'feeAccountCode',
    label: 'Platform fee income',
    hint: 'The 6% service fee → income',
    required: true,
    idKey: 'code',
    only: (a) => !!a.code,
  },
  {
    key: 'clearingAccountCode',
    label: 'Cleaner clearing',
    hint: "Cleaner's net held on their behalf",
    required: true,
    idKey: 'code',
    only: (a) => !!a.code,
  },
  {
    key: 'stripeFeeAccountCode',
    label: 'Stripe fees',
    hint: "Stripe's processing fee → expense",
    required: true,
    idKey: 'code',
    only: (a) => !!a.code,
  },
  {
    key: 'bankAccountCode',
    label: 'Stripe balance account',
    hint: 'The bank account mirroring your Stripe balance — payments land here',
    required: true,
    idKey: 'accountID',
    only: (a) => a.type === 'BANK',
  },
  {
    key: 'settlementBankAccountCode',
    label: 'Settlement bank account',
    hint: 'Your real bank — where Stripe pays out (payouts transfer here)',
    required: true,
    idKey: 'accountID',
    only: (a) => a.type === 'BANK',
  },
];

const emptyMapping: XeroMapping = {
  bankAccountCode: null,
  commissionAccountCode: null,
  feeAccountCode: null,
  clearingAccountCode: null,
  stripeFeeAccountCode: null,
  settlementBankAccountCode: null,
  pushEnabled: false,
};

export default function AdminXeroPage() {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [mapping, setMapping] = useState<XeroMapping>(emptyMapping);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/admin/xero/status');
    if (res.ok) setStatus(await res.json());
  }, []);

  const loadConnectedData = useCallback(async () => {
    const [aRes, mRes] = await Promise.all([
      fetch('/api/admin/xero/accounts'),
      fetch('/api/admin/xero/mapping'),
    ]);
    if (aRes.ok) setAccounts((await aRes.json()).accounts || []);
    if (mRes.ok) setMapping((await mRes.json()).mapping || emptyMapping);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/xero/status');
      if (res.ok) {
        const s: XeroStatus = await res.json();
        setStatus(s);
        if (s.connected) await loadConnectedData();
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get('connected')) setMsg('Connected to Xero successfully.');
      else if (params.get('error')) setMsg(`Xero connect failed: ${params.get('error')}`);
    })();
  }, [loadConnectedData]);

  // Only the REQUIRED roles gate saving/enabling; the bank account is optional here.
  const complete = ROLES.filter((r) => r.required).every((r) => !!mapping[r.key]);

  async function saveMapping(patch: Partial<XeroMapping>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/xero/mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMapping(data.mapping);
        setMsg('Saved.');
      } else {
        setMsg(data.error || 'Could not save.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await fetch('/api/admin/xero/disconnect', { method: 'POST' });
    setAccounts([]);
    setMapping(emptyMapping);
    await loadStatus();
    setMsg('Disconnected from Xero.');
  }

  // BANK accounts have no code, so lead with the name and only prefix a code when present.
  const accountLabel = (a: XeroAccount) =>
    `${a.code ? `${a.code} — ` : ''}${a.name}${a.type ? ` (${a.type})` : ''}`;

  async function reloadAccounts() {
    setBusy(true);
    setMsg(null);
    try {
      await loadConnectedData();
      setMsg('Accounts reloaded from Xero.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-ink">Xero (Accounting)</h1>
      <p className="mt-1 text-sm text-ink-3">
        Connect Rena to your Xero organisation and map each money flow to your own accounts. Nothing
        is pushed to Xero until the mapping is complete and pushing is switched on.
      </p>

      {msg && (
        <div className="mt-4 rounded border border-line bg-page px-4 py-2 text-sm text-ink-2">
          {msg}
        </div>
      )}

      {!status ? (
        <p className="mt-6 text-sm text-ink-3">Loading…</p>
      ) : !status.configured ? (
        <div className="mt-6 rounded border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          Xero is not configured on the server (missing XERO_CLIENT_ID / XERO_CLIENT_SECRET /
          XERO_REDIRECT_URI). The integration is dormant until these are set.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Connection */}
          <div className="rounded border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">
                  {status.connected
                    ? `Connected: ${status.tenantName || 'Xero org'}`
                    : 'Not connected'}
                </p>
                {status.connected && status.expiresAt && (
                  <p className="mt-0.5 text-xs text-ink-3">
                    Access token valid until {new Date(status.expiresAt).toLocaleString('en-GB')}{' '}
                    (auto-refreshes).
                  </p>
                )}
              </div>
              {status.connected ? (
                <button
                  onClick={disconnect}
                  className="rounded border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-page"
                >
                  Disconnect
                </button>
              ) : (
                <a
                  href="/api/admin/xero/connect"
                  className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  Connect Xero
                </a>
              )}
            </div>
          </div>

          {/* Push-paused banner: pushing was ON but the mapping is now incomplete
              (e.g. after the reconciliation update added required accounts). Loud
              so it can never pause silently. */}
          {status.connected && mapping.pushEnabled && !complete && (
            <div className="rounded border-2 border-danger/40 bg-danger/10 px-4 py-3">
              <p className="text-sm font-semibold text-danger">
                Push paused: mapping incomplete
              </p>
              <p className="mt-1 text-sm text-ink-2">
                Pushing is switched on but Rena is <strong>not</strong> sending anything to Xero
                until every required account is mapped below — including the two new ones,{' '}
                <strong>Stripe fees</strong> and <strong>Settlement bank account</strong>. Map them
                and Save to resume.
              </p>
            </div>
          )}

          {/* Account mapping */}
          {status.connected && (
            <div className="rounded border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Account mapping</h2>
                  <p className="mt-1 text-xs text-ink-3">
                    Map each flow to one of your existing Xero accounts. We never create accounts.
                  </p>
                </div>
                <button
                  onClick={reloadAccounts}
                  disabled={busy}
                  className="shrink-0 rounded border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-page disabled:opacity-50"
                >
                  Reload accounts
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {ROLES.map((role) => {
                  const options = accounts.filter(role.only);
                  return (
                    <div key={role.key}>
                      <label className="block text-xs font-medium text-ink-2">
                        {role.label} <span className="font-normal text-ink-3">— {role.hint}</span>
                      </label>
                      <select
                        value={(mapping[role.key] as string) || ''}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [role.key]: e.target.value || null }))
                        }
                        className="mt-1 w-full rounded border border-line px-3 py-2 text-sm text-ink"
                      >
                        <option value="">— Select an account —</option>
                        {options.map((a) => (
                          <option key={a.accountID || a.code} value={a[role.idKey]}>
                            {accountLabel(a)}
                          </option>
                        ))}
                      </select>
                      {options.length === 0 && (
                        <p className="mt-1 text-xs text-warning">
                          No matching accounts found in Xero. Create one there, then Reload
                          accounts.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  saveMapping({
                    bankAccountCode: mapping.bankAccountCode,
                    commissionAccountCode: mapping.commissionAccountCode,
                    feeAccountCode: mapping.feeAccountCode,
                    clearingAccountCode: mapping.clearingAccountCode,
                    stripeFeeAccountCode: mapping.stripeFeeAccountCode,
                    settlementBankAccountCode: mapping.settlementBankAccountCode,
                  })
                }
                disabled={busy}
                className="mt-4 rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save mapping'}
              </button>

              {/* Feature flag */}
              <div className="mt-6 border-t border-line pt-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={mapping.pushEnabled}
                    disabled={busy || (!mapping.pushEnabled && !complete)}
                    onChange={(e) => saveMapping({ pushEnabled: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-ink">
                    Push transactions to Xero
                    {!complete && (
                      <span className="ml-2 text-xs text-warning">
                        (complete the mapping above first)
                      </span>
                    )}
                  </span>
                </label>
                <p className="mt-1 text-xs text-ink-3">
                  When off, Rena records nothing to Xero. Pushing itself is added in the next chunk;
                  this flag gates it.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
