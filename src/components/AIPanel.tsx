import { useState, useRef, useEffect, useCallback } from 'react';
import { aiService } from '../services/aiService';
import { SHORTCUT_LABELS } from '../hooks/useKeyboardShortcuts';
import { format } from 'date-fns';
import type { AIMessage } from '../types';

interface AIPanelProps {
  onClose: () => void;
  selectedText?: string;
}

// Quick action prompts
const QUICK_PROMPTS = [
  { label: 'Summarize', prompt: 'Summarize the following text:' },
  { label: 'Improve', prompt: 'Improve this writing:' },
  { label: 'Explain', prompt: 'Explain this in simple terms:' },
  { label: 'Ideas', prompt: 'Give me ideas about:' },
  { label: 'To-do', prompt: 'Create a to-do list for:' },
  { label: 'Outline', prompt: 'Create an outline for:' },
];

export default function AIPanel({ onClose, selectedText }: AIPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsConfigured(aiService.isConfigured());
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const allMessages = [...messages, userMessage];
      const response = await aiService.chat(allMessages);

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

  const clearChat = () => {
    setMessages([]);
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
              {selectedText ? 'You have text selected. Choose an action:' : 'Quick actions:'}
            </p>
            <div className="ai-quick-prompts">
              {QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="quick-prompt-btn"
                >
                  {item.label}
                </button>
              ))}
            </div>
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
