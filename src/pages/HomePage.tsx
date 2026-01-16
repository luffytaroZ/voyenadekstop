import { useNavigate, useParams } from '@tanstack/react-router';
import { useCreateNote } from '../queries';

export default function HomePage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const folderId = (params as { folderId?: string }).folderId ?? null;
  const createNote = useCreateNote();

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

  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <h2>Welcome to Voyena</h2>
        <p>Select a note or create a new one to get started</p>
        <button
          className="create-button"
          onClick={handleCreateNote}
          disabled={createNote.isPending}
        >
          {createNote.isPending ? 'Creating...' : 'Create Note'}
        </button>
        <div className="shortcuts-hint">
          <span>⌘N</span> New Note
          <span>⌘F</span> Search
          <span>⌘J</span> AI Assistant
        </div>
      </div>
    </div>
  );
}
