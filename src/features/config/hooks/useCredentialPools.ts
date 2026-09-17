import { useCallback, useEffect, useRef, useState } from 'react';
import { credentialPoolsApi, type CredentialPools } from '@/services/api/credentialPools';

export type CredentialPoolsState = {
  data: CredentialPools | null;
  loading: boolean;
  /** Backend without the endpoint (404): the view hides itself instead of erroring. */
  unsupported: boolean;
  error: string | null;
  reload: () => void;
};

const readStatus = (err: unknown): number | undefined => {
  if (!err || typeof err !== 'object') return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
};

/** Loads the read-only pool summary once per mount; stale responses never overwrite newer ones. */
export function useCredentialPools(): CredentialPoolsState {
  const [data, setData] = useState<CredentialPools | null>(null);
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    credentialPoolsApi
      .get()
      .then((result) => {
        if (id !== requestId.current) return;
        setData(result);
        setUnsupported(false);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        if (readStatus(err) === 404) {
          setUnsupported(true);
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return { data, loading, unsupported, error, reload: load };
}
