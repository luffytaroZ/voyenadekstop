// ============ Note Types ============
export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  folder_id: string | null;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type NoteCreate = Pick<Note, 'title' | 'content'> & {
  folder_id?: string | null;
  tags?: string[];
};

export type NoteUpdate = Partial<Pick<Note, 'title' | 'content' | 'folder_id' | 'tags' | 'is_pinned'>>;

// ============ Folder Types ============
export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export type FolderCreate = Pick<Folder, 'name'> & {
  parent_id?: string | null;
  color?: string;
  icon?: string;
};

export type FolderUpdate = Partial<Pick<Folder, 'name' | 'parent_id' | 'color' | 'icon'>>;

// ============ Auth Types ============
export interface User {
  id: string;
  email: string;
  created_at: string;
}

// ============ AI Types ============
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AIConversation {
  id: string;
  messages: AIMessage[];
  created_at: string;
}

// ============ UI Types ============
export type Theme = 'light' | 'dark' | 'sepia' | 'high-contrast' | 'system';

export type SortOption = 'updated_at' | 'created_at' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface ViewOptions {
  sortBy: SortOption;
  sortDirection: SortDirection;
  showPinned: boolean;
}
