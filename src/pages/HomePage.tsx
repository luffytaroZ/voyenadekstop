import { useNavigate, useParams } from '@tanstack/react-router';
import { useNotes, useCreateNote, useFolders } from '../queries';

export default function HomePage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const folderId = (params as { folderId?: string }).folderId ?? null;

  const { data: notes = [], isLoading } = useNotes(folderId);
  const { data: folders = [] } = useFolders();
  const createNote = useCreateNote();

  const currentFolder = folderId ? folders.find(f => f.id === folderId) : null;

  const handleCreateNote = async () => {
    const result = await createNote.mutateAsync({
      title: '',
      content: '',
      folder_id: folderId ?? undefined,
    });
    if (result?.id) {
      if (folderId) {
        navigate({ to: '/folders/$folderId/notes/$noteId', params: { folderId, noteId: result.id } });
      } else {
        navigate({ to: '/notes/$noteId', params: { noteId: result.id } });
      }
    }
  };

  const handleSelectNote = (noteId: string) => {
    if (folderId) {
      navigate({ to: '/folders/$folderId/notes/$noteId', params: { folderId, noteId } });
    } else {
      navigate({ to: '/notes/$noteId', params: { noteId } });
    }
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'TODAY';
    if (days === 1) return 'YESTERDAY';
    if (days < 7) return `${days} DAYS AGO`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  };

  const stripHtml = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  if (isLoading) {
    return (
      <div className="notes-page">
        <div className="notes-page-empty">
          <span className="loading-text">LOADING</span>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-page">
      <header className="notes-page-header">
        <span className="notes-page-label">
          {currentFolder ? currentFolder.name.toUpperCase() : 'ALL NOTES'}
        </span>
        <span className="notes-page-count">{notes.length}</span>
      </header>

      {sortedNotes.length === 0 ? (
        <div className="notes-page-empty">
          <p className="empty-title">NO NOTES YET</p>
          <p className="empty-subtitle">Create your first note to get started</p>
          <button className="empty-action" onClick={handleCreateNote}>
            CREATE NOTE
          </button>
        </div>
      ) : (
        <div className="notes-page-list">
          {sortedNotes.map((note) => (
            <button
              key={note.id}
              className={`notes-page-item ${note.is_pinned ? 'pinned' : ''}`}
              onClick={() => handleSelectNote(note.id)}
            >
              <div className="item-header">
                <span className="item-title">{note.title || 'Untitled'}</span>
                <span className="item-date">{formatDate(note.updated_at)}</span>
              </div>
              <p className="item-preview">
                {stripHtml(note.content).slice(0, 120) || 'Empty note'}
              </p>
              {note.is_pinned && <span className="item-pinned">PINNED</span>}
            </button>
          ))}
        </div>
      )}

      <button className="notes-page-fab" onClick={handleCreateNote}>
        NEW NOTE
      </button>
    </div>
  );
}
