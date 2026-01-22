import { invoke } from '@tauri-apps/api/core';
import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Note, NoteCreate, NoteUpdate,
  Folder, FolderCreate, FolderUpdate,
  Event, EventCreate, EventUpdate,
  BrainMap, BrainMapCreate, BrainMapUpdate,
  BrainMapNode, BrainMapNodeCreate, BrainMapNodeUpdate,
  BrainMapConnection, BrainMapConnectionCreate, BrainMapWithData
} from '../types';

// ============ Notes Commands ============

export const notesCommands = {
  async getAll(userId?: string, folderId?: string | null): Promise<Note[]> {
    if (isSupabaseConfigured && userId) {
      let query = supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (folderId) {
        query = query.eq('folder_id', folderId);
      }

      const { data, error } = await query.order('is_pinned', { ascending: false }).order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    // Fallback to local SQLite
    return invoke<Note[]>('get_notes', { folderId: folderId ?? null });
  },

  async getById(id: string): Promise<Note | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    }

    return invoke<Note | null>('get_note', { id });
  },

  async create(userId: string, data: NoteCreate): Promise<Note> {
    if (isSupabaseConfigured && userId) {
      const now = new Date().toISOString();
      const { data: created, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: data.title || '',
          content: data.content || '',
          folder_id: data.folder_id ?? null,
          tags: data.tags ?? [],
          is_pinned: false,
          is_favorite: false,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;
      return created;
    }

    return invoke<Note>('create_note', { data });
  },

  async update(id: string, data: NoteUpdate): Promise<Note> {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data: updated, error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    }

    return invoke<Note>('update_note', { id, data });
  },

  async delete(id: string, hard: boolean = false): Promise<void> {
    if (isSupabaseConfigured) {
      if (hard) {
        await supabase.from('notes').delete().eq('id', id);
      } else {
        await supabase
          .from('notes')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
      }
      return;
    }

    return invoke<void>('delete_note', { id, hard });
  },

  async moveToFolder(noteIds: string[], folderId: string | null): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase
        .from('notes')
        .update({ folder_id: folderId, updated_at: new Date().toISOString() })
        .in('id', noteIds);
      return;
    }

    return invoke<void>('move_notes_to_folder', { noteIds, folderId });
  },

  async search(userId: string, query: string): Promise<Note[]> {
    if (isSupabaseConfigured && userId) {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    }

    // Fallback: client-side search
    const notes = await this.getAll();
    const lowerQuery = query.toLowerCase();
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(lowerQuery) ||
        note.content.toLowerCase().includes(lowerQuery) ||
        note.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  },
};

// ============ Folders Commands ============

export const foldersCommands = {
  async getAll(userId?: string): Promise<Folder[]> {
    if (isSupabaseConfigured && userId) {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data ?? [];
    }

    return invoke<Folder[]>('get_folders');
  },

  async getById(id: string): Promise<Folder | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    }

    const folders = await this.getAll();
    return folders.find((f) => f.id === id) ?? null;
  },

  async create(userId: string, data: FolderCreate): Promise<Folder> {
    if (isSupabaseConfigured && userId) {
      const now = new Date().toISOString();
      const { data: created, error } = await supabase
        .from('folders')
        .insert({
          user_id: userId,
          name: data.name,
          parent_folder_id: data.parent_id ?? null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...created,
        parent_id: created.parent_folder_id,
      };
    }

    return invoke<Folder>('create_folder', { data });
  },

  async update(id: string, data: FolderUpdate): Promise<Folder> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updates.name = data.name;
    if (data.parent_id !== undefined) updates.parent_folder_id = data.parent_id;

    if (isSupabaseConfigured) {
      const { data: updated, error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...updated,
        parent_id: updated.parent_folder_id,
      };
    }

    return invoke<Folder>('update_folder', { id, data });
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      // Move notes in this folder to no folder first
      await supabase
        .from('notes')
        .update({ folder_id: null })
        .eq('folder_id', id);

      await supabase.from('folders').delete().eq('id', id);
      return;
    }

    return invoke<void>('delete_folder', { id });
  },
};

// ============ Events Commands ============

export const eventsCommands = {
  async getAll(userId?: string): Promise<Event[]> {
    if (isSupabaseConfigured && userId) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data ?? [];
    }

    return invoke<Event[]>('get_events');
  },

  async getById(id: string): Promise<Event | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    }

    return invoke<Event | null>('get_event', { id });
  },

  async create(userId: string, data: EventCreate): Promise<Event> {
    if (isSupabaseConfigured && userId) {
      const now = new Date().toISOString();
      const { data: created, error } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          title: data.title,
          description: data.description ?? null,
          start_time: data.start_time ?? null,
          end_time: data.end_time ?? null,
          time_mode: data.time_mode ?? 'at_time',
          duration_minutes: data.duration_minutes ?? null,
          location: data.location ?? null,
          category: data.category ?? 'personal',
          color: data.color ?? null,
          priority: data.priority ?? 'medium',
          tags: data.tags ?? [],
          show_on_calendar: data.show_on_calendar ?? true,
          is_all_day: data.is_all_day ?? false,
          is_recurring: data.is_recurring ?? false,
          recurring_pattern: data.recurring_pattern ?? null,
          reminders: data.reminders ?? [],
          status: 'pending',
          has_scheduled_time: data.start_time != null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;
      return created;
    }

    return invoke<Event>('create_event', { data });
  },

  async update(id: string, data: EventUpdate): Promise<Event> {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data: updated, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    }

    return invoke<Event>('update_event', { id, data });
  },

  async delete(id: string, hard: boolean = false): Promise<void> {
    if (isSupabaseConfigured) {
      if (hard) {
        await supabase.from('events').delete().eq('id', id);
      } else {
        await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
      }
      return;
    }

    return invoke<void>('delete_event', { id, hard });
  },

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<Event[]> {
    if (isSupabaseConfigured && userId) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('start_time', startDate)
        .lte('start_time', endDate)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data ?? [];
    }

    // Fallback: client-side filtering
    const events = await this.getAll();
    return events.filter((event) => {
      if (!event.start_time) return false;
      return event.start_time >= startDate && event.start_time <= endDate;
    });
  },
};

// ============ Settings Commands ============

export const settingsCommands = {
  async get(key: string): Promise<string | null> {
    return invoke<string | null>('get_setting', { key });
  },

  async set(key: string, value: string): Promise<void> {
    return invoke<void>('set_setting', { key, value });
  },
};

// ============ Brain Map Commands ============

export const brainMapCommands = {
  async getAll(userId?: string): Promise<BrainMap[]> {
    if (isSupabaseConfigured && userId) {
      const { data, error } = await supabase
        .from('brain_maps')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    }

    return invoke<BrainMap[]>('get_brain_maps');
  },

  async getById(id: string): Promise<BrainMapWithData | null> {
    if (isSupabaseConfigured) {
      // Get brain map
      const { data: brainMap, error: mapError } = await supabase
        .from('brain_maps')
        .select('*')
        .eq('id', id)
        .single();

      if (mapError) {
        if (mapError.code === 'PGRST116') return null;
        throw mapError;
      }

      // Get nodes
      const { data: nodes, error: nodesError } = await supabase
        .from('brain_map_nodes')
        .select('*')
        .eq('brain_map_id', id)
        .order('layer', { ascending: true })
        .order('created_at', { ascending: true });

      if (nodesError) throw nodesError;

      // Get connections
      const { data: connections, error: connError } = await supabase
        .from('brain_map_connections')
        .select('*')
        .eq('brain_map_id', id);

      if (connError) throw connError;

      return {
        brain_map: brainMap,
        nodes: nodes ?? [],
        connections: connections ?? [],
      };
    }

    return invoke<BrainMapWithData | null>('get_brain_map', { id });
  },

  async create(userId: string, data: BrainMapCreate): Promise<BrainMapWithData> {
    if (isSupabaseConfigured && userId) {
      const now = new Date().toISOString();
      const centerNodeText = data.center_node_text || 'Central Idea';

      // Create brain map
      const { data: brainMap, error: mapError } = await supabase
        .from('brain_maps')
        .insert({
          user_id: userId,
          title: data.title || 'Untitled Map',
          description: data.description ?? null,
          center_node_text: centerNodeText,
          viewport_x: 0,
          viewport_y: 0,
          viewport_zoom: 1.0,
          theme: data.theme ?? 'default',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (mapError) throw mapError;

      // Create center node
      const { data: centerNode, error: nodeError } = await supabase
        .from('brain_map_nodes')
        .insert({
          brain_map_id: brainMap.id,
          label: centerNodeText,
          x: 0,
          y: 0,
          color: '#6366f1',
          shape: 'circle',
          size: 'large',
          is_collapsed: false,
          layer: 0,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (nodeError) throw nodeError;

      // Update brain map with center node id
      await supabase
        .from('brain_maps')
        .update({ center_node_id: centerNode.id })
        .eq('id', brainMap.id);

      return {
        brain_map: { ...brainMap, center_node_id: centerNode.id },
        nodes: [centerNode],
        connections: [],
      };
    }

    return invoke<BrainMapWithData>('create_brain_map', { data });
  },

  async update(id: string, data: BrainMapUpdate): Promise<BrainMap> {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data: updated, error } = await supabase
        .from('brain_maps')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    }

    return invoke<BrainMap>('update_brain_map', { id, data });
  },

  async delete(id: string, hard: boolean = false): Promise<void> {
    if (isSupabaseConfigured) {
      if (hard) {
        // Delete connections first, then nodes, then map
        await supabase.from('brain_map_connections').delete().eq('brain_map_id', id);
        await supabase.from('brain_map_nodes').delete().eq('brain_map_id', id);
        await supabase.from('brain_maps').delete().eq('id', id);
      } else {
        await supabase
          .from('brain_maps')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
      }
      return;
    }

    return invoke<void>('delete_brain_map', { id, hard });
  },
};

// ============ Brain Map Node Commands ============

export const brainMapNodeCommands = {
  async create(data: BrainMapNodeCreate): Promise<BrainMapNode> {
    if (isSupabaseConfigured) {
      const now = new Date().toISOString();

      // Calculate layer based on parent
      let layer = 1;
      if (data.parent_node_id) {
        const { data: parent } = await supabase
          .from('brain_map_nodes')
          .select('layer')
          .eq('id', data.parent_node_id)
          .single();
        if (parent) layer = parent.layer + 1;
      }

      const { data: node, error } = await supabase
        .from('brain_map_nodes')
        .insert({
          brain_map_id: data.brain_map_id,
          parent_node_id: data.parent_node_id ?? null,
          label: data.label,
          description: data.description ?? null,
          x: data.x ?? 0,
          y: data.y ?? 0,
          color: data.color ?? null,
          shape: data.shape ?? 'circle',
          size: data.size ?? 'medium',
          icon: data.icon ?? null,
          linked_note_id: data.linked_note_id ?? null,
          linked_folder_id: data.linked_folder_id ?? null,
          is_collapsed: false,
          layer,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      // Update brain map's updated_at
      await supabase
        .from('brain_maps')
        .update({ updated_at: now })
        .eq('id', data.brain_map_id);

      return node;
    }

    return invoke<BrainMapNode>('create_brain_map_node', { data });
  },

  async update(id: string, data: BrainMapNodeUpdate): Promise<BrainMapNode> {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data: updated, error } = await supabase
        .from('brain_map_nodes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    }

    return invoke<BrainMapNode>('update_brain_map_node', { id, data });
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      // Get brain_map_id first for updating timestamp
      const { data: node } = await supabase
        .from('brain_map_nodes')
        .select('brain_map_id')
        .eq('id', id)
        .single();

      // Delete connections involving this node
      await supabase
        .from('brain_map_connections')
        .delete()
        .or(`source_node_id.eq.${id},target_node_id.eq.${id}`);

      // Delete the node
      await supabase.from('brain_map_nodes').delete().eq('id', id);

      // Update brain map timestamp
      if (node) {
        await supabase
          .from('brain_maps')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', node.brain_map_id);
      }
      return;
    }

    return invoke<void>('delete_brain_map_node', { id });
  },

  async updatePositions(updates: Array<[string, number, number]>): Promise<void> {
    if (isSupabaseConfigured) {
      const now = new Date().toISOString();
      for (const [id, x, y] of updates) {
        await supabase
          .from('brain_map_nodes')
          .update({ x, y, updated_at: now })
          .eq('id', id);
      }
      return;
    }

    return invoke<void>('update_node_positions', { updates });
  },
};

// ============ Brain Map Connection Commands ============

export const brainMapConnectionCommands = {
  async create(data: BrainMapConnectionCreate): Promise<BrainMapConnection> {
    if (isSupabaseConfigured) {
      const now = new Date().toISOString();

      const { data: connection, error } = await supabase
        .from('brain_map_connections')
        .insert({
          brain_map_id: data.brain_map_id,
          source_node_id: data.source_node_id,
          target_node_id: data.target_node_id,
          label: data.label ?? null,
          color: data.color ?? null,
          style: data.style ?? 'solid',
          animated: data.animated ?? false,
          created_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      // Update brain map's updated_at
      await supabase
        .from('brain_maps')
        .update({ updated_at: now })
        .eq('id', data.brain_map_id);

      return connection;
    }

    return invoke<BrainMapConnection>('create_brain_map_connection', { data });
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.from('brain_map_connections').delete().eq('id', id);
      return;
    }

    return invoke<void>('delete_brain_map_connection', { id });
  },
};
