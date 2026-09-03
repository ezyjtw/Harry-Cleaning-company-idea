'use client';

import { useCallback, useRef, useEffect } from 'react';

type FunnelType = 'booking' | 'cleaner_signup' | 'client_signup';
type EventType =
  | 'FUNNEL_STEP'
  | 'PAGE_VIEW'
  | 'FORM_INTERACTION'
  | 'DROP_OFF'
  | 'FORM_ERROR'
  | 'CONVERSION';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem('rena_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem('rena_session_id', sessionId);
  }
  return sessionId;
}

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  return 'Other';
}

// F29 (James-ruled): attribution. The cleaner-signup wizard knows who the
// visitor is the moment step 0 creates the account, but events were always
// sent anonymous. The wizard sets the id at that moment (and on draft
// resume); every event sent AFTER carries it. The API route and the
// AnalyticsEvent schema have always accepted userId — this only starts
// sending it. Pre-step-0 events stay anonymous by construction: nothing
// sets the id until an account exists.
let analyticsUserId: string | null = null;
export function setAnalyticsUserId(id: string | null) {
  analyticsUserId = id;
}

async function sendEvent(payload: Record<string, unknown>) {
  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getSessionId(),
        userId: analyticsUserId ?? undefined,
        deviceType: getDeviceType(),
        browser: getBrowser(),
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        ...payload,
      }),
    });
  } catch {
    // Silently fail — analytics should never break UX
  }
}

/**
 * Hook for tracking analytics events in React components.
 *
 * Usage:
 *   const { trackStep, trackDropOff, trackFormError, trackInteraction } = useAnalytics('booking');
 *   trackStep(3, 'contact_info');
 *   trackFormError('email', 'Invalid email format');
 */
export function useAnalytics(funnel?: FunnelType) {
  const stepStartTime = useRef<number>(Date.now());
  const currentStep = useRef<{ step: number; name: string } | null>(null);

  // Track drop-off on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentStep.current && funnel) {
        const duration = Math.round((Date.now() - stepStartTime.current) / 1000);
        // Use sendBeacon for reliable delivery on page close
        const payload = JSON.stringify({
          sessionId: getSessionId(),
          // F29: the unload beacon is the abandonment record — it carries the
          // same attribution as every other post-step-0 event.
          userId: analyticsUserId ?? undefined,
          eventType: 'DROP_OFF',
          funnel,
          funnelStep: currentStep.current.step,
          stepName: currentStep.current.name,
          duration,
          deviceType: getDeviceType(),
          browser: getBrowser(),
          page: window.location.pathname,
        });
        navigator.sendBeacon(
          '/api/analytics/events',
          new Blob([payload], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [funnel]);

  const trackStep = useCallback(
    (step: number, stepName: string, metadata?: Record<string, unknown>) => {
      const duration = currentStep.current
        ? Math.round((Date.now() - stepStartTime.current) / 1000)
        : undefined;

      currentStep.current = { step, name: stepName };
      stepStartTime.current = Date.now();

      sendEvent({
        eventType: 'FUNNEL_STEP' as EventType,
        funnel,
        funnelStep: step,
        stepName,
        duration,
        metadata,
      });
    },
    [funnel]
  );

  const trackDropOff = useCallback(
    (step: number, stepName: string, metadata?: Record<string, unknown>) => {
      const duration = Math.round((Date.now() - stepStartTime.current) / 1000);
      currentStep.current = null;

      sendEvent({
        eventType: 'DROP_OFF' as EventType,
        funnel,
        funnelStep: step,
        stepName,
        duration,
        metadata,
      });
    },
    [funnel]
  );

  const trackFormError = useCallback(
    (field: string, errorMessage: string, stepName?: string) => {
      sendEvent({
        eventType: 'FORM_ERROR' as EventType,
        funnel,
        stepName,
        metadata: { field, errorMessage },
      });
    },
    [funnel]
  );

  const trackInteraction = useCallback(
    (metadata: Record<string, unknown>) => {
      sendEvent({
        eventType: 'FORM_INTERACTION' as EventType,
        funnel,
        metadata,
      });
    },
    [funnel]
  );

  const trackConversion = useCallback(
    (metadata?: Record<string, unknown>) => {
      currentStep.current = null;
      sendEvent({
        eventType: 'CONVERSION' as EventType,
        funnel,
        metadata,
      });
    },
    [funnel]
  );

  const trackPageView = useCallback(
    (metadata?: Record<string, unknown>) => {
      sendEvent({
        eventType: 'PAGE_VIEW' as EventType,
        funnel,
        metadata,
      });
    },
    [funnel]
  );

  return {
    trackStep,
    trackDropOff,
    trackFormError,
    trackInteraction,
    trackConversion,
    trackPageView,
  };
}
