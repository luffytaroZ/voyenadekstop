import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useUpdateNote, useCreateNote, useDeleteNote, useMoveNotesToFolder, useFolders } from '../queries';
import { format } from 'date-fns';
import type { Note } from '../types';

interface NoteEditorProps {
  note: Note;
  onNoteDeleted?: () => void;
}

interface ToolbarButton {
  label: string;
  title?: string;
  key?: string;
  cmd?: string;
  args?: Record<string, unknown>;
  action?: () => void;
  disabled?: boolean;
}

export default function NoteEditor({ note, onNoteDeleted }: NoteEditorProps) {
  const updateNote = useUpdateNote();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const moveNote = useMoveNotesToFolder();
  const { data: folders = [] } = useFolders();

  const [title, setTitle] = useState(note.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Highlight.configure({ multicolor: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { class: 'editor-link' },
      }),
      Image.configure({ HTMLAttributes: { class: 'editor-image' } }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Typography,
      CharacterCount,
    ],
    content: note.content,
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
    onUpdate: ({ editor }) => {
      saveContent(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && note.content !== editor.getHTML()) {
      editor.commands.setContent(note.content);
    }
    setTitle(note.title);
  }, [note.id, note.content, note.title, editor]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowMoveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  const handleTogglePin = () => {
    updateNote.mutate({ id: note.id, data: { is_pinned: !note.is_pinned } });
    setShowMenu(false);
  };

  const handleDuplicate = async () => {
    await createNote.mutateAsync({
      title: `${note.title} (Copy)`,
      content: note.content,
      folder_id: note.folder_id,
    });
    setShowMenu(false);
  };

  const handleMoveToFolder = (folderId: string | null) => {
    moveNote.mutate({ noteIds: [note.id], folderId });
    setShowMoveMenu(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this note?')) {
      deleteNote.mutate(note.id);
      onNoteDeleted?.();
    }
    setShowMenu(false);
  };

  const handleExport = async (fmt: 'txt' | 'md' | 'html') => {
    const plainText = editor?.getText() || '';
    let content = '';
    if (fmt === 'txt') content = `${note.title}\n\n${plainText}`;
    else if (fmt === 'md') content = `# ${note.title}\n\n${plainText}`;
    else content = `<!DOCTYPE html><html><head><title>${note.title}</title></head><body><h1>${note.title}</h1>${note.content}</body></html>`;

    try {
      const filePath = await save({
        defaultPath: `${note.title || 'Untitled'}.${fmt}`,
        filters: [{ name: fmt.toUpperCase(), extensions: [fmt] }],
      });
      if (filePath) await writeTextFile(filePath, content);
    } catch (err) {
      console.error('[Export]', err);
    }
    setShowMenu(false);
  };

  const setLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const addTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (tag && !note.tags?.includes(tag)) {
      updateNote.mutate({ id: note.id, data: { tags: [...(note.tags || []), tag] } });
    }
    setNewTag('');
    setShowTagInput(false);
  };

  const removeTag = (tag: string) => {
    updateNote.mutate({ id: note.id, data: { tags: (note.tags || []).filter(t => t !== tag) } });
  };

  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0 };
    return {
      words: editor.storage.characterCount?.words() || 0,
      chars: editor.storage.characterCount?.characters() || 0,
    };
  }, [editor?.storage.characterCount?.words(), editor?.storage.characterCount?.characters()]);

  if (!editor) return null;

  return (
    <div className="note-editor">
      {/* Header */}
      <header className="editor-header">
        <div className="header-row">
          <input
            type="text"
            className="title-input"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
          />
          <div className="header-actions" ref={menuRef}>
            <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            {showMenu && (
              <div className="dropdown-menu">
                <button onClick={handleTogglePin}>{note.is_pinned ? 'Unpin' : 'Pin to top'}</button>
                <button onClick={handleDuplicate}>Duplicate</button>
                <button onClick={() => setShowMoveMenu(!showMoveMenu)}>Move to folder</button>
                {showMoveMenu && (
                  <div className="submenu">
                    <button onClick={() => handleMoveToFolder(null)}>All Notes</button>
                    {folders.map(f => (
                      <button key={f.id} onClick={() => handleMoveToFolder(f.id)}>{f.name}</button>
                    ))}
                  </div>
                )}
                <hr />
                <button onClick={() => handleExport('txt')}>Export .txt</button>
                <button onClick={() => handleExport('md')}>Export .md</button>
                <button onClick={() => handleExport('html')}>Export .html</button>
                <hr />
                <button className="danger" onClick={handleDelete}>Delete</button>
              </div>
            )}
          </div>
        </div>

        <div className="meta-row">
          <span>{format(new Date(note.updated_at), 'MMM d, yyyy · h:mm a')}</span>
          {note.is_pinned && <span className="badge">Pinned</span>}
        </div>

        <div className="tags-row">
          {(note.tags || []).map(tag => (
            <span key={tag} className="tag">
              #{tag}
              <button onClick={() => removeTag(tag)}>×</button>
            </span>
          ))}
          {showTagInput ? (
            <input
              className="tag-input"
              placeholder="tag"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addTag();
                if (e.key === 'Escape') { setNewTag(''); setShowTagInput(false); }
              }}
              onBlur={() => { if (!newTag) setShowTagInput(false); }}
              autoFocus
            />
          ) : (
            <button className="add-tag" onClick={() => setShowTagInput(true)}>+ Add tag</button>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <div className="editor-toolbar">
        {([
          [
            { cmd: 'toggleBold', key: 'bold', label: 'B', title: 'Bold' },
            { cmd: 'toggleItalic', key: 'italic', label: 'I', title: 'Italic' },
            { cmd: 'toggleUnderline', key: 'underline', label: 'U', title: 'Underline' },
            { cmd: 'toggleStrike', key: 'strike', label: 'S', title: 'Strikethrough' },
          ],
          [
            { cmd: 'toggleHeading', key: 'heading', args: { level: 1 }, label: 'H1', title: 'Heading 1' },
            { cmd: 'toggleHeading', key: 'heading', args: { level: 2 }, label: 'H2', title: 'Heading 2' },
            { cmd: 'toggleHeading', key: 'heading', args: { level: 3 }, label: 'H3', title: 'Heading 3' },
          ],
          [
            { cmd: 'toggleBulletList', key: 'bulletList', label: '•', title: 'Bullet List' },
            { cmd: 'toggleOrderedList', key: 'orderedList', label: '1.', title: 'Numbered List' },
            { cmd: 'toggleTaskList', key: 'taskList', label: '☑', title: 'Checklist' },
          ],
          [
            { cmd: 'toggleBlockquote', key: 'blockquote', label: '"', title: 'Quote' },
            { cmd: 'toggleCodeBlock', key: 'codeBlock', label: '</>', title: 'Code' },
            { cmd: 'toggleHighlight', key: 'highlight', label: '✦', title: 'Highlight' },
            { action: setLink, key: 'link', label: '🔗', title: 'Link' },
          ],
          [
            { cmd: 'undo', key: 'undo', label: '↩', title: 'Undo', disabled: !editor.can().undo() },
            { cmd: 'redo', key: 'redo', label: '↪', title: 'Redo', disabled: !editor.can().redo() },
          ],
        ] as ToolbarButton[][]).map((group, i) => (
          <div key={i} className="toolbar-group">
            {group.map((btn) => (
              <button
                key={btn.label}
                onClick={() => {
                  if (btn.action) {
                    btn.action();
                  } else if (btn.cmd) {
                    (editor.chain().focus() as any)[btn.cmd](btn.args).run();
                  }
                }}
                className={btn.key && editor.isActive(btn.key, btn.args) ? 'active' : ''}
                disabled={btn.disabled}
                title={btn.title}
              >
                {btn.label}
              </button>
            ))}
            {i < 4 && <div className="toolbar-sep" />}
          </div>
        ))}
      </div>

      {/* Table Controls */}
      {editor.isActive('table') && (
        <div className="table-toolbar">
          <button onClick={() => editor.chain().focus().addColumnBefore().run()}>+ Col</button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()}>Col +</button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()}>- Col</button>
          <span>|</span>
          <button onClick={() => editor.chain().focus().addRowBefore().run()}>+ Row</button>
          <button onClick={() => editor.chain().focus().addRowAfter().run()}>Row +</button>
          <button onClick={() => editor.chain().focus().deleteRow().run()}>- Row</button>
          <span>|</span>
          <button className="danger" onClick={() => editor.chain().focus().deleteTable().run()}>Delete Table</button>
        </div>
      )}

      {/* Editor */}
      <div className="editor-content">
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <footer className="editor-footer">
        {stats.words} words · {stats.chars} characters
      </footer>
    </div>
  );
}
