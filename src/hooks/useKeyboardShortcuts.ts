import { useEffect, useCallback, useRef } from 'react';

export interface ShortcutHandlers {
  onNewNote?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onDelete?: () => void;
  onToggleSidebar?: () => void;
  onToggleAI?: () => void;
  onSettings?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  // Use ref to avoid stale closures
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMod = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;
    const h = handlersRef.current;

    // Don't trigger shortcuts when typing in inputs (except specific ones)
    const target = event.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // Escape - always works
    if (event.key === 'Escape') {
      h.onEscape?.();
      return;
    }

    // Cmd/Ctrl + N: New note (always works)
    if (isMod && event.key === 'n' && !isShift) {
      event.preventDefault();
      h.onNewNote?.();
      return;
    }

    // Cmd/Ctrl + S: Save (works in editor)
    if (isMod && event.key === 's' && !isShift) {
      event.preventDefault();
      h.onSave?.();
      return;
    }

    // Skip other shortcuts if in input
    if (isInput && event.key !== 'f') return;

    // Cmd/Ctrl + F: Focus search
    if (isMod && event.key === 'f' && !isShift) {
      event.preventDefault();
      h.onSearch?.();
      return;
    }

    // Cmd/Ctrl + Backspace: Delete note
    if (isMod && event.key === 'Backspace') {
      event.preventDefault();
      h.onDelete?.();
      return;
    }

    // Cmd/Ctrl + \: Toggle sidebar
    if (isMod && event.key === '\\') {
      event.preventDefault();
      h.onToggleSidebar?.();
      return;
    }

    // Cmd/Ctrl + J: Toggle AI panel
    if (isMod && event.key === 'j') {
      event.preventDefault();
      h.onToggleAI?.();
      return;
    }

    // Cmd/Ctrl + ,: Settings
    if (isMod && event.key === ',') {
      event.preventDefault();
      h.onSettings?.();
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Shortcut labels for UI display
export const SHORTCUT_LABELS = {
  newNote: '⌘N',
  save: '⌘S',
  search: '⌘F',
  delete: '⌘⌫',
  toggleSidebar: '⌘\\',
  toggleAI: '⌘J',
  settings: '⌘,',
  escape: 'Esc',
  bold: '⌘B',
  italic: '⌘I',
  undo: '⌘Z',
  redo: '⇧⌘Z',
} as const;
