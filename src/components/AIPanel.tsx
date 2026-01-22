import { useState, useRef, useEffect, useCallback } from 'react';
import { aiService } from '../services/aiService';
import { settingsCommands } from '../services/tauriCommands';
import { SHORTCUT_LABELS } from '../hooks/useKeyboardShortcuts';
import { format } from 'date-fns';
import type { AIMessage, Note } from '../types';

interface AIPanelProps {
  onClose: () => void;
  selectedText?: string;
  notes?: Note[];
}

const AI_HISTORY_KEY = 'ai_conversation_history';
const MAX_HISTORY_MESSAGES = 50;

// Quick action prompts organized by category
const QUICK_PROMPTS = {
  writing: [
    { label: 'Summarize', prompt: 'Summarize the following text:' },
    { label: 'Improve', prompt: 'Improve this writing for clarity and style:' },
    { label: 'Explain', prompt: 'Explain this in simple terms:' },
    { label: 'Expand', prompt: 'Expand on this idea with more details:' },
  ],
  productivity: [
    { label: 'To-do List', prompt: 'Create a prioritized to-do list for:' },
    { label: 'Break Down', prompt: 'Break down this task into smaller steps:' },
    { label: 'Plan My Day', prompt: 'Help me plan my day. I need to:' },
    { label: 'Time Block', prompt: 'Create a time-blocked schedule for:' },
  ],
  analysis: [
    { label: 'Review Day', prompt: 'Analyze my productivity today and suggest improvements. Here\'s what I did:' },
    { label: 'Find Gaps', prompt: 'Identify gaps or missing items in this plan:' },
    { label: 'Prioritize', prompt: 'Help me prioritize these tasks by importance:' },
    { label: 'Ideas', prompt: 'Give me creative ideas about:' },
  ],
};

export default function AIPanel({ onClose, selectedText, notes = [] }: AIPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'writing' | 'productivity' | 'analysis'>('productivity');
  const [useNotesContext, setUseNotesContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const saved = await settingsCommands.get(AI_HISTORY_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as AIMessage[];
          setMessages(parsed.slice(-MAX_HISTORY_MESSAGES));
        }
      } catch (err) {
        console.error('[AI] Failed to load history:', err);
      }
    };
    loadHistory();
    setIsConfigured(aiService.isConfigured());
    inputRef.current?.focus();
  }, []);

  // Save conversation history when messages change
  useEffect(() => {
    const saveHistory = async () => {
      if (messages.length > 0) {
        try {
          const toSave = messages.slice(-MAX_HISTORY_MESSAGES);
          await settingsCommands.set(AI_HISTORY_KEY, JSON.stringify(toSave));
        } catch (err) {
          console.error('[AI] Failed to save history:', err);
        }
      }
    };
    saveHistory();
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getNotesContext = useCallback(() => {
    if (!useNotesContext || notes.length === 0) return null;
    const recentNotes = notes.slice(0, 5);
    return recentNotes
      .map((n) => `- ${n.title}: ${stripHtml(n.content).slice(0, 200)}...`)
      .join('\n');
  }, [useNotesContext, notes]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const notesContext = getNotesContext();
      let messagesToSend = [...messages, userMessage];

      // Add system context if notes context is enabled
      if (notesContext && messagesToSend.length === 1) {
        messagesToSend = [
          {
            id: 'system',
            role: 'system' as const,
            content: `You are an AI assistant for Voyena, a note-taking and productivity app. Here's context from the user's recent notes:\n${notesContext}\n\nUse this context when relevant to help the user.`,
            timestamp: new Date().toISOString(),
          },
          ...messagesToSend,
        ];
      }

      const response = await aiService.chat(messagesToSend);

      const assistantMessage: AIMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: AIMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    if (messages.length > 0 && !confirm('Clear conversation history?')) return;
    setMessages([]);
    try {
      await settingsCommands.set(AI_HISTORY_KEY, '');
    } catch (err) {
      console.error('[AI] Failed to clear history:', err);
    }
  };

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleQuickPrompt = (prompt: string) => {
    if (selectedText) {
      setInput(`${prompt}\n\n${selectedText}`);
    } else {
      setInput(prompt + ' ');
    }
    inputRef.current?.focus();
  };

  return (
    <aside className="ai-panel">
      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <span className="ai-icon">✨</span>
          <span>AI Assistant</span>
        </div>
        <div className="ai-panel-actions">
          <button onClick={clearChat} className="ai-action-button" title="Clear chat">
            🗑️
          </button>
          <button
            onClick={onClose}
            className="ai-action-button"
            title={`Close (${SHORTCUT_LABELS.toggleAI})`}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-messages">
        {!isConfigured && messages.length === 0 && (
          <div className="ai-setup-message">
            <p>AI not configured yet.</p>
            <p>Add your OpenAI API key in Settings to enable the AI assistant.</p>
          </div>
        )}

        {messages.length === 0 && isConfigured && (
          <div className="ai-welcome">
            <h3>How can I help?</h3>
            <p className="ai-welcome-subtitle">
              {selectedText ? 'You have text selected. Choose an action:' : 'Choose a quick action:'}
            </p>

            {/* Category tabs */}
            <div className="ai-category-tabs">
              {(['writing', 'productivity', 'analysis'] as const).map((cat) => (
                <button
                  key={cat}
                  className={`ai-category-tab ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            <div className="ai-quick-prompts">
              {QUICK_PROMPTS[activeCategory].map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="quick-prompt-btn"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Notes context toggle */}
            {notes.length > 0 && (
              <label className="ai-context-toggle">
                <input
                  type="checkbox"
                  checked={useNotesContext}
                  onChange={(e) => setUseNotesContext(e.target.checked)}
                />
                <span>Include notes context ({notes.length} notes)</span>
              </label>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`ai-message ${message.role}`}>
            <div className="ai-message-header">
              <span className="ai-message-role">
                {message.role === 'user' ? 'You' : 'AI'}
              </span>
              <span className="ai-message-time">
                {format(new Date(message.timestamp), 'h:mm a')}
              </span>
            </div>
            <div className="ai-message-content">{message.content}</div>
            {message.role === 'assistant' && (
              <div className="ai-message-actions">
                <button
                  onClick={() => copyToClipboard(message.content, message.id)}
                  className="ai-copy-btn"
                  title="Copy to clipboard"
                >
                  {copiedId === message.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="ai-message assistant">
            <div className="ai-message-content loading">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-input-container">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConfigured ? 'Ask anything...' : 'Configure API key in settings'}
          disabled={!isConfigured || isLoading}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || !isConfigured}
          className="send-button"
        >
          ↑
        </button>
      </div>
    </aside>
  );
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
