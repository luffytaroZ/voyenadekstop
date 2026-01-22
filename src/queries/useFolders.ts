import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersCommands } from '../services/tauriCommands';
import { queryKeys } from '../lib/queryClient';
import { useAuth } from '../contexts/AuthContext';
import type { Folder, FolderCreate, FolderUpdate } from '../types';

// ============ Queries ============

export function useFolders() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: [...queryKeys.folders.lists(), userId],
    queryFn: () => foldersCommands.getAll(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useFolder(id: string | null) {
  return useQuery({
    queryKey: queryKeys.folders.detail(id ?? ''),
    queryFn: () => (id ? foldersCommands.getById(id) : null),
    enabled: !!id,
  });
}

// ============ Mutations ============

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: FolderCreate) => foldersCommands.create(user?.id ?? '', data),
    onSuccess: (newFolder) => {
      // Optimistically add to list
      queryClient.setQueryData<Folder[]>(queryKeys.folders.lists(), (old) =>
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
      foldersCommands.update(id, data),
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

  return useMutation({
    mutationFn: (id: string) => foldersCommands.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.lists() });

      const previousFolders = queryClient.getQueryData<Folder[]>(
        queryKeys.folders.lists()
      );

      queryClient.setQueryData<Folder[]>(queryKeys.folders.lists(), (old) =>
        old?.filter((f) => f.id !== id)
      );

      return { previousFolders };
    },
    onError: (_err, _id, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(queryKeys.folders.lists(), context.previousFolders);
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
