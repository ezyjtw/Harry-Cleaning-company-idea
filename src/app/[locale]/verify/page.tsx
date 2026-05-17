'use client';

import { useCallback, useRef, useState } from 'react';

type VerifyStep =
  | 'start'
  | 'document'
  | 'selfie'
  | 'liveness'
  | 'processing'
  | 'complete'
  | 'error';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VerifyPage() {
  const [step, setStep] = useState<VerifyStep>('start');
  const [documentType, setDocumentType] = useState('drivers-license');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBase64, setDocumentBase64] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [livenessChecks, setLivenessChecks] = useState({
    blink: false,
    turnLeft: false,
    turnRight: false,
    smile: false,
  });

  const docInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const allLivenessComplete = Object.values(livenessChecks).every(Boolean);

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

  const handleStartLiveness = () => {
    setStep('liveness');
    setTimeout(() => setLivenessChecks((p) => ({ ...p, blink: true })), 1500);
    setTimeout(() => setLivenessChecks((p) => ({ ...p, turnLeft: true })), 3000);
    setTimeout(() => setLivenessChecks((p) => ({ ...p, turnRight: true })), 4500);
    setTimeout(() => setLivenessChecks((p) => ({ ...p, smile: true })), 6000);
  };

  const handleCompleteVerification = async () => {
    if (!documentBase64 || !selfieBase64) return;

    setStep('processing');

    try {
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
        setStep('complete');
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
          { key: 'liveness', label: '3. Liveness Check' },
        ].map((s, i) => {
          const stepOrder = ['start', 'document', 'selfie', 'liveness', 'processing', 'complete'];
          const currentIndex = stepOrder.indexOf(step === 'error' ? 'liveness' : step);
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
              {i < 2 && (
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
            onClick={handleStartLiveness}
            disabled={!selfieFile}
            className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to Liveness Check
          </button>
        </div>
      )}

      {/* ─── Liveness Check ─── */}
      {step === 'liveness' && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Step 3: Liveness Check</h2>
            <p className="mt-1 text-sm text-gray-500">
              This confirms you&apos;re a real person (not a photo of a photo). Follow the prompts —
              it only takes a few seconds.
            </p>
          </div>

          <div className="rounded-xl bg-gray-900 p-8 text-center relative overflow-hidden">
            <div className="mx-auto h-40 w-40 rounded-full border-4 border-dashed border-gray-600 flex items-center justify-center">
              <span className="text-6xl">&#128100;</span>
            </div>
            <p className="mt-4 text-sm text-gray-300">Position your face in the circle</p>

            <div className="mt-6 space-y-3">
              {[
                { key: 'blink' as const, label: 'Blink your eyes', icon: '&#128065;' },
                { key: 'turnLeft' as const, label: 'Turn head left', icon: '&#11013;' },
                { key: 'turnRight' as const, label: 'Turn head right', icon: '&#10145;' },
                { key: 'smile' as const, label: 'Smile', icon: '&#128522;' },
              ].map((check) => (
                <div
                  key={check.key}
                  className={`flex items-center justify-between rounded-lg px-4 py-2 transition ${
                    livenessChecks[check.key]
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span dangerouslySetInnerHTML={{ __html: check.icon }} />
                    {check.label}
                  </span>
                  {livenessChecks[check.key] ? (
                    <span className="text-green-400 font-bold">&#10003;</span>
                  ) : (
                    <span className="text-gray-600">Waiting...</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {allLivenessComplete && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <div className="text-lg font-semibold text-green-700">Liveness Check Passed!</div>
              <p className="mt-1 text-sm text-green-600">
                You&apos;re confirmed as a real person. Finalizing verification...
              </p>
            </div>
          )}

          <button
            onClick={handleCompleteVerification}
            disabled={!allLivenessComplete}
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
            Matching document, selfie, and liveness data. This takes just a moment.
          </p>
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
              setLivenessChecks({ blink: false, turnLeft: false, turnRight: false, smile: false });
            }}
            className="mt-8 rounded-lg bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ─── Complete ─── */}
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
                Eligible for Sparkle Guarantee jobs
              </li>
            </ul>
          </div>

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
