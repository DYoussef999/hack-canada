'use client';

import { useEffect, useState } from 'react';
import { startSession } from '@/services/compassApi';
import type { SessionResponse } from '@/types/api';

function getOrCreateSessionId(): string {
  const key = 'compass_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export interface SessionState {
  sessionId: string | null;
  session: SessionResponse | null;
  /** true while /session/start is in flight */
  loading: boolean;
  /** non-null when backend is unreachable or returned an error */
  error: string | null;
}

/**
 * Generates/retrieves a stable session UUID from localStorage, then calls
 * POST /session/start once on mount. Downstream components can read `sessionId`
 * and `session` for thread IDs.
 *
 * When the backend is offline the hook sets `error` and the app degrades
 * gracefully — local financials still work, AI features show a banner.
 */
export function useSession(): SessionState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);

    startSession(id)
      .then((s) => setSession(s))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { sessionId, session, loading, error };
}
