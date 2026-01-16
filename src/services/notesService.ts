import { supabase, isSupabaseConfigured } from './supabase';
import { localStorageService } from './localStorageService';
import type { Note, NoteCreate, NoteUpdate } from '../types';

const generateId = () => `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

class NotesService {
  // ============ Fetch ============
  async getAll(userId: string): Promise<Note[]> {
    if (!isSupabaseConfigured) {
      return localStorageService.getNotes();
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getById(id: string): Promise<Note | null> {
    if (!isSupabaseConfigured) {
      const notes = localStorageService.getNotes();
      return notes.find((n) => n.id === id) ?? null;
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  async getByFolder(userId: string, folderId: string | null): Promise<Note[]> {
    if (!isSupabaseConfigured) {
      const notes = localStorageService.getNotes();
      return notes.filter((n) => n.folder_id === folderId);
    }

    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (folderId) {
      query = query.eq('folder_id', folderId);
    } else {
      query = query.is('folder_id', null);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async search(userId: string, query: string): Promise<Note[]> {
    if (!isSupabaseConfigured) {
      const notes = localStorageService.getNotes();
      const q = query.toLowerCase();
      return notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

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

  // ============ Create ============
  async create(userId: string, data: NoteCreate): Promise<Note> {
    const now = new Date().toISOString();
    const newNote: Note = {
      id: generateId(),
      user_id: userId,
      title: data.title || '',
      content: data.content || '',
      folder_id: data.folder_id ?? null,
      tags: data.tags ?? [],
      is_pinned: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (!isSupabaseConfigured) {
      localStorageService.addNote(newNote);
      return newNote;
    }

    const { data: created, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title: newNote.title,
        content: newNote.content,
        folder_id: newNote.folder_id,
        tags: newNote.tags,
        is_pinned: false,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  // ============ Update ============
  async update(id: string, data: NoteUpdate): Promise<Note> {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      return localStorageService.updateNote(id, updates);
    }

    const { data: updated, error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }

  // ============ Delete ============
  async delete(id: string, soft = true): Promise<void> {
    if (!isSupabaseConfigured) {
      localStorageService.deleteNote(id);
      return;
    }

    if (soft) {
      // Soft delete
      await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    } else {
      // Hard delete
      await supabase.from('notes').delete().eq('id', id);
    }
  }

  // ============ Bulk Operations ============
  async moveToFolder(noteIds: string[], folderId: string | null): Promise<void> {
    if (!isSupabaseConfigured) {
      noteIds.forEach((id) => {
        localStorageService.updateNote(id, { folder_id: folderId });
      });
      return;
    }

    await supabase
      .from('notes')
      .update({ folder_id: folderId, updated_at: new Date().toISOString() })
      .in('id', noteIds);
  }
}

export const notesService = new NotesService();
