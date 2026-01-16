import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersService } from '../services/foldersService';
import { queryKeys } from '../lib/queryClient';
import { useAuth } from '../contexts/AuthContext';
import type { Folder, FolderCreate, FolderUpdate } from '../types';

// Fallback user ID for offline mode (no auth)
const FALLBACK_USER_ID = 'local';

// Helper hook to get current user ID
function useUserId() {
  const { user } = useAuth();
  return user?.id ?? FALLBACK_USER_ID;
}

// ============ Queries ============

export function useFolders() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.folders.list(userId),
    queryFn: () => foldersService.getAll(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useFolder(id: string | null) {
  return useQuery({
    queryKey: queryKeys.folders.detail(id ?? ''),
    queryFn: () => (id ? foldersService.getById(id) : null),
    enabled: !!id,
  });
}

// ============ Mutations ============

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: (data: FolderCreate) => foldersService.create(userId, data),
    onSuccess: (newFolder) => {
      // Optimistically add to list
      queryClient.setQueryData<Folder[]>(queryKeys.folders.list(userId), (old) =>
        old ? [...old, newFolder].sort((a, b) => a.name.localeCompare(b.name)) : [newFolder]
      );

      // Add to detail cache
      queryClient.setQueryData(queryKeys.folders.detail(newFolder.id), newFolder);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.lists() });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FolderUpdate }) =>
      foldersService.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.detail(id) });

      const previousFolder = queryClient.getQueryData<Folder>(
        queryKeys.folders.detail(id)
      );

      if (previousFolder) {
        queryClient.setQueryData(queryKeys.folders.detail(id), {
          ...previousFolder,
          ...data,
          updated_at: new Date().toISOString(),
        });
      }

      return { previousFolder };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousFolder) {
        queryClient.setQueryData(queryKeys.folders.detail(id), context.previousFolder);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: (id: string) => foldersService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.list(userId) });

      const previousFolders = queryClient.getQueryData<Folder[]>(
        queryKeys.folders.list(userId)
      );

      queryClient.setQueryData<Folder[]>(queryKeys.folders.list(userId), (old) =>
        old?.filter((f) => f.id !== id)
      );

      return { previousFolders };
    },
    onError: (_err, _id, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(queryKeys.folders.list(userId), context.previousFolders);
      }
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.folders.detail(id) });
    },
    onSettled: () => {
      // Also invalidate notes since folder deletion may affect them
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
    },
  });
}
