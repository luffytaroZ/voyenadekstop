import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useUpdateNote, useCreateNote, useDeleteNote, useMoveNotesToFolder, useFolders } from '../queries';
import { format } from 'date-fns';
import type { Note } from '../types';

interface NoteEditorProps {
  note: Note;
  onNoteDeleted?: () => void;
}

export default function NoteEditor({ note, onNoteDeleted }: NoteEditorProps) {
  const updateNote = useUpdateNote();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const moveNote = useMoveNotesToFolder();
  const { data: folders = [] } = useFolders();

  const [title, setTitle] = useState(note.title);
  const [showActions, setShowActions] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Debounced save
  const saveContent = useCallback(
    (content: string) => {
      updateNote.mutate({ id: note.id, data: { content } });
    },
    [note.id, updateNote]
  );

  const saveTitle = useCallback(
    (newTitle: string) => {
      updateNote.mutate({ id: note.id, data: { title: newTitle } });
    },
    [note.id, updateNote]
  );

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: note.content,
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      saveContent(editor.getHTML());
    },
  });

  // Update editor when note changes
  useEffect(() => {
    if (editor && note.content !== editor.getHTML()) {
      editor.commands.setContent(note.content);
    }
    setTitle(note.title);
  }, [note.id, note.content, note.title, editor]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    saveTitle(newTitle);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('start');
    }
  };

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
        setShowMoveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggle pin
  const handleTogglePin = () => {
    updateNote.mutate({ id: note.id, data: { is_pinned: !note.is_pinned } });
    setShowActions(false);
  };

  // Duplicate note
  const handleDuplicate = async () => {
    await createNote.mutateAsync({
      title: `${note.title} (Copy)`,
      content: note.content,
      folder_id: note.folder_id,
    });
    setShowActions(false);
  };

  // Move to folder
  const handleMoveToFolder = (folderId: string | null) => {
    moveNote.mutate({ noteIds: [note.id], folderId });
    setShowMoveMenu(false);
    setShowActions(false);
  };

  // Delete note
  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this note?')) {
      deleteNote.mutate(note.id);
      onNoteDeleted?.();
    }
    setShowActions(false);
  };

  // Export note
  const handleExport = (format: 'txt' | 'md' | 'html') => {
    let content = '';
    let mimeType = '';
    let extension = '';

    const plainText = editor?.getText() || '';

    switch (format) {
      case 'txt':
        content = `${note.title}\n\n${plainText}`;
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      case 'md':
        content = `# ${note.title}\n\n${plainText}`;
        mimeType = 'text/markdown';
        extension = 'md';
        break;
      case 'html':
        content = `<!DOCTYPE html><html><head><title>${note.title}</title></head><body><h1>${note.title}</h1>${note.content}</body></html>`;
        mimeType = 'text/html';
        extension = 'html';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'Untitled'}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowActions(false);
  };

  // Word count
  const wordCount = useMemo(() => {
    const text = editor?.getText() || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    return { words, chars };
  }, [editor?.getText()]);

  return (
    <div className="note-editor">
      {/* Header */}
      <div className="editor-header">
        <div className="header-top">
          <input
            type="text"
            className="title-input"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
          />

          {/* Actions Menu */}
          <div className="note-actions" ref={actionsRef}>
            <button
              className="actions-button"
              onClick={() => setShowActions(!showActions)}
              title="Note actions"
            >
              •••
            </button>

            {showActions && (
              <div className="actions-menu">
                <button onClick={handleTogglePin}>
                  {note.is_pinned ? 'Unpin' : 'Pin to top'}
                </button>
                <button onClick={handleDuplicate}>
                  Duplicate
                </button>
                <button onClick={() => setShowMoveMenu(!showMoveMenu)}>
                  Move to folder
                </button>

                {showMoveMenu && (
                  <div className="submenu">
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

                <div className="menu-divider" />

                <button onClick={() => handleExport('txt')}>
                  Export as .txt
                </button>
                <button onClick={() => handleExport('md')}>
                  Export as .md
                </button>
                <button onClick={() => handleExport('html')}>
                  Export as .html
                </button>

                <div className="menu-divider" />

                <button onClick={handleDelete} className="danger">
                  Delete note
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="editor-meta">
          <span className="meta-item">
            {format(new Date(note.updated_at), 'MMM d, yyyy h:mm a')}
          </span>
          {note.is_pinned && <span className="meta-item pinned">Pinned</span>}
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`toolbar-button ${editor?.isActive('bold') ? 'active' : ''}`}
          title="Bold (⌘B)"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`toolbar-button ${editor?.isActive('italic') ? 'active' : ''}`}
          title="Italic (⌘I)"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={`toolbar-button ${editor?.isActive('strike') ? 'active' : ''}`}
          title="Strikethrough"
        >
          <s>S</s>
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`toolbar-button ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`toolbar-button ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`toolbar-button ${editor?.isActive('heading', { level: 3 }) ? 'active' : ''}`}
          title="Heading 3"
        >
          H3
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`toolbar-button ${editor?.isActive('bulletList') ? 'active' : ''}`}
          title="Bullet List"
        >
          •
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`toolbar-button ${editor?.isActive('orderedList') ? 'active' : ''}`}
          title="Numbered List"
        >
          1.
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className={`toolbar-button ${editor?.isActive('blockquote') ? 'active' : ''}`}
          title="Quote"
        >
          "
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          className={`toolbar-button ${editor?.isActive('codeBlock') ? 'active' : ''}`}
          title="Code Block"
        >
          {'</>'}
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          className="toolbar-button"
          title="Undo (⌘Z)"
        >
          ↩
        </button>
        <button
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          className="toolbar-button"
          title="Redo (⇧⌘Z)"
        >
          ↪
        </button>
      </div>

      {/* Editor Content */}
      <div className="editor-content">
        <EditorContent editor={editor} />
      </div>

      {/* Footer with word count */}
      <div className="editor-footer">
        <span className="word-count">
          {wordCount.words} words · {wordCount.chars} characters
        </span>
      </div>
    </div>
  );
}
