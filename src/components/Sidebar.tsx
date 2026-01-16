import { RefObject, useState, useRef, useEffect } from 'react';
import { useFolders, useCreateFolder, useUpdateNote, useDeleteNote, useMoveNotesToFolder, useCreateNote } from '../queries';
import { SHORTCUT_LABELS } from '../hooks/useKeyboardShortcuts';
import { isSupabaseConfigured } from '../services/supabase';
import type { Note } from '../types';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface SidebarProps {
  notes: Note[];
  isLoading: boolean;
  selectedNoteId: string | null;
  selectedFolderId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectNote: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  onCreateNote: () => void;
  onOpenSettings: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  user?: User | null;
  profile?: Profile | null;
  onSignOut?: () => void;
}

export default function Sidebar({
  notes,
  isLoading,
  selectedNoteId,
  selectedFolderId,
  searchQuery,
  onSearchChange,
  onSelectNote,
  onSelectFolder,
  onCreateNote,
  onOpenSettings,
  searchInputRef,
  user,
  profile,
  onSignOut,
}: SidebarProps) {
  const { data: folders = [] } = useFolders();
  const createFolder = useCreateFolder();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const moveNote = useMoveNotesToFolder();
  const createNote = useCreateNote();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ noteId: string; x: number; y: number } | null>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setShowMoveSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    setContextMenu({ noteId, x: e.clientX, y: e.clientY });
    setShowMoveSubmenu(false);
  };

  const getContextNote = () => notes.find(n => n.id === contextMenu?.noteId);

  const handleTogglePin = () => {
    const note = getContextNote();
    if (note) {
      updateNote.mutate({ id: note.id, data: { is_pinned: !note.is_pinned } });
    }
    setContextMenu(null);
  };

  const handleDuplicate = async () => {
    const note = getContextNote();
    if (note) {
      await createNote.mutateAsync({
        title: `${note.title} (Copy)`,
        content: note.content,
        folder_id: note.folder_id,
      });
    }
    setContextMenu(null);
  };

  const handleMoveToFolder = (folderId: string | null) => {
    if (contextMenu) {
      moveNote.mutate({ noteIds: [contextMenu.noteId], folderId });
    }
    setContextMenu(null);
    setShowMoveSubmenu(false);
  };

  const handleDeleteNote = () => {
    if (contextMenu && confirm('Are you sure you want to delete this note?')) {
      deleteNote.mutate(contextMenu.noteId);
    }
    setContextMenu(null);
  };

  // Filter notes by search
  const filteredNotes = searchQuery
    ? notes.filter(
        (note) =>
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  // Sort: pinned first, then by updated_at
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const handleCreateFolder = () => {
    const name = prompt('Folder name:');
    if (name?.trim()) {
      createFolder.mutate({ name: name.trim() });
    }
  };

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="workspace-selector">
          <span className="workspace-icon">V</span>
          <span className="workspace-name">Voyena</span>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <input
          ref={searchInputRef}
          type="text"
          placeholder={`Search... ${SHORTCUT_LABELS.search}`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {/* New Note Button */}
        <button className="nav-item new-note" onClick={onCreateNote}>
          <span className="nav-icon">+</span>
          <span>New Note</span>
          <span className="shortcut">{SHORTCUT_LABELS.newNote}</span>
        </button>

        {/* Folders Section */}
        <div className="nav-section">
          <div className="nav-section-header">
            <span>Folders</span>
            <button className="add-button" onClick={handleCreateFolder} title="New Folder">
              +
            </button>
          </div>

          <div className="folders-list">
            {/* All Notes */}
            <button
              className={`folder-item ${selectedFolderId === null ? 'selected' : ''}`}
              onClick={() => onSelectFolder(null)}
            >
              <span className="folder-icon">/</span>
              <span>All Notes</span>
              <span className="count">{notes.length}</span>
            </button>

            {/* User Folders */}
            {folders.map((folder) => (
              <button
                key={folder.id}
                className={`folder-item ${selectedFolderId === folder.id ? 'selected' : ''}`}
                onClick={() => onSelectFolder(folder.id)}
              >
                <span className="folder-icon">{folder.icon || '/'}</span>
                <span>{folder.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes Section */}
        <div className="nav-section">
          <div className="nav-section-header">
            <span>Notes</span>
            <span className="note-count">{sortedNotes.length}</span>
          </div>

          <div className="notes-list">
            {isLoading ? (
              <div className="loading-notes">Loading...</div>
            ) : sortedNotes.length === 0 ? (
              <div className="empty-notes">
                {searchQuery ? 'No matching notes' : 'No notes yet'}
              </div>
            ) : (
              sortedNotes.map((note) => (
                <button
                  key={note.id}
                  className={`note-item ${selectedNoteId === note.id ? 'selected' : ''} ${note.is_pinned ? 'pinned' : ''}`}
                  onClick={() => onSelectNote(note.id)}
                  onContextMenu={(e) => handleContextMenu(e, note.id)}
                >
                  <div className="note-info">
                    <span className="note-title">{note.title || 'Untitled'}</span>
                    <span className="note-preview">
                      {stripHtml(note.content).slice(0, 50) || 'Empty note'}
                    </span>
                  </div>
                  {note.is_pinned && <span className="pin-indicator">*</span>}
                </button>
              ))
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="settings-button" onClick={onOpenSettings}>
          <span>Settings</span>
          <span className="shortcut">{SHORTCUT_LABELS.settings}</span>
        </button>
      </div>

      {/* User Menu */}
      {isSupabaseConfigured && user && (
        <div className="user-menu">
          <div className="user-info">
            <div className="user-avatar">
              {getInitials(profile?.full_name || user.email || 'U')}
            </div>
            <div className="user-details">
              <div className="user-name">
                {profile?.full_name || 'User'}
              </div>
              <div className="user-email">
                {user.email}
              </div>
            </div>
          </div>
          <button className="signout-button" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={handleTogglePin}>
            {getContextNote()?.is_pinned ? 'Unpin' : 'Pin to top'}
          </button>
          <button onClick={handleDuplicate}>
            Duplicate
          </button>
          <button onClick={() => setShowMoveSubmenu(!showMoveSubmenu)}>
            Move to folder
          </button>
          {showMoveSubmenu && (
            <div className="context-submenu">
              <button onClick={() => handleMoveToFolder(null)}>
                All Notes
              </button>
              {folders.map((folder) => (
                <button key={folder.id} onClick={() => handleMoveToFolder(folder.id)}>
                  {folder.name}
                </button>
              ))}
            </div>
          )}
          <div className="context-divider" />
          <button onClick={handleDeleteNote} className="danger">
            Delete
          </button>
        </div>
      )}
    </aside>
  );
}

// Get initials from name or email
function getInitials(name: string): string {
  const parts = name.split(/[@\s]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Helper to strip HTML for preview
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
