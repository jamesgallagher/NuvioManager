import { useState, useEffect, useCallback, useRef } from 'react';
import { ManagedAccount } from '../types/nuvio';
import { CollectionSummary, pullRemoteCollections } from '../services/collectionService';
import { toErrorMessage } from '../services/errors';
import { withSession } from '../services/session';

export interface UseRemoteCollectionsResult {
  collections: CollectionSummary[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/** Read-only collections for the account's active profile. */
export function useRemoteCollections(
  account: ManagedAccount | null,
  onAccountUpdated: (account: ManagedAccount) => void
): UseRemoteCollectionsResult {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountRef = useRef(account);
  accountRef.current = account;
  const onUpdatedRef = useRef(onAccountUpdated);
  onUpdatedRef.current = onAccountUpdated;
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const current = accountRef.current;
    if (!current) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await withSession(
        current,
        (client) => pullRemoteCollections(client, current.activeProfileId),
        (updated) => {
          accountRef.current = updated;
          onUpdatedRef.current(updated);
        }
      );
      if (requestId !== requestIdRef.current) return; // stale
      setCollections(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return; // stale
      setCollections([]);
      setError(toErrorMessage(err, 'Could not load collections'));
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  const accountId = account?.id;
  const profileId = account?.activeProfileId;
  useEffect(() => {
    setCollections([]);
    void load();
  }, [accountId, profileId, load]);

  return { collections, isLoading, error, reload: () => void load() };
}
