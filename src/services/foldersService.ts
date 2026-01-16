import { supabase, isSupabaseConfigured } from './supabase';
import { localStorageService } from './localStorageService';
import type { Folder, FolderCreate, FolderUpdate } from '../types';

const generateId = () => `folder_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

class FoldersService {
  // ============ Fetch ============
  async getAll(userId: string): Promise<Folder[]> {
    if (!isSupabaseConfigured) {
      return localStorageService.getFolders();
    }

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getById(id: string): Promise<Folder | null> {
    if (!isSupabaseConfigured) {
      const folders = localStorageService.getFolders();
      return folders.find((f) => f.id === id) ?? null;
    }

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

  // ============ Create ============
  async create(userId: string, data: FolderCreate): Promise<Folder> {
    const now = new Date().toISOString();
    const newFolder: Folder = {
      id: generateId(),
      user_id: userId,
      name: data.name,
      parent_id: data.parent_id ?? null,
      color: data.color ?? null,
      icon: data.icon ?? null,
      created_at: now,
      updated_at: now,
    };

    if (!isSupabaseConfigured) {
      localStorageService.addFolder(newFolder);
      return newFolder;
    }

    const { data: created, error } = await supabase
      .from('folders')
      .insert({
        user_id: userId,
        name: newFolder.name,
        parent_id: newFolder.parent_id,
        color: newFolder.color,
        icon: newFolder.icon,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  // ============ Update ============
  async update(id: string, data: FolderUpdate): Promise<Folder> {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      return localStorageService.updateFolder(id, updates);
    }

    const { data: updated, error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }

  // ============ Delete ============
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      localStorageService.deleteFolder(id);
      return;
    }

    await supabase.from('folders').delete().eq('id', id);
  }
}

export const foldersService = new FoldersService();
