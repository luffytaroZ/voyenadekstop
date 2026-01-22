import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsCommands } from '../services/tauriCommands';
import { queryKeys } from '../lib/queryClient';
import { useAuth } from '../contexts/AuthContext';
import type { Event, EventCreate, EventUpdate } from '../types';

// ============ Queries ============

export function useEvents() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.events.list({ userId }),
    queryFn: () => eventsCommands.getAll(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: queryKeys.events.detail(id ?? ''),
    queryFn: () => (id ? eventsCommands.getById(id) : null),
    enabled: !!id,
  });
}

export function useEventsByDateRange(startDate: string, endDate: string) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: queryKeys.events.list({ userId, startDate, endDate }),
    queryFn: () => eventsCommands.getByDateRange(userId, startDate, endDate),
    enabled: !!userId && !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}

// ============ Mutations ============

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: EventCreate) => eventsCommands.create(user?.id ?? '', data),
    onSuccess: (newEvent) => {
      // Invalidate all event lists
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });

      // Add to cache immediately
      queryClient.setQueryData(queryKeys.events.detail(newEvent.id), newEvent);
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EventUpdate }) =>
      eventsCommands.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.events.detail(id) });

      // Snapshot previous value
      const previousEvent = queryClient.getQueryData<Event>(
        queryKeys.events.detail(id)
      );

      // Optimistically update
      if (previousEvent) {
        queryClient.setQueryData(queryKeys.events.detail(id), {
          ...previousEvent,
          ...data,
          updated_at: new Date().toISOString(),
        });
      }

      return { previousEvent };
    },
    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previousEvent) {
        queryClient.setQueryData(queryKeys.events.detail(id), context.previousEvent);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => eventsCommands.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.events.lists() });

      // Get all cached event lists
      const previousLists = queryClient.getQueriesData<Event[]>({
        queryKey: queryKeys.events.lists(),
      });

      // Optimistically remove from all lists
      previousLists.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData(
            key,
            data.filter((e) => e.id !== id)
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
      queryClient.removeQueries({ queryKey: queryKeys.events.detail(id) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
    },
  });
}

export function useToggleEventStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Event['status'] }) =>
      eventsCommands.update(id, { status }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
    },
  });
}
