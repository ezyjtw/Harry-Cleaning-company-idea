'use client';

import { useCallback, useEffect, useState } from 'react';

interface DeletionRequest {
  id: string;
  userId: string;
  email: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  processedBy: string | null;
  // B7.5 (RENA-065): age in days, the SLA chip and the attention flag ride the row.
  ageDays: number;
  slaChip: 'none' | 'due_soon' | 'overdue';
  recoveries: number;
  needsAttention: boolean;
}

function SlaChip({ r }: { r: DeletionRequest }) {
  if (r.slaChip === 'none' && !r.needsAttention) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-2">
      {r.slaChip === 'overdue' && (
        <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
          Overdue
        </span>
      )}
      {r.slaChip === 'due_soon' && (
        <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          Due soon
        </span>
      )}
      {r.needsAttention && (
        <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
          Needs attention ({r.recoveries} recoveries)
        </span>
      )}
    </span>
  );
}

interface SarRow {
  reference: string;
  receivedAt: string;
  deadline: string;
  status: string;
  extended: boolean;
  overdue: boolean;
}

// B7.4 (RENA-064, D-k): the subject access request record. Reference and
// clock only; the requester's identity lives in the legal@ mailbox, never here.
function SubjectAccessRequests() {
  const [rows, setRows] = useState<SarRow[]>([]);
  const [reference, setReference] = useState('');
  const [receivedAt, setReceivedAt] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/compliance?section=sar');
      const data = await res.json().catch(() => null);
      setRows(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setMessage('Network error: could not load subject access requests.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, string>) => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      setMessage(res.ok ? data?.message || 'Recorded.' : `Error: ${data?.error || 'Failed.'}`);
      if (res.ok) {
        setReference('');
        setReceivedAt('');
        await load();
      }
    } catch {
      setMessage('Network error: could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB') : 'n/a');

  return (
    <section className="mt-10" data-testid="sar-section">
      <h2 className="text-xl font-semibold text-ink">Subject access requests</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        The right of access (UK GDPR Article 15), handled through legal@ per docs/ops/sar.md. Log
        each request by a reference that carries no name or email. One month from receipt,
        extendable once by two months.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          post({ action: 'sar_received', reference, ...(receivedAt ? { receivedAt } : {}) });
        }}
      >
        <label className="text-sm text-ink-2">
          Reference
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            pattern="[A-Za-z0-9][A-Za-z0-9-]{2,39}"
            placeholder="SAR-2026-0001"
            required
            className="mt-1 block rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="text-sm text-ink-2">
          Date received
          <input
            type="date"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className="mt-1 block rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white disabled:opacity-40"
        >
          Log as received
        </button>
      </form>
      {message && <p className="mt-3 text-sm text-ink-2">{message}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">No subject access requests logged.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li
              key={r.reference}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
            >
              <div>
                <span className="font-medium text-ink">{r.reference}</span>
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === 'FULFILLED'
                      ? 'bg-primary-soft text-primary'
                      : r.overdue
                        ? 'bg-danger/10 text-danger'
                        : 'bg-warning/10 text-warning'
                  }`}
                >
                  {r.status === 'FULFILLED' ? 'Fulfilled' : r.overdue ? 'Overdue' : 'Open'}
                </span>
                <p className="mt-0.5 text-xs text-ink-3">
                  Received {fmt(r.receivedAt)}. Deadline {fmt(r.deadline)}
                  {r.extended ? ' (extended)' : ''}.
                </p>
              </div>
              {r.status !== 'FULFILLED' && (
                <div className="flex items-center gap-2">
                  {!r.extended && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => post({ action: 'sar_extended', reference: r.reference })}
                      className="rounded-[10px] border border-line px-3 py-1.5 font-jost text-sm text-ink-2 hover:bg-page disabled:opacity-40"
                    >
                      Extend by two months
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post({ action: 'sar_fulfilled', reference: r.reference })}
                    className="rounded-[10px] bg-primary px-3 py-1.5 font-jost text-sm font-medium text-white disabled:opacity-40"
                  >
                    Mark fulfilled
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// B7.8 (RENA-072): the three governance sections the API already serves
// (dpa, breaches, ico) with the existing POST actions. Ids and counts only in
// anything that could reach a log; free text stays in the record.
interface Dpa {
  id: string;
  processorName: string;
  processorType: string;
  status: string;
  agreementDate: string | null;
  expiryDate: string | null;
  reviewDate: string | null;
  documentRef: string | null;
}
interface Breach {
  id: string;
  title: string;
  severity: string;
  status: string;
  detectedAt: string;
  reportedToIcoAt: string | null;
  isNotifiable: boolean;
  individualsAffected: number;
}
interface Ico {
  registrationNumber: string | null;
  registeredName: string;
  renewalDate: string | null;
  status: string;
  dpoName: string | null;
  dpoEmail: string | null;
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB') : 'n/a';
const hoursSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);

function useCompliancePost(onDone: () => Promise<void>) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      setMessage(res.ok ? data?.message || 'Saved.' : `Error: ${data?.error || 'Failed.'}`);
      if (res.ok) await onDone();
      return res.ok;
    } catch {
      setMessage('Network error: could not reach the server.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { post, message, busy };
}

const inputCls =
  'mt-1 block w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink';
const btnCls =
  'rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white disabled:opacity-40';
const chipCls = (tone: 'ok' | 'warn' | 'danger') =>
  `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
    tone === 'ok'
      ? 'bg-primary-soft text-primary'
      : tone === 'warn'
        ? 'bg-warning/10 text-warning'
        : 'bg-danger/10 text-danger'
  }`;

function DpaSection() {
  const [rows, setRows] = useState<Dpa[]>([]);
  const [form, setForm] = useState({
    processorName: '',
    processorType: 'hosting',
    agreementDate: '',
    expiryDate: '',
    documentRef: '',
  });
  const load = useCallback(async () => {
    const res = await fetch('/api/admin/compliance?section=dpa');
    const data = await res.json().catch(() => null);
    setRows(Array.isArray(data?.agreements) ? data.agreements : []);
  }, []);
  const { post, message, busy } = useCompliancePost(load);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <section className="mt-10" data-testid="dpa-section">
      <h2 className="text-xl font-semibold text-ink">Data processing agreements</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        One row per processor (docs/ops/processors.md lists the processors the code uses). Status
        PENDING until the signed agreement reference is entered.
      </p>
      <form
        className="mt-4 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await post({ action: 'create_dpa', ...form, status: 'PENDING' })) {
            setForm({
              processorName: '',
              processorType: 'hosting',
              agreementDate: '',
              expiryDate: '',
              documentRef: '',
            });
          }
        }}
      >
        <label className="text-sm text-ink-2">
          Processor
          <input
            required
            value={form.processorName}
            onChange={(e) => setForm({ ...form, processorName: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-sm text-ink-2">
          Type
          <select
            value={form.processorType}
            onChange={(e) => setForm({ ...form, processorType: e.target.value })}
            className={inputCls}
          >
            {[
              'payment_processor',
              'email_provider',
              'sms_provider',
              'hosting',
              'storage',
              'analytics',
              'push',
              'ai',
              'mapping',
              'accounting',
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-ink-2">
          Agreement date
          <input
            type="date"
            value={form.agreementDate}
            onChange={(e) => setForm({ ...form, agreementDate: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-sm text-ink-2">
          Expiry
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-sm text-ink-2">
          Signed ref
          <input
            value={form.documentRef}
            onChange={(e) => setForm({ ...form, documentRef: e.target.value })}
            className={inputCls}
          />
        </label>
        <div className="sm:col-span-5">
          <button type="submit" disabled={busy} className={btnCls}>
            Add agreement
          </button>
        </div>
      </form>
      {message && <p className="mt-3 text-sm text-ink-2">{message}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">No agreements recorded.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
            >
              <div>
                <span className="font-medium text-ink">{r.processorName}</span>
                <span className="ml-2 text-xs text-ink-3">{r.processorType}</span>
                <span
                  className={`ml-2 ${chipCls(r.status === 'ACTIVE' ? 'ok' : r.status === 'EXPIRED' || r.status === 'TERMINATED' ? 'danger' : 'warn')}`}
                >
                  {r.status}
                </span>
                <p className="mt-0.5 text-xs text-ink-3">
                  Signed {fmtDate(r.agreementDate)}. Expires {fmtDate(r.expiryDate)}. Review{' '}
                  {fmtDate(r.reviewDate)}.{r.documentRef ? ` Ref ${r.documentRef}.` : ''}
                </p>
              </div>
              {r.status !== 'ACTIVE' && r.status !== 'TERMINATED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => post({ action: 'update_dpa', dpaId: r.id, status: 'ACTIVE' })}
                  className="rounded-[10px] border border-line px-3 py-1.5 font-jost text-sm text-ink-2 hover:bg-page disabled:opacity-40"
                >
                  Mark active
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BreachSection() {
  const [rows, setRows] = useState<Breach[]>([]);
  const [icoRefs, setIcoRefs] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'MEDIUM',
    individualsAffected: '0',
    isNotifiable: false,
  });
  const load = useCallback(async () => {
    const res = await fetch('/api/admin/compliance?section=breaches');
    const data = await res.json().catch(() => null);
    setRows(Array.isArray(data?.breaches) ? data.breaches : []);
  }, []);
  const { post, message, busy } = useCompliancePost(load);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <section className="mt-10" data-testid="breach-section">
      <h2 className="text-xl font-semibold text-ink">Breach incidents</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        docs/ops/breach.md is the process. The 72 hour ICO clock runs from detection. No personal
        data in the title or description: internal ids and counts only.
      </p>
      <form
        className="mt-4 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await post({
              action: 'report_breach',
              ...form,
              individualsAffected: Number(form.individualsAffected) || 0,
            })
          ) {
            setForm({
              title: '',
              description: '',
              severity: 'MEDIUM',
              individualsAffected: '0',
              isNotifiable: false,
            });
          }
        }}
      >
        <label className="text-sm text-ink-2">
          Title (no personal data)
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-sm text-ink-2">
          Severity
          <select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            className={inputCls}
          >
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-ink-2 sm:col-span-2">
          Description (what happened, what was exposed, as ids and counts)
          <textarea
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
            rows={3}
          />
        </label>
        <label className="text-sm text-ink-2">
          Individuals affected (count)
          <input
            type="number"
            min={0}
            value={form.individualsAffected}
            onChange={(e) => setForm({ ...form, individualsAffected: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-ink-2">
          <input
            type="checkbox"
            checked={form.isNotifiable}
            onChange={(e) => setForm({ ...form, isNotifiable: e.target.checked })}
          />
          Likely notifiable to the ICO
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className={btnCls}>
            Report breach
          </button>
        </div>
      </form>
      {message && <p className="mt-3 text-sm text-ink-2">{message}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">No incidents recorded.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => {
            const hours = hoursSince(r.detectedAt);
            const clockDanger = r.isNotifiable && !r.reportedToIcoAt && hours >= 48;
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
              >
                <div>
                  <span className="font-medium text-ink">{r.title}</span>
                  <span
                    className={`ml-2 ${chipCls(r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'danger' : 'warn')}`}
                  >
                    {r.severity}
                  </span>
                  <span className={`ml-2 ${chipCls(r.status === 'RESOLVED' ? 'ok' : 'warn')}`}>
                    {r.status}
                  </span>
                  {r.isNotifiable && !r.reportedToIcoAt && (
                    <span className={`ml-2 ${chipCls(clockDanger ? 'danger' : 'warn')}`}>
                      ICO clock: {hours}h of 72
                    </span>
                  )}
                  <p className="mt-0.5 text-xs text-ink-3">
                    Detected {fmtDate(r.detectedAt)}. {r.individualsAffected} affected.
                    {r.reportedToIcoAt ? ` Reported to the ICO ${fmtDate(r.reportedToIcoAt)}.` : ''}
                  </p>
                </div>
                {r.status !== 'RESOLVED' && (
                  <div className="flex items-center gap-2">
                    {r.status === 'DETECTED' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          post({
                            action: 'update_breach',
                            breachId: r.id,
                            status: 'CONTAINED',
                            containedAt: new Date().toISOString(),
                          })
                        }
                        className="rounded-[10px] border border-line px-3 py-1.5 font-jost text-sm text-ink-2 hover:bg-page disabled:opacity-40"
                      >
                        Contained
                      </button>
                    )}
                    {r.isNotifiable && !r.reportedToIcoAt && (
                      <>
                        <input
                          value={icoRefs[r.id] ?? ''}
                          onChange={(e) => setIcoRefs({ ...icoRefs, [r.id]: e.target.value })}
                          placeholder="ICO reference"
                          className="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-sm text-ink"
                        />
                        <button
                          type="button"
                          disabled={busy || !(icoRefs[r.id] ?? '').trim()}
                          onClick={() =>
                            post({
                              action: 'update_breach',
                              breachId: r.id,
                              status: 'REPORTED_TO_ICO',
                              reportedToIcoAt: new Date().toISOString(),
                              icoNotificationRef: (icoRefs[r.id] ?? '').trim(),
                            })
                          }
                          className="rounded-[10px] border border-line px-3 py-1.5 font-jost text-sm text-ink-2 hover:bg-page disabled:opacity-40"
                        >
                          Reported to ICO
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        post({
                          action: 'update_breach',
                          breachId: r.id,
                          status: 'RESOLVED',
                          resolvedAt: new Date().toISOString(),
                        })
                      }
                      className={btnCls}
                    >
                      Resolved
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function IcoSection() {
  const [reg, setReg] = useState<Ico | null>(null);
  const [form, setForm] = useState({
    registrationNumber: '',
    registeredName: 'Rena Cleaning Network',
    renewalDate: '',
    dpoName: '',
    dpoEmail: '',
  });
  const load = useCallback(async () => {
    const res = await fetch('/api/admin/compliance?section=ico');
    const data = await res.json().catch(() => null);
    const r = data?.registration ?? null;
    setReg(r);
    if (r)
      setForm({
        registrationNumber: r.registrationNumber ?? '',
        registeredName: r.registeredName ?? '',
        renewalDate: r.renewalDate ? r.renewalDate.slice(0, 10) : '',
        dpoName: r.dpoName ?? '',
        dpoEmail: r.dpoEmail ?? '',
      });
  }, []);
  const { post, message, busy } = useCompliancePost(load);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <section className="mt-10" data-testid="ico-section">
      <h2 className="text-xl font-semibold text-ink">ICO registration</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        The registration reference and renewal date are entered here by James; the record is empty
        until then.{' '}
        {reg ? (
          <span>
            Current:{' '}
            <span className={chipCls(reg.status === 'ACTIVE' ? 'ok' : 'warn')}>{reg.status}</span>{' '}
            {reg.registrationNumber ? `ref ${reg.registrationNumber}, ` : ''}renewal{' '}
            {fmtDate(reg.renewalDate)}.
          </span>
        ) : (
          <span>No registration recorded.</span>
        )}
      </p>
      <form
        className="mt-4 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await post({
            action: 'update_ico',
            ...form,
            status: form.registrationNumber ? 'ACTIVE' : 'PENDING',
          });
        }}
      >
        <label className="text-sm text-ink-2">
          Registration reference
          <input
            value={form.registrationNumber}
            onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-sm text-ink-2">
          Registered name
          <input
            required
            value={form.registeredName}
            onChange={(e) => setForm({ ...form, registeredName: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-sm text-ink-2">
          Renewal date
          <input
            type="date"
            value={form.renewalDate}
            onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-sm text-ink-2">
          Data protection contact (name)
          <input
            value={form.dpoName}
            onChange={(e) => setForm({ ...form, dpoName: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-sm text-ink-2">
          Data protection contact (email)
          <input
            type="email"
            value={form.dpoEmail}
            onChange={(e) => setForm({ ...form, dpoEmail: e.target.value })}
            className={inputCls}
          />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className={btnCls}>
            Save registration
          </button>
        </div>
      </form>
      {message && <p className="mt-3 text-sm text-ink-2">{message}</p>}
    </section>
  );
}

export default function AdminCompliancePage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/compliance?section=deletions');
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      const data = await res.json().catch(() => null);
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setStatusMessage('Network error — could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const act = async (
    id: string,
    action: 'approve_deletion' | 'reject_deletion',
    notes?: string
  ) => {
    setProcessingId(id);
    setStatusMessage('');
    try {
      const res = await fetch('/api/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestId: id, notes }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage(data?.message || 'Done.');
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        setStatusMessage(`Error: ${data?.error || 'Failed to process request.'}`);
      }
    } catch {
      setStatusMessage('Network error — could not reach the server.');
    } finally {
      setProcessingId(null);
      setConfirmingId(null);
    }
  };

  if (accessDenied) {
    return (
      <div className="p-6 lg:p-10">
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-5 py-4">
          <p className="text-sm font-medium text-danger">Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Compliance</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          GDPR right-to-erasure requests. Approving executes the erasure immediately and
          irreversibly: the user is anonymised, addresses deleted, identity documents destroyed
          (except those under a statutory retention hold), messages redacted, and consents
          withdrawn. Bookings and payments are retained for the 6-year tax/legal period.
        </p>
      </header>

      {statusMessage && (
        <div className="mb-5 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink-2">{statusMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-line" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-ink-3">No deletion requests awaiting action.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{r.email}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'APPROVED' || r.status === 'IN_PROGRESS'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-primary-soft text-primary'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">User ID: {r.userId}</p>
                  {r.reason && <p className="mt-2 text-sm text-ink-2">Reason: {r.reason}</p>}
                </div>
                <span className="text-xs text-ink-3">
                  Requested {new Date(r.requestedAt).toLocaleDateString('en-GB')} ({r.ageDays}{' '}
                  {r.ageDays === 1 ? 'day' : 'days'} ago)
                  <SlaChip r={r} />
                </span>
              </div>

              {confirmingId === r.id ? (
                <div className="mt-4 rounded-[10px] border border-danger/30 bg-danger/5 p-3">
                  <p className="text-sm text-ink-2">
                    Permanently erase {r.email}? This anonymises the user, deletes addresses,
                    destroys identity documents (except those under a statutory hold), redacts
                    messages, and withdraws consents. Bookings/payments are retained (tax law).{' '}
                    <span className="font-medium text-danger">This cannot be undone.</span>
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => act(r.id, 'approve_deletion')}
                      disabled={processingId === r.id}
                      className="rounded-[10px] bg-danger px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
                    >
                      {processingId === r.id ? 'Erasing…' : 'Yes, erase permanently'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={processingId === r.id}
                      className="rounded-[10px] border border-line px-4 py-2 font-jost text-sm font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmingId(r.id)}
                    disabled={processingId === r.id}
                    className="rounded-[10px] bg-danger px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
                  >
                    Approve &amp; erase
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.id, 'reject_deletion')}
                    disabled={processingId === r.id}
                    className="rounded-[10px] border border-line px-4 py-2 font-jost text-sm font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SubjectAccessRequests />
      <DpaSection />
      <BreachSection />
      <IcoSection />
    </div>
  );
}
