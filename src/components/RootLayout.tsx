import { useState, useRef, useEffect } from 'react';
import { Outlet, useParams, useNavigate, useRouter } from '@tanstack/react-router';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNotes, useCreateNote, useDeleteNote } from '../queries';
import { aiService } from '../services/aiService';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../services/supabase';
import Sidebar from './Sidebar';
import AIPanel from './AIPanel';
import Settings from './Settings';
import '../styles/app.css';

export default function RootLayout() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const router = useRouter();
  const params = useParams({ strict: false });
  const { status, user, profile, signOut } = useAuth();

  // Check if we're on the auth page
  const isAuthPage = router.state.location.pathname === '/auth';

  // Local UI state (replaces Zustand)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem('voyena:sidebarOpen');
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [aiPanelOpen, setAIPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get IDs from URL params
  const noteId = (params as { noteId?: string }).noteId ?? null;
  const folderId = (params as { folderId?: string }).folderId ?? null;

  // Data
  const { data: notes = [], isLoading } = useNotes(folderId);
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('voyena:sidebarOpen', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  // Initialize AI service
  useEffect(() => {
    aiService.initialize();
  }, []);

  // Auth redirect logic
  useEffect(() => {
    // Only redirect if Supabase is configured
    if (!isSupabaseConfigured) return;

    if (status === 'signedOut' && !isAuthPage) {
      navigate({ to: '/auth' });
    } else if (status === 'signedIn' && isAuthPage) {
      navigate({ to: '/' });
    }
  }, [status, isAuthPage, navigate]);

  // Theme is handled by ThemeContext/ThemeProvider in main.tsx

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
    },
  });

  // Show loading screen while checking auth
  if (isSupabaseConfigured && status === 'loading') {
    return (
      <div className="loading-screen">
        <h1 className="auth-logo">Voyena</h1>
        <div className="loading-spinner" />
      </div>
    );
  }

  // Show auth page (no sidebar)
  if (isAuthPage) {
    return (
      <div className="app">
        <div className="drag-region" />
        <Outlet />
      </div>
    );
  }

  return (
    <div className="app">
      {/* Draggable region for window controls */}
      <div className="drag-region" />

      {/* Sidebar */}
      {sidebarOpen && (
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
          profile={profile}
          onSignOut={signOut}
        />
      )}

      {/* Main content */}
      <main className={`main-content ${!sidebarOpen ? 'full-width' : ''}`}>
        <Outlet />
      </main>

      {/* AI Panel */}
      {aiPanelOpen && <AIPanel onClose={() => setAIPanelOpen(false)} />}

      {/* Settings Modal */}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
