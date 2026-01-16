import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 5 minutes (data considered fresh)
      staleTime: 5 * 60 * 1000,
      // Cache time: 30 minutes (keep in cache)
      gcTime: 30 * 60 * 1000,
      // Retry failed requests 2 times
      retry: 2,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect automatically
      refetchOnReconnect: 'always',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Query keys factory for type-safe, consistent keys
export const queryKeys = {
  // Notes
  notes: {
    all: ['notes'] as const,
    lists: () => [...queryKeys.notes.all, 'list'] as const,
    list: (filters: { folderId?: string | null; search?: string; userId?: string }) =>
      [...queryKeys.notes.lists(), filters] as const,
    details: () => [...queryKeys.notes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notes.details(), id] as const,
  },

  // Folders
  folders: {
    all: ['folders'] as const,
    lists: () => [...queryKeys.folders.all, 'list'] as const,
    list: (userId?: string) => [...queryKeys.folders.lists(), { userId }] as const,
    details: () => [...queryKeys.folders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.folders.details(), id] as const,
  },

  // User/Auth
  user: {
    current: ['user', 'current'] as const,
    session: ['user', 'session'] as const,
  },

  // AI
  ai: {
    conversations: ['ai', 'conversations'] as const,
    conversation: (id: string) => ['ai', 'conversation', id] as const,
  },
} as const;
