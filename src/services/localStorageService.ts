import type { Note, Folder } from '../types';

const KEYS = {
  notes: 'voyena:notes',
  folders: 'voyena:folders',
  settings: 'voyena:settings',
} as const;

class LocalStorageService {
  // ============ Notes ============
  getNotes(): Note[] {
    const data = this.get<Note[]>(KEYS.notes);
    return data ?? [];
  }

  addNote(note: Note): void {
    const notes = this.getNotes();
    notes.unshift(note);
    this.set(KEYS.notes, notes);
  }

  updateNote(id: string, updates: Partial<Note>): Note {
    const notes = this.getNotes();
    const index = notes.findIndex((n) => n.id === id);

    if (index === -1) {
      throw new Error(`Note ${id} not found`);
    }

    const updated = { ...notes[index], ...updates };
    notes[index] = updated;
    this.set(KEYS.notes, notes);
    return updated;
  }

  deleteNote(id: string): void {
    const notes = this.getNotes().filter((n) => n.id !== id);
    this.set(KEYS.notes, notes);
  }

  // ============ Folders ============
  getFolders(): Folder[] {
    const data = this.get<Folder[]>(KEYS.folders);
    return data ?? [];
  }

  addFolder(folder: Folder): void {
    const folders = this.getFolders();
    folders.push(folder);
    this.set(KEYS.folders, folders);
  }

  updateFolder(id: string, updates: Partial<Folder>): Folder {
    const folders = this.getFolders();
    const index = folders.findIndex((f) => f.id === id);

    if (index === -1) {
      throw new Error(`Folder ${id} not found`);
    }

    const updated = { ...folders[index], ...updates };
    folders[index] = updated;
    this.set(KEYS.folders, folders);
    return updated;
  }

  deleteFolder(id: string): void {
    const folders = this.getFolders().filter((f) => f.id !== id);
    this.set(KEYS.folders, folders);
  }

  // ============ Settings ============
  getSetting<T>(key: string, defaultValue: T): T {
    const settings = this.get<Record<string, unknown>>(KEYS.settings) ?? {};
    return (settings[key] as T) ?? defaultValue;
  }

  setSetting<T>(key: string, value: T): void {
    const settings = this.get<Record<string, unknown>>(KEYS.settings) ?? {};
    settings[key] = value;
    this.set(KEYS.settings, settings);
  }

  // ============ Core ============
  private get<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error('[LocalStorage] Failed to save:', error);
    }
  }
}

export const localStorageService = new LocalStorageService();
