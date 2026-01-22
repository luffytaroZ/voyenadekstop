import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brainMapCommands, brainMapNodeCommands, brainMapConnectionCommands } from '../services/tauriCommands';
import { useAuth } from '../contexts/AuthContext';
import type {
  BrainMapCreate,
  BrainMapUpdate,
  BrainMapNodeCreate,
  BrainMapNodeUpdate,
  BrainMapConnectionCreate,
  BrainMapWithData,
} from '../types';

// ============ Brain Map Hooks ============

export function useBrainMaps() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['brainMaps', user?.id],
    queryFn: () => brainMapCommands.getAll(user?.id),
    enabled: true,
  });
}

export function useBrainMap(id: string | null) {
  return useQuery({
    queryKey: ['brainMap', id],
    queryFn: () => (id ? brainMapCommands.getById(id) : null),
    enabled: !!id,
  });
}

export function useCreateBrainMap() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: BrainMapCreate) => brainMapCommands.create(user?.id || '', data),
    onSuccess: (newMap) => {
      queryClient.invalidateQueries({ queryKey: ['brainMaps'] });
      queryClient.setQueryData(['brainMap', newMap.brain_map.id], newMap);
    },
  });
}

export function useUpdateBrainMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BrainMapUpdate }) =>
      brainMapCommands.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['brainMaps'] });
      queryClient.setQueryData<BrainMapWithData | null>(['brainMap', updated.id], (old) =>
        old ? { ...old, brain_map: updated } : null
      );
    },
  });
}

export function useDeleteBrainMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, hard = false }: { id: string; hard?: boolean }) =>
      brainMapCommands.delete(id, hard),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brainMaps'] });
      queryClient.removeQueries({ queryKey: ['brainMap', variables.id] });
    },
  });
}

// ============ Brain Map Node Hooks ============

export function useCreateBrainMapNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BrainMapNodeCreate) => brainMapNodeCommands.create(data),
    onSuccess: (newNode) => {
      queryClient.setQueryData<BrainMapWithData | null>(
        ['brainMap', newNode.brain_map_id],
        (old) => {
          if (!old) return null;
          return {
            ...old,
            nodes: [...old.nodes, newNode],
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['brainMaps'] });
    },
  });
}

export function useUpdateBrainMapNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BrainMapNodeUpdate }) =>
      brainMapNodeCommands.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<BrainMapWithData | null>(
        ['brainMap', updated.brain_map_id],
        (old) => {
          if (!old) return null;
          return {
            ...old,
            nodes: old.nodes.map((n) => (n.id === updated.id ? updated : n)),
          };
        }
      );
    },
  });
}

export function useDeleteBrainMapNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, brainMapId: _ }: { id: string; brainMapId: string }) =>
      brainMapNodeCommands.delete(id),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<BrainMapWithData | null>(
        ['brainMap', variables.brainMapId],
        (old) => {
          if (!old) return null;
          return {
            ...old,
            nodes: old.nodes.filter((n) => n.id !== variables.id),
            connections: old.connections.filter(
              (c) => c.source_node_id !== variables.id && c.target_node_id !== variables.id
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['brainMaps'] });
    },
  });
}

export function useUpdateNodePositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      updates,
      brainMapId: _,
    }: {
      updates: Array<[string, number, number]>;
      brainMapId: string;
    }) => brainMapNodeCommands.updatePositions(updates),
    onMutate: async ({ updates, brainMapId }) => {
      // Optimistic update for smooth dragging
      await queryClient.cancelQueries({ queryKey: ['brainMap', brainMapId] });

      const previousData = queryClient.getQueryData<BrainMapWithData>(['brainMap', brainMapId]);

      if (previousData) {
        const positionMap = new Map(updates.map(([id, x, y]) => [id, { x, y }]));
        queryClient.setQueryData<BrainMapWithData>(['brainMap', brainMapId], {
          ...previousData,
          nodes: previousData.nodes.map((n) => {
            const newPos = positionMap.get(n.id);
            return newPos ? { ...n, x: newPos.x, y: newPos.y } : n;
          }),
        });
      }

      return { previousData };
    },
    onError: (_err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['brainMap', variables.brainMapId], context.previousData);
      }
    },
  });
}

// ============ Brain Map Connection Hooks ============

export function useCreateBrainMapConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BrainMapConnectionCreate) => brainMapConnectionCommands.create(data),
    onSuccess: (newConnection) => {
      queryClient.setQueryData<BrainMapWithData | null>(
        ['brainMap', newConnection.brain_map_id],
        (old) => {
          if (!old) return null;
          return {
            ...old,
            connections: [...old.connections, newConnection],
          };
        }
      );
    },
  });
}

export function useDeleteBrainMapConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, brainMapId: _ }: { id: string; brainMapId: string }) =>
      brainMapConnectionCommands.delete(id),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<BrainMapWithData | null>(
        ['brainMap', variables.brainMapId],
        (old) => {
          if (!old) return null;
          return {
            ...old,
            connections: old.connections.filter((c) => c.id !== variables.id),
          };
        }
      );
    },
  });
}
