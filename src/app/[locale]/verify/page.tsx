'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type VerifyStep =
  | 'start'
  | 'document'
  | 'selfie'
  | 'processing'
  | 'complete'
  | 'submitted'
  | 'error';

// Backend identity states (CleanerProfile.verificationStatus).
type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Shared "what's unlocked" list — used by both the just-verified and the
// already-verified screens so the copy stays identical.
function UnlockedList() {
  return (
    <div className="mt-8 rounded-xl bg-gray-50 p-6 text-left max-w-md mx-auto">
      <h3 className="font-semibold text-gray-900">What&apos;s unlocked:</h3>
      <ul className="mt-3 space-y-2 text-sm text-gray-600">
        <li className="flex items-center gap-2">
          <span className="text-green-500">&#10003;</span>
          Verified badge on your profile and cards
        </li>
        <li className="flex items-center gap-2">
          <span className="text-green-500">&#10003;</span>
          Priority in search results
        </li>
        <li className="flex items-center gap-2">
          <span className="text-green-500">&#10003;</span>
          Arrival selfie confirmation for customers
        </li>
        <li className="flex items-center gap-2">
          <span className="text-green-500">&#10003;</span>
          Eligible for Rena Guarantee jobs
        </li>
      </ul>
    </div>
  );
}

export default function VerifyPage() {
  const [step, setStep] = useState<VerifyStep>('start');
  const [documentType, setDocumentType] = useState('drivers-license');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBase64, setDocumentBase64] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Status-aware mount: read the cleaner's current verification status and
  // render the right screen instead of always dropping into the wizard.
  const [mountLoading, setMountLoading] = useState(true);
  const [mountError, setMountError] = useState(false);
  const [mountStatus, setMountStatus] = useState<VerificationStatus>('UNVERIFIED');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const docInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    setMountLoading(true);
    setMountError(false);
    try {
      const res = await fetch('/api/verification/dbs');
      if (!res.ok) {
        setMountError(true);
        return;
      }
      const data = await res.json();
      const v = data.verification;
      setMountStatus((v?.identity?.verificationStatus as VerificationStatus) ?? 'UNVERIFIED');
      setRejectionReason(
        typeof v?.verificationMeta?.rejectionReason === 'string'
          ? v.verificationMeta.rejectionReason
          : null
      );
    } catch {
      setMountError(true);
    } finally {
      setMountLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDocumentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentFile(file);
    const base64 = await readFileAsBase64(file);
    setDocumentBase64(base64);
  }, []);

  const handleSelfieUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    const base64 = await readFileAsBase64(file);
    setSelfieBase64(base64);
  }, []);

  const handleCompleteVerification = async () => {
    if (!documentBase64 || !selfieBase64) return;

    setStep('processing');

    try {
      // Server contract unchanged: still action:'liveness_check' with the same
      // fields (renaming the action is a separate server-side change — backlog).
      const res = await fetch('/api/verification/dbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'liveness_check',
          idImage: documentBase64,
          selfieImage: selfieBase64,
          documentType,
        }),
      });

      const data = await res.json();

      if (res.ok && data.result?.success) {
        // Only a genuine API match ('match') is truly verified. Everything else
        // that succeeded (manual-review fallback 'pending_review', or a
        // low-confidence 'no_match') is submitted for review — not verified.
        if (data.result.status === 'match') {
          setStep('complete');
        } else {
          setStep('submitted');
        }
      } else {
        setErrorMessage(
          data.error || data.result?.message || 'Verification failed. Please try again.'
        );
        setStep('error');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
      setStep('error');
    }
  };

  // ─── Fetch loading / error (the status read itself) ───
  if (mountLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600" />
        <p className="mt-4 text-sm text-gray-500">Loading your verification status…</p>
      </div>
    );
  }

  if (mountError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="font-newsreader text-2xl font-semibold text-gray-900">
          Couldn&apos;t load your status
        </h1>
        <p className="mt-3 text-gray-600">
          Something went wrong loading your verification status. Please try again.
        </p>
        <button
          onClick={fetchStatus}
          className="mt-8 rounded-lg bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─── Already under review ───
  if (mountStatus === 'PENDING') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl text-amber-600">
          &#8987;
        </div>
        <h1 className="mt-6 font-newsreader text-2xl font-semibold text-gray-900">
          Documents Under Review
        </h1>
        <p className="mt-3 text-gray-600">
          We&apos;re reviewing your documents — this usually takes 24–48 hours. We&apos;ll email you
          as soon as it&apos;s done.
        </p>
      </div>
    );
  }

  // ─── Already verified ───
  if (mountStatus === 'VERIFIED') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-600">
          &#10003;
        </div>
        <h1 className="mt-6 font-newsreader text-2xl font-semibold text-gray-900">
          You&apos;re Verified
        </h1>
        <UnlockedList />
        <button
          onClick={() => (window.location.href = '/dashboard')}
          className="mt-8 rounded-lg bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ─── Rejected ───
  if (mountStatus === 'REJECTED') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl text-red-600">
          &#10007;
        </div>
        <h1 className="mt-6 font-newsreader text-2xl font-semibold text-gray-900">
          Verification Unsuccessful
        </h1>
        <p className="mt-3 text-gray-600">
          {rejectionReason || 'We couldn’t verify your documents.'}
        </p>
        <button
          onClick={() => {
            setMountStatus('UNVERIFIED');
            setStep('document');
            setDocumentFile(null);
            setDocumentBase64(null);
            setSelfieFile(null);
            setSelfieBase64(null);
          }}
          className="mt-8 rounded-lg bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─── UNVERIFIED → the wizard ───
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Identity Verification</h1>
      <p className="mt-2 text-gray-600">
        Verify your identity to build trust and unlock all platform features. This protects both
        cleaners and customers.
      </p>

      {/* Progress steps */}
      <div className="mt-8 flex items-center gap-2">
        {[
          { key: 'document', label: '1. ID Document' },
          { key: 'selfie', label: '2. Selfie Match' },
        ].map((s, i) => {
          const stepOrder = ['start', 'document', 'selfie', 'processing', 'complete'];
          const anchor = step === 'error' ? 'selfie' : step === 'submitted' ? 'complete' : step;
          const currentIndex = stepOrder.indexOf(anchor);
          const stepIndex = stepOrder.indexOf(s.key);
          const isActive = currentIndex >= stepIndex;
          const isComplete = currentIndex > stepIndex;

          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isComplete
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isComplete ? '✓' : i + 1}
              </div>
              <span
                className={`text-sm ${isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}`}
              >
                {s.label}
              </span>
              {i < 1 && (
                <div className={`flex-1 h-0.5 ${isActive ? 'bg-brand-300' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Start ─── */}
      {step === 'start' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-xl bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Why verify?</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Trust Badge</div>
                  <div className="text-xs text-gray-500">Verified badge shown on your profile</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">More Bookings</div>
                  <div className="text-xs text-gray-500">
                    Verified cleaners get 3x more bookings
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Safety</div>
                  <div className="text-xs text-gray-500">
                    Everyone knows who they&apos;re meeting
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Arrival Check</div>
                  <div className="text-xs text-gray-500">
                    Quick selfie confirms the right person shows up
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
            <strong>Privacy:</strong> Your ID is encrypted and only used for verification. We never
            share your documents with customers or cleaners. Verification data is deleted after 30
            days.
          </div>

          <button
            onClick={() => setStep('document')}
            className="w-full rounded-lg bg-brand-600 py-3 text-lg font-semibold text-white hover:bg-brand-700"
          >
            Start Verification
          </button>
        </div>
      )}

      {/* ─── Document Upload ─── */}
      {step === 'document' && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Step 1: Upload Government ID</h2>
            <p className="mt-1 text-sm text-gray-500">
              We&apos;ll verify your name and photo match your profile.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Document Type</label>
            <div className="mt-2 flex flex-wrap gap-3">
              {[
                { value: 'drivers-license', label: "Driver's License" },
                { value: 'passport', label: 'Passport' },
                { value: 'national-id', label: 'National ID Card' },
              ].map((doc) => (
                <button
                  key={doc.value}
                  onClick={() => setDocumentType(doc.value)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    documentType === doc.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {doc.label}
                </button>
              ))}
            </div>
          </div>

          <input
            ref={docInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleDocumentUpload}
          />

          <div className="space-y-3">
            <button
              onClick={() => docInputRef.current?.click()}
              className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition ${
                documentFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-brand-400 hover:bg-brand-50'
              }`}
            >
              {documentFile ? (
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-xl">
                    &#10003;
                  </div>
                  <p className="mt-2 text-sm font-medium text-green-700">
                    {documentFile.name} uploaded
                  </p>
                  <p className="text-xs text-green-600">Tap to change</p>
                </div>
              ) : (
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xl">
                    &#128196;
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Take a photo or upload front of your ID
                  </p>
                  <p className="text-xs text-gray-400">Make sure all text is clearly readable</p>
                </div>
              )}
            </button>
          </div>

          <button
            onClick={() => setStep('selfie')}
            disabled={!documentFile}
            className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to Selfie
          </button>
        </div>
      )}

      {/* ─── Selfie Match ─── */}
      {step === 'selfie' && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Step 2: Selfie Verification</h2>
            <p className="mt-1 text-sm text-gray-500">
              Take a selfie so we can match your face to your ID document. This confirms you are who
              you say you are.
            </p>
          </div>

          <input
            ref={selfieInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleSelfieUpload}
          />

          <button
            onClick={() => selfieInputRef.current?.click()}
            className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition ${
              selfieFile
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-brand-400 hover:bg-brand-50'
            }`}
          >
            {selfieFile ? (
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
                  &#10003;
                </div>
                <p className="mt-2 text-sm font-medium text-green-700">Selfie captured</p>
                <p className="text-xs text-green-600">Tap to retake</p>
              </div>
            ) : (
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-3xl">
                  &#128247;
                </div>
                <p className="mt-2 text-sm text-gray-500">Open camera and take a clear selfie</p>
                <p className="text-xs text-gray-400">
                  Good lighting, face the camera directly, no sunglasses
                </p>
              </div>
            )}
          </button>

          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <strong>How face matching works:</strong> Our system compares your selfie to the photo
            on your ID. We use AI to verify it&apos;s the same person. This photo is also used for
            arrival verification — so customers can confirm the right person shows up.
          </div>

          <button
            onClick={handleCompleteVerification}
            disabled={!selfieFile}
            className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Complete Verification
          </button>
        </div>
      )}

      {/* ─── Processing ─── */}
      {step === 'processing' && (
        <div className="mt-16 text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600" />
          <h2 className="mt-6 text-lg font-semibold text-gray-900">Verifying your identity...</h2>
          <p className="mt-2 text-sm text-gray-500">
            Matching your document and selfie. This takes just a moment.
          </p>
        </div>
      )}

      {/* ─── Submitted (under review) ─── */}
      {step === 'submitted' && (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl text-amber-600">
            &#8987;
          </div>
          <h2 className="mt-6 font-newsreader text-2xl font-semibold text-gray-900">
            Documents Submitted
          </h2>
          <p className="mt-3 text-gray-600">
            Thanks — your ID and selfie are in. We&apos;ll review them within 24–48 hours and email
            you when your Verified badge is live.
          </p>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="mt-8 rounded-lg bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Go to Dashboard
          </button>
        </div>
      )}

      {/* ─── Error ─── */}
      {step === 'error' && (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl text-red-600">
            &#10007;
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Verification Failed</h2>
          <p className="mt-3 text-gray-600">{errorMessage}</p>
          <button
            onClick={() => {
              setStep('document');
              setDocumentFile(null);
              setDocumentBase64(null);
              setSelfieFile(null);
              setSelfieBase64(null);
            }}
            className="mt-8 rounded-lg bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ─── Complete (genuinely verified) ─── */}
      {step === 'complete' && (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-600">
            &#10003;
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Identity Verified!</h2>
          <p className="mt-3 text-gray-600">
            Your profile now shows the &quot;ID &amp; Background Verified&quot; badge. Customers
            will see this when booking and upon your arrival.
          </p>

          <UnlockedList />

          <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700 max-w-md mx-auto">
            <strong>Arrival verification:</strong> When you arrive at a customer&apos;s home,
            you&apos;ll take a quick selfie in the app. The customer sees it matches your verified
            photo — confirming the right person showed up.
          </div>

          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="mt-8 rounded-lg bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
