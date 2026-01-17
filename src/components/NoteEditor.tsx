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
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import { useUpdateNote, useCreateNote, useDeleteNote, useMoveNotesToFolder, useFolders } from '../queries';
import { format } from 'date-fns';
import type { Note } from '../types';

interface NoteEditorProps {
  note: Note;
  onNoteDeleted?: () => void;
}

interface SearchMatch {
  from: number;
  to: number;
}

const TEXT_COLORS = [
  { name: 'Default', color: null },
  { name: 'Gray', color: '#6B7280' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Orange', color: '#F97316' },
  { name: 'Yellow', color: '#EAB308' },
  { name: 'Green', color: '#22C55E' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Purple', color: '#A855F7' },
  { name: 'Pink', color: '#EC4899' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', color: null },
  { name: 'Yellow', color: '#FEF08A' },
  { name: 'Green', color: '#BBF7D0' },
  { name: 'Blue', color: '#BFDBFE' },
  { name: 'Purple', color: '#DDD6FE' },
  { name: 'Pink', color: '#FBCFE8' },
  { name: 'Red', color: '#FECACA' },
  { name: 'Orange', color: '#FED7AA' },
];

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

  // Find and replace state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Toolbar dropdowns
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const highlightPickerRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLDivElement>(null);

  // Tags state
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

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

  // TipTap editor with all extensions
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
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Subscript,
      Superscript,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Typography,
      CharacterCount,
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

  // Keyboard shortcuts for find/replace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
        setTimeout(() => findInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showFindReplace) {
        closeFindReplace();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && showFindReplace) {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showFindReplace, matches, currentMatchIndex]);

  // Search functionality
  const performSearch = useCallback(() => {
    if (!editor || !searchTerm) {
      setMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    const text = editor.getText();
    const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    const contentText = caseSensitive ? text : text.toLowerCase();

    const foundMatches: SearchMatch[] = [];
    let index = 0;

    while ((index = contentText.indexOf(searchText, index)) !== -1) {
      foundMatches.push({
        from: index,
        to: index + searchTerm.length,
      });
      index += 1;
    }

    setMatches(foundMatches);
    setCurrentMatchIndex(foundMatches.length > 0 ? 0 : -1);

    if (foundMatches.length > 0) {
      scrollToMatch(foundMatches[0]);
    }
  }, [editor, searchTerm, caseSensitive]);

  useEffect(() => {
    performSearch();
  }, [searchTerm, caseSensitive, performSearch]);

  const scrollToMatch = (match: SearchMatch) => {
    if (!editor) return;

    // Get the document and find the position
    const doc = editor.state.doc;
    let pos = 0;
    let found = false;

    doc.descendants((node, nodePos) => {
      if (found) return false;
      if (node.isText) {
        const text = node.text || '';
        const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
        const nodeText = caseSensitive ? text : text.toLowerCase();
        const localIndex = nodeText.indexOf(searchText);
        if (localIndex !== -1 && pos <= match.from && match.from < pos + text.length) {
          editor.commands.setTextSelection({
            from: nodePos + localIndex,
            to: nodePos + localIndex + searchTerm.length,
          });
          found = true;
          return false;
        }
        pos += text.length;
      }
      return true;
    });
  };

  const findNext = () => {
    if (matches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(matches[nextIndex]);
  };

  const findPrevious = () => {
    if (matches.length === 0) return;
    const prevIndex = currentMatchIndex <= 0 ? matches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(matches[prevIndex]);
  };

  const replaceCurrentMatch = () => {
    if (!editor || matches.length === 0 || currentMatchIndex < 0) return;

    // Get current selection
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().deleteSelection().insertContent(replaceTerm).run();
      performSearch();
    }
  };

  const replaceAllMatches = () => {
    if (!editor || matches.length === 0) return;

    const content = editor.getHTML();
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    const newContent = content.replace(regex, replaceTerm);
    editor.commands.setContent(newContent);
    setMatches([]);
    setCurrentMatchIndex(-1);
  };

  const closeFindReplace = () => {
    setShowFindReplace(false);
    setSearchTerm('');
    setReplaceTerm('');
    setMatches([]);
    setCurrentMatchIndex(-1);
    editor?.commands.focus();
  };

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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
        setShowMoveMenu(false);
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(e.target as Node)) {
        setShowHighlightPicker(false);
      }
      if (linkInputRef.current && !linkInputRef.current.contains(e.target as Node)) {
        setShowLinkInput(false);
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

  // Link handling
  const setLink = () => {
    if (!linkUrl) {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  const openLinkInput = () => {
    const previousUrl = editor?.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setShowLinkInput(true);
  };

  // Image handling
  const addImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  };

  // Table handling
  const insertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  // Word count from CharacterCount extension
  const wordCount = useMemo(() => {
    if (!editor) return { words: 0, chars: 0 };
    return {
      words: editor.storage.characterCount?.words() || 0,
      chars: editor.storage.characterCount?.characters() || 0,
    };
  }, [editor?.storage.characterCount?.words(), editor?.storage.characterCount?.characters()]);

  // Tag handling
  const addTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (tag && !note.tags?.includes(tag)) {
      const updatedTags = [...(note.tags || []), tag];
      updateNote.mutate({ id: note.id, data: { tags: updatedTags } });
    }
    setNewTag('');
    setShowTagInput(false);
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = (note.tags || []).filter(t => t !== tagToRemove);
    updateNote.mutate({ id: note.id, data: { tags: updatedTags } });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Escape') {
      setNewTag('');
      setShowTagInput(false);
    }
  };

  return (
    <div className="note-editor">
      {/* Find and Replace Bar */}
      {showFindReplace && (
        <div className="find-replace-bar">
          <div className="find-row">
            <input
              ref={findInputRef}
              type="text"
              placeholder="Find..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.shiftKey ? findPrevious() : findNext();
                }
              }}
              className="find-input"
            />
            <span className="match-count">
              {matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : 'No results'}
            </span>
            <button onClick={findPrevious} disabled={matches.length === 0} title="Previous (Shift+Cmd+G)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <button onClick={findNext} disabled={matches.length === 0} title="Next (Cmd+G)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <label className="case-toggle">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              Aa
            </label>
          </div>
          <div className="replace-row">
            <input
              type="text"
              placeholder="Replace..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="replace-input"
            />
            <button onClick={replaceCurrentMatch} disabled={matches.length === 0}>
              Replace
            </button>
            <button onClick={replaceAllMatches} disabled={matches.length === 0}>
              Replace All
            </button>
            <button onClick={closeFindReplace} className="close-find" title="Close (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}

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
              ...
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

        {/* Tags */}
        <div className="editor-tags">
          {(note.tags || []).map((tag) => (
            <span key={tag} className="tag">
              #{tag}
              <button
                className="tag-remove"
                onClick={() => removeTag(tag)}
                title="Remove tag"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </span>
          ))}
          {showTagInput ? (
            <input
              ref={tagInputRef}
              type="text"
              className="tag-input"
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (!newTag) setShowTagInput(false); }}
              autoFocus
            />
          ) : (
            <button
              className="add-tag-button"
              onClick={() => { setShowTagInput(true); }}
              title="Add tag"
            >
              + Add tag
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar">
        {/* Text Formatting */}
        <div className="toolbar-group">
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`toolbar-button ${editor?.isActive('bold') ? 'active' : ''}`}
            title="Bold (Cmd+B)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`toolbar-button ${editor?.isActive('italic') ? 'active' : ''}`}
            title="Italic (Cmd+I)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="4" x2="10" y2="4"></line>
              <line x1="14" y1="20" x2="5" y2="20"></line>
              <line x1="15" y1="4" x2="9" y2="20"></line>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={`toolbar-button ${editor?.isActive('underline') ? 'active' : ''}`}
            title="Underline (Cmd+U)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4v6a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4"></path>
              <line x1="4" y1="20" x2="20" y2="20"></line>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={`toolbar-button ${editor?.isActive('strike') ? 'active' : ''}`}
            title="Strikethrough"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <path d="M16 6C16 6 14.5 4 12 4C9.5 4 7 5.5 7 8C7 10 9 11 12 12"></path>
              <path d="M8 18C8 18 9.5 20 12 20C14.5 20 17 18.5 17 16C17 14 15 13 12 12"></path>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Subscript/Superscript */}
        <div className="toolbar-group">
          <button
            onClick={() => editor?.chain().focus().toggleSubscript().run()}
            className={`toolbar-button ${editor?.isActive('subscript') ? 'active' : ''}`}
            title="Subscript"
          >
            <span className="text-icon">X<sub>2</sub></span>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleSuperscript().run()}
            className={`toolbar-button ${editor?.isActive('superscript') ? 'active' : ''}`}
            title="Superscript"
          >
            <span className="text-icon">X<sup>2</sup></span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Headings */}
        <div className="toolbar-group">
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`toolbar-button heading-btn ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            title="Heading 1"
          >
            <span className="heading-label">H<sub>1</sub></span>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-button heading-btn ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            title="Heading 2"
          >
            <span className="heading-label">H<sub>2</sub></span>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`toolbar-button heading-btn ${editor?.isActive('heading', { level: 3 }) ? 'active' : ''}`}
            title="Heading 3"
          >
            <span className="heading-label">H<sub>3</sub></span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Text Alignment */}
        <div className="toolbar-group">
          <button
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            className={`toolbar-button ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
            title="Align left"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="15" y2="12"></line>
              <line x1="3" y1="18" x2="18" y2="18"></line>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            className={`toolbar-button ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
            title="Align center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="6" y1="12" x2="18" y2="12"></line>
              <line x1="4" y1="18" x2="20" y2="18"></line>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            className={`toolbar-button ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
            title="Align right"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="9" y1="12" x2="21" y2="12"></line>
              <line x1="6" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Lists */}
        <div className="toolbar-group">
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`toolbar-button ${editor?.isActive('bulletList') ? 'active' : ''}`}
            title="Bullet List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="9" y1="6" x2="20" y2="6"></line>
              <line x1="9" y1="12" x2="20" y2="12"></line>
              <line x1="9" y1="18" x2="20" y2="18"></line>
              <circle cx="4" cy="6" r="1.5" fill="currentColor"></circle>
              <circle cx="4" cy="12" r="1.5" fill="currentColor"></circle>
              <circle cx="4" cy="18" r="1.5" fill="currentColor"></circle>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={`toolbar-button ${editor?.isActive('orderedList') ? 'active' : ''}`}
            title="Numbered List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="10" y1="6" x2="20" y2="6"></line>
              <line x1="10" y1="12" x2="20" y2="12"></line>
              <line x1="10" y1="18" x2="20" y2="18"></line>
              <text x="3" y="7" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">1</text>
              <text x="3" y="13" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">2</text>
              <text x="3" y="19" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">3</text>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            className={`toolbar-button ${editor?.isActive('taskList') ? 'active' : ''}`}
            title="Task List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="6" height="6" rx="1"></rect>
              <path d="M5 8l1 1 2-2"></path>
              <line x1="12" y1="8" x2="21" y2="8"></line>
              <rect x="3" y="13" width="6" height="6" rx="1"></rect>
              <line x1="12" y1="16" x2="21" y2="16"></line>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Colors */}
        <div className="toolbar-group">
          <div className="color-picker-wrapper" ref={colorPickerRef}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="toolbar-button"
              title="Text Color"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16"></path>
                <path d="M6 20l6-16 6 16"></path>
                <path d="M8 14h8"></path>
              </svg>
            </button>
            {showColorPicker && (
              <div className="color-dropdown">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      if (c.color) {
                        editor?.chain().focus().setColor(c.color).run();
                      } else {
                        editor?.chain().focus().unsetColor().run();
                      }
                      setShowColorPicker(false);
                    }}
                    className="color-option"
                  >
                    <span className="color-swatch" style={{ backgroundColor: c.color || 'transparent', border: c.color ? 'none' : '1px solid #ccc' }}></span>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="color-picker-wrapper" ref={highlightPickerRef}>
            <button
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
              className={`toolbar-button ${editor?.isActive('highlight') ? 'active' : ''}`}
              title="Highlight"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            {showHighlightPicker && (
              <div className="color-dropdown">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      if (c.color) {
                        editor?.chain().focus().toggleHighlight({ color: c.color }).run();
                      } else {
                        editor?.chain().focus().unsetHighlight().run();
                      }
                      setShowHighlightPicker(false);
                    }}
                    className="color-option"
                  >
                    <span className="color-swatch" style={{ backgroundColor: c.color || 'transparent', border: c.color ? 'none' : '1px solid #ccc' }}></span>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="toolbar-divider" />

        {/* Insert */}
        <div className="toolbar-group">
          <div className="link-wrapper" ref={linkInputRef}>
            <button
              onClick={openLinkInput}
              className={`toolbar-button ${editor?.isActive('link') ? 'active' : ''}`}
              title="Link"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </button>
            {showLinkInput && (
              <div className="link-input-dropdown">
                <input
                  type="url"
                  placeholder="Enter URL..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setLink()}
                />
                <button onClick={setLink}>Set</button>
                {editor?.isActive('link') && (
                  <button onClick={() => { editor?.chain().focus().unsetLink().run(); setShowLinkInput(false); }}>
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={addImage}
            className="toolbar-button"
            title="Image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
          <button
            onClick={insertTable}
            className="toolbar-button"
            title="Insert Table"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Block Elements */}
        <div className="toolbar-group">
          <button
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={`toolbar-button ${editor?.isActive('blockquote') ? 'active' : ''}`}
            title="Quote"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4z"></path>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            className={`toolbar-button ${editor?.isActive('codeBlock') ? 'active' : ''}`}
            title="Code Block"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            className="toolbar-button"
            title="Horizontal Rule"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Undo/Redo */}
        <div className="toolbar-group">
          <button
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="toolbar-button"
            title="Undo (Cmd+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"></path>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="toolbar-button"
            title="Redo (Shift+Cmd+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6"></path>
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
            </svg>
          </button>
        </div>

        {/* Find */}
        <div className="toolbar-group toolbar-right">
          <button
            onClick={() => { setShowFindReplace(true); setTimeout(() => findInputRef.current?.focus(), 50); }}
            className="toolbar-button"
            title="Find & Replace (Cmd+F)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Table Controls (shown when in table) */}
      {editor?.isActive('table') && (
        <div className="table-controls">
          <button onClick={() => editor?.chain().focus().addColumnBefore().run()}>Add Column Before</button>
          <button onClick={() => editor?.chain().focus().addColumnAfter().run()}>Add Column After</button>
          <button onClick={() => editor?.chain().focus().deleteColumn().run()}>Delete Column</button>
          <span className="table-divider">|</span>
          <button onClick={() => editor?.chain().focus().addRowBefore().run()}>Add Row Before</button>
          <button onClick={() => editor?.chain().focus().addRowAfter().run()}>Add Row After</button>
          <button onClick={() => editor?.chain().focus().deleteRow().run()}>Delete Row</button>
          <span className="table-divider">|</span>
          <button onClick={() => editor?.chain().focus().deleteTable().run()} className="danger">Delete Table</button>
        </div>
      )}

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
