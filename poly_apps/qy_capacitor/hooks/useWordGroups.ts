/**
 * useWordGroups Hook
 * Simplified hook for using WordGroupsCenter in components
 */

import { useState, useEffect } from 'react';
import { WordGroup } from '../types';
import { WordGroupsCenter } from '../services/WordGroupsCenter';

export interface UseWordGroupsReturn {
  groups: WordGroup[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getById: (id: string) => WordGroup | undefined;
  search: (query: string) => WordGroup[];
  getByLanguage: (language: string) => WordGroup[];
}

/**
 * Custom hook to manage word groups with automatic updates
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { groups, loading, refresh } = useWordGroups();
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <button onClick={refresh}>Refresh</button>
 *       {groups.map(g => <div key={g.id}>{g.name}</div>)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWordGroups(): UseWordGroupsReturn {
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to automatic updates
    const unsubscribe = WordGroupsCenter.subscribe((newGroups) => {
      setGroups(newGroups);
      setLoading(false);
    });

    // Initial fetch
    WordGroupsCenter.fetchAll().catch(err => {
      console.error('[useWordGroups] Failed to fetch groups:', err);
      setError(err.message || 'Failed to load word groups');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await WordGroupsCenter.refresh();
      setLoading(false);
    } catch (err: any) {
      console.error('[useWordGroups] Refresh failed:', err);
      setError(err.message || 'Failed to refresh word groups');
      setLoading(false);
    }
  };

  return {
    groups,
    loading,
    error,
    refresh,
    getById: WordGroupsCenter.getById.bind(WordGroupsCenter),
    search: WordGroupsCenter.search.bind(WordGroupsCenter),
    getByLanguage: WordGroupsCenter.getByLanguage.bind(WordGroupsCenter),
  };
}

/**
 * Hook to get a single word group by ID
 *
 * @example
 * ```tsx
 * function GroupDetail({ groupId }: { groupId: string }) {
 *   const group = useWordGroup(groupId);
 *
 *   if (!group) return <div>Group not found</div>;
 *
 *   return <div>{group.name}</div>;
 * }
 * ```
 */
export function useWordGroup(groupId: string): WordGroup | undefined {
  const [group, setGroup] = useState<WordGroup | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = WordGroupsCenter.subscribe((groups) => {
      const found = groups.find(g => g.id === groupId);
      setGroup(found);
    });

    // Check immediately
    const found = WordGroupsCenter.getById(groupId);
    if (found) {
      setGroup(found);
    } else {
      // Fetch if not available
      WordGroupsCenter.fetchAll();
    }

    return unsubscribe;
  }, [groupId]);

  return group;
}
