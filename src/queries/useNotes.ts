import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesService } from '../services/notesService';
import { queryKeys } from '../lib/queryClient';
import { useAuth } from '../contexts/AuthContext';
import type { Note, NoteCreate, NoteUpdate } from '../types';

// Fallback user ID for offline mode (no auth)
const FALLBACK_USER_ID = 'local';

// Helper hook to get current user ID
function useUserId() {
  const { user } = useAuth();
  return user?.id ?? FALLBACK_USER_ID;
}

// ============ Queries ============

export function useNotes(folderId?: string | null) {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.notes.list({ folderId, userId }),
    queryFn: () =>
      folderId !== undefined
        ? notesService.getByFolder(userId, folderId)
        : notesService.getAll(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: queryKeys.notes.detail(id ?? ''),
    queryFn: () => (id ? notesService.getById(id) : null),
    enabled: !!id,
  });
}

export function useSearchNotes(query: string) {
  const userId = useUserId();

  return useQuery({
    queryKey: ['notes', 'search', query, userId],
    queryFn: () => notesService.search(userId, query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============ Mutations ============

export function useCreateNote() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: (data: NoteCreate) => notesService.create(userId, data),
    onSuccess: (newNote) => {
      // Invalidate all note lists
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });

      // Add to cache immediately
      queryClient.setQueryData(queryKeys.notes.detail(newNote.id), newNote);
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteUpdate }) =>
      notesService.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(id) });

      // Snapshot previous value
      const previousNote = queryClient.getQueryData<Note>(
        queryKeys.notes.detail(id)
      );

      // Optimistically update
      if (previousNote) {
        queryClient.setQueryData(queryKeys.notes.detail(id), {
          ...previousNote,
          ...data,
          updated_at: new Date().toISOString(),
        });
      }

      return { previousNote };
    },
    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previousNote) {
        queryClient.setQueryData(queryKeys.notes.detail(id), context.previousNote);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notesService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.lists() });

      // Get all cached note lists
      const previousLists = queryClient.getQueriesData<Note[]>({
        queryKey: queryKeys.notes.lists(),
      });

      // Optimistically remove from all lists
      previousLists.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData(
            key,
            data.filter((n) => n.id !== id)
          );
        }
      });

      return { previousLists };
    },
    onError: (_err, _id, context) => {
      // Rollback
      context?.previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (_data, id) => {
      // Clear from detail cache
      queryClient.removeQueries({ queryKey: queryKeys.notes.detail(id) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
    },
  });
}

export function useMoveNotesToFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteIds, folderId }: { noteIds: string[]; folderId: string | null }) =>
      notesService.moveToFolder(noteIds, folderId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
    },
  });
}
