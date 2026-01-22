import { RefObject, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { useFolders, useCreateFolder, useDeleteFolder, useUpdateNote, useDeleteNote, useMoveNotesToFolder, useCreateNote, useEvents, useBrainMaps } from '../queries';
import { isSupabaseConfigured } from '../services/supabase';
import type { Note } from '../types';
import type { User } from '@supabase/supabase-js';

function formatNoteDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return format(date, 'EEEE');
  return format(date, 'M/d/yy');
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
  onSignOut,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: folders = [] } = useFolders();
  const { data: events = [] } = useEvents();
  const { data: brainMaps = [] } = useBrainMaps();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const moveNote = useMoveNotesToFolder();
  const createNote = useCreateNote();

  const pendingEventsCount = events.filter(e => e.status !== 'completed').length;
  const isEventsPage = location.pathname === '/events';
  const isCalendarPage = location.pathname === '/calendar';
  const isBrainMapsPage = location.pathname.startsWith('/brain-maps');
  const isDayTrackerPage = location.pathname === '/day-tracker';

  const [contextMenu, setContextMenu] = useState<{ noteId: string; x: number; y: number } | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const folderContextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setShowMoveSubmenu(false);
      }
      if (folderContextMenuRef.current && !folderContextMenuRef.current.contains(e.target as Node)) {
        setFolderContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredNotes = searchQuery
    ? notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const handleCreateFolder = () => {
    const name = prompt('Folder name:');
    if (name?.trim()) createFolder.mutate({ name: name.trim() });
  };

  const handleDeleteFolder = () => {
    if (folderContextMenu && confirm('Delete this folder?')) {
      deleteFolder.mutate(folderContextMenu.folderId);
      if (selectedFolderId === folderContextMenu.folderId) onSelectFolder(null);
    }
    setFolderContextMenu(null);
  };

  const getContextNote = () => notes.find(n => n.id === contextMenu?.noteId);

  const handleTogglePin = () => {
    const note = getContextNote();
    if (note) updateNote.mutate({ id: note.id, data: { is_pinned: !note.is_pinned } });
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
    if (contextMenu) moveNote.mutate({ noteIds: [contextMenu.noteId], folderId });
    setContextMenu(null);
    setShowMoveSubmenu(false);
  };

  const handleDeleteNote = () => {
    if (contextMenu && confirm('Delete this note?')) deleteNote.mutate(contextMenu.noteId);
    setContextMenu(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <nav className="sidebar-nav">
        <button className="sidebar-action" onClick={onCreateNote}>
          NEW NOTE
        </button>

        {/* Library Section */}
        <div className="sidebar-section">
          <div className="sidebar-label">
            <span>LIBRARY</span>
          </div>
          <button
            className={`sidebar-item ${selectedFolderId === null && !isEventsPage && !isCalendarPage && !isBrainMapsPage && !isDayTrackerPage ? 'active' : ''}`}
            onClick={() => { onSelectFolder(null); navigate({ to: '/' }); }}
          >
            <span>All Notes</span>
            <span className="count">{notes.length}</span>
          </button>
        </div>

        {/* Folders Section - Only show if there are folders */}
        {folders.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-label">
              <span>FOLDERS</span>
              <button onClick={handleCreateFolder}>+</button>
            </div>
            {folders.map((folder) => (
              <button
                key={folder.id}
                className={`sidebar-item ${selectedFolderId === folder.id ? 'active' : ''}`}
                onClick={() => onSelectFolder(folder.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setFolderContextMenu({ folderId: folder.id, x: e.clientX, y: e.clientY });
                  setContextMenu(null);
                }}
              >
                {folder.name}
              </button>
            ))}
          </div>
        )}

        {/* Create Folder button when no folders exist */}
        {folders.length === 0 && (
          <div className="sidebar-section">
            <button className="sidebar-item sidebar-item-muted" onClick={handleCreateFolder}>
              <span>+ Create Folder</span>
            </button>
          </div>
        )}

        {/* Tools Section */}
        <div className="sidebar-section">
          <div className="sidebar-label">
            <span>TOOLS</span>
          </div>
          <button
            className={`sidebar-item ${isEventsPage ? 'active' : ''}`}
            onClick={() => navigate({ to: '/events' })}
          >
            <span>Events</span>
            {pendingEventsCount > 0 && <span className="badge">{pendingEventsCount}</span>}
          </button>
          <button
            className={`sidebar-item ${isCalendarPage ? 'active' : ''}`}
            onClick={() => navigate({ to: '/calendar' })}
          >
            <span>Calendar</span>
          </button>
          <button
            className={`sidebar-item ${isBrainMapsPage ? 'active' : ''}`}
            onClick={() => navigate({ to: '/brain-maps' })}
          >
            <span>Brain Maps</span>
            {brainMaps.length > 0 && <span className="count">{brainMaps.length}</span>}
          </button>
          <button
            className={`sidebar-item ${isDayTrackerPage ? 'active' : ''}`}
            onClick={() => navigate({ to: '/day-tracker' })}
          >
            <span>Day Tracker</span>
          </button>
        </div>

        {/* Notes Section - Only show if there are notes or searching */}
        {(sortedNotes.length > 0 || searchQuery || isLoading) && (
          <div className="sidebar-section sidebar-notes">
            <div className="sidebar-label">
              <span>RECENT NOTES</span>
              {sortedNotes.length > 0 && <span className="count">{sortedNotes.length}</span>}
            </div>

            <div className="notes-list">
              {isLoading ? (
                <div className="sidebar-empty">Loading...</div>
              ) : sortedNotes.length === 0 && searchQuery ? (
                <div className="sidebar-empty">No matches</div>
              ) : (
                sortedNotes.map((note) => {
                  const content = stripHtml(note.content);
                  const dateStr = formatNoteDate(note.updated_at);

                  return (
                    <button
                      key={note.id}
                      className={`note-item ${selectedNoteId === note.id ? 'active' : ''} ${note.is_pinned ? 'pinned' : ''}`}
                      onClick={() => onSelectNote(note.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ noteId: note.id, x: e.clientX, y: e.clientY });
                        setFolderContextMenu(null);
                        setShowMoveSubmenu(false);
                      }}
                    >
                      <span className="note-title">{note.title || 'Untitled'}</span>
                      <div className="note-meta">
                        <span className="note-date">{dateStr}</span>
                        <span className="note-snippet">{content.slice(0, 40) || 'No additional text'}</span>
                      </div>
                      {content.length > 40 && (
                        <p className="note-preview">{content.slice(40, 120)}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </nav>

      <footer className="sidebar-footer">
        <button className="sidebar-action" onClick={onOpenSettings}>
          SETTINGS
        </button>

        {isSupabaseConfigured && user && (
          <div className="sidebar-user">
            <span>{user.email?.split('@')[0]}</span>
            <button onClick={onSignOut}>Sign out</button>
          </div>
        )}
      </footer>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={handleTogglePin}>
            {getContextNote()?.is_pinned ? 'UNPIN' : 'PIN'}
          </button>
          <button onClick={handleDuplicate}>DUPLICATE</button>
          <button onClick={() => setShowMoveSubmenu(!showMoveSubmenu)}>MOVE TO</button>
          {showMoveSubmenu && (
            <div className="context-submenu">
              <button onClick={() => handleMoveToFolder(null)}>All Notes</button>
              {folders.map((f) => (
                <button key={f.id} onClick={() => handleMoveToFolder(f.id)}>{f.name}</button>
              ))}
            </div>
          )}
          <hr />
          <button className="danger" onClick={handleDeleteNote}>DELETE</button>
        </div>
      )}

      {folderContextMenu && (
        <div
          ref={folderContextMenuRef}
          className="context-menu"
          style={{ top: folderContextMenu.y, left: folderContextMenu.x }}
        >
          <button className="danger" onClick={handleDeleteFolder}>DELETE FOLDER</button>
        </div>
      )}
    </aside>
  );
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
