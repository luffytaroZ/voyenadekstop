import { useState, useRef, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from '@tanstack/react-router';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNotes, useCreateNote, useDeleteNote } from '../queries';
import { aiService } from '../services/aiService';
import { storeService } from '../services/storeService';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../services/supabase';
import Sidebar from './Sidebar';
import AIPanel from './AIPanel';
import Settings from './Settings';
import AuthPage from '../pages/AuthPage';
import '../styles/app.css';

export default function RootLayout() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { status, user, signOut } = useAuth();

  // Local UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarLoaded, setSidebarLoaded] = useState(false);
  const [aiPanelOpen, setAIPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusMode, setFocusMode] = useState(false);

  // Get IDs from URL params
  const noteId = (params as { noteId?: string }).noteId ?? null;
  const folderId = (params as { folderId?: string }).folderId ?? null;

  // Data - only fetch if authenticated
  const { data: notes = [], isLoading } = useNotes(folderId);
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  // Load sidebar state from store
  useEffect(() => {
    (async () => {
      try {
        const open = await storeService.getSidebarOpen();
        setSidebarOpen(open);
      } catch (error) {
        console.error('[RootLayout] Failed to load sidebar state:', error);
      } finally {
        setSidebarLoaded(true);
      }
    })();
  }, []);

  // Persist sidebar state
  useEffect(() => {
    if (!sidebarLoaded) return;
    storeService.setSidebarOpen(sidebarOpen).catch((error) => {
      console.error('[RootLayout] Failed to save sidebar state:', error);
    });
  }, [sidebarOpen, sidebarLoaded]);

  // Initialize AI service
  useEffect(() => {
    aiService.initialize();
  }, []);

  // Handlers
  const handleSelectNote = (id: string) => {
    if (folderId) {
      navigate({ to: '/folders/$folderId/notes/$noteId', params: { folderId, noteId: id } });
    } else {
      navigate({ to: '/notes/$noteId', params: { noteId: id } });
    }
  };

  const handleSelectFolder = (id: string | null) => {
    if (id) {
      navigate({ to: '/folders/$folderId', params: { folderId: id } });
    } else {
      navigate({ to: '/' });
    }
  };

  const handleCreateNote = async () => {
    const result = await createNote.mutateAsync({ title: '', content: '' });
    if (result?.id) {
      handleSelectNote(result.id);
    }
  };

  const toggleSidebar = () => setSidebarOpen((prev: boolean) => !prev);
  const toggleAIPanel = () => setAIPanelOpen((prev: boolean) => !prev);
  const toggleFocusMode = () => {
    setFocusMode((prev: boolean) => {
      if (!prev) {
        setAIPanelOpen(false);
      }
      return !prev;
    });
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewNote: handleCreateNote,
    onSearch: () => searchInputRef.current?.focus(),
    onDelete: () => {
      if (noteId) {
        deleteNote.mutate(noteId);
        if (folderId) {
          navigate({ to: '/folders/$folderId', params: { folderId } });
        } else {
          navigate({ to: '/' });
        }
      }
    },
    onToggleSidebar: toggleSidebar,
    onToggleAI: toggleAIPanel,
    onSettings: () => setSettingsOpen(true),
    onEscape: () => {
      setSearchQuery('');
      setSettingsOpen(false);
      if (focusMode) setFocusMode(false);
    },
    onToggleFocus: toggleFocusMode,
  });

  // ========================================
  // AUTH GATE - Show auth FIRST if not signed in
  // ========================================

  // Loading - checking auth status
  if (isSupabaseConfigured && status === 'loading') {
    return (
      <div className="loading-screen">
        <h1 className="auth-logo">Voyena</h1>
        <div className="loading-spinner" />
      </div>
    );
  }

  // Not signed in - show auth page directly
  if (isSupabaseConfigured && status === 'signedOut') {
    return (
      <div className="app">
        <div className="drag-region" />
        <AuthPage />
      </div>
    );
  }

  // ========================================
  // MAIN APP - Only shows if authenticated
  // ========================================

  return (
    <div className={`app ${focusMode ? 'focus-mode' : ''}`}>
      <div className="drag-region" />

      {focusMode && (
        <button
          className="exit-focus-mode"
          onClick={() => setFocusMode(false)}
          title="Exit Focus Mode (Esc)"
        >
          Exit Focus Mode
        </button>
      )}

      {sidebarOpen && !focusMode && (
        <Sidebar
          notes={notes}
          isLoading={isLoading}
          selectedNoteId={noteId}
          selectedFolderId={folderId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectNote={handleSelectNote}
          onSelectFolder={handleSelectFolder}
          onCreateNote={handleCreateNote}
          onOpenSettings={() => setSettingsOpen(true)}
          searchInputRef={searchInputRef}
          user={user}
          onSignOut={signOut}
        />
      )}

      <main className={`main-content ${!sidebarOpen || focusMode ? 'full-width' : ''} ${focusMode ? 'focus-content' : ''}`}>
        <Outlet />
      </main>

      {aiPanelOpen && !focusMode && <AIPanel onClose={() => setAIPanelOpen(false)} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
