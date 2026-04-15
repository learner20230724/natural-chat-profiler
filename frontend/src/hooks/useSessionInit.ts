import { useEffect, useRef, useState } from 'react';

const INIT_MIN_DURATION_MS = 400;

interface UseSessionInitOptions {
  loadSessions: () => Promise<unknown>;
  createSession: () => Promise<unknown>;
  organizeSessions: () => Promise<unknown>;
  setError: (msg: string | null) => void;
  currentSessionId: string | null;
  isCreatingSession: boolean;
}

export function useSessionInit({
  loadSessions,
  createSession,
  organizeSessions,
  setError,
  currentSessionId,
  isCreatingSession,
}: UseSessionInitOptions) {
  const [shouldAutoCreateSession, setShouldAutoCreateSession] = useState(true);
  const [isInitComplete, setIsInitComplete] = useState(false);
  const initialCreateInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const startTime = Date.now();
      try { await loadSessions(); } catch {}
      const remaining = Math.max(0, INIT_MIN_DURATION_MS - (Date.now() - startTime));
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      if (!cancelled) setIsInitComplete(true);
      void organizeSessions().catch(() => {});
    };

    void run();
    return () => { cancelled = true; };
  }, [loadSessions, organizeSessions]);

  useEffect(() => {
    if (!isInitComplete) return;
    if (
      initialCreateInFlightRef.current ||
      currentSessionId ||
      isCreatingSession ||
      !shouldAutoCreateSession
    ) return;

    initialCreateInFlightRef.current = true;
    createSession()
      .catch((error) => {
        console.error('Failed to create initial session:', error);
        setError('自动创建会话失败，请手动新建');
      })
      .finally(() => { initialCreateInFlightRef.current = false; });
  }, [isInitComplete, currentSessionId, isCreatingSession, shouldAutoCreateSession, createSession, setError]);

  return { isInitComplete, shouldAutoCreateSession, setShouldAutoCreateSession };
}
