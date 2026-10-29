import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { readRecentGroup, writeRecentGroup } from '../utils/recentGroupStorage.js';

const RecentGroupContext = createContext(null);

export function RecentGroupProvider({ children }) {
  const [recentGroup, setRecentGroup] = useState(() => readRecentGroup());

  const rememberGroup = useCallback((group) => {
    const pointer = { id: String(group.id), name: group.name };
    if (!writeRecentGroup(pointer)) {
      console.warn({ event: 'recent_group_session_storage_unavailable' });
    }
    setRecentGroup(pointer);
  }, []);

  const value = useMemo(() => ({ recentGroup, rememberGroup }), [recentGroup, rememberGroup]);

  return (
    <RecentGroupContext.Provider value={value}>
      {children}
    </RecentGroupContext.Provider>
  );
}

export function useRecentGroup() {
  const context = useContext(RecentGroupContext);
  if (!context) {
    throw new Error('useRecentGroup must be used within RecentGroupProvider');
  }
  return context;
}
