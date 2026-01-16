import { useParams, useNavigate } from '@tanstack/react-router';
import { useNote } from '../queries';
import NoteEditor from '../components/NoteEditor';

export default function NotePage() {
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const noteId = (params as { noteId?: string }).noteId;
  const folderId = (params as { folderId?: string }).folderId ?? null;

  const { data: note, isLoading, error } = useNote(noteId ?? null);

  if (!noteId) {
    // Redirect to home if no noteId
    if (folderId) {
      navigate({ to: '/folders/$folderId', params: { folderId } });
    } else {
      navigate({ to: '/' });
    }
    return null;
  }

  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Loading note...</p>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="error-state">
        <h2>Note not found</h2>
        <p>The note you're looking for doesn't exist or has been deleted.</p>
        <button
          className="back-button"
          onClick={() => {
            if (folderId) {
              navigate({ to: '/folders/$folderId', params: { folderId } });
            } else {
              navigate({ to: '/' });
            }
          }}
        >
          Go back
        </button>
      </div>
    );
  }

  const handleNoteDeleted = () => {
    if (folderId) {
      navigate({ to: '/folders/$folderId', params: { folderId } });
    } else {
      navigate({ to: '/' });
    }
  };

  return <NoteEditor note={note} onNoteDeleted={handleNoteDeleted} />;
}
