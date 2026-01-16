import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { aiService } from '../services/aiService';
import { isSupabaseConfigured } from '../services/supabase';
import type { Theme } from '../types';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const { theme, setTheme } = useTheme();

  // AI Settings
  const [apiKey, setApiKey] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  useEffect(() => {
    // Check if AI is already configured
    if (aiService.isConfigured()) {
      setKeyStatus('valid');
      setApiKey('••••••••••••••••••••••••••••••••');
    }
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey || apiKey.startsWith('••')) return;

    setIsTestingKey(true);
    const isValid = await aiService.setApiKey(apiKey);
    setIsTestingKey(false);

    if (isValid) {
      setKeyStatus('valid');
      setApiKey('••••••••••••••••••••••••••••••••');
    } else {
      setKeyStatus('invalid');
    }
  };

  const handleClearApiKey = async () => {
    await aiService.clearApiKey();
    setApiKey('');
    setKeyStatus('none');
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-content">
          {/* Appearance Section */}
          <section className="settings-section">
            <h3>Appearance</h3>

            <div className="setting-item">
              <label>Theme</label>
              <div className="theme-options">
                {(['light', 'dark', 'sepia', 'high-contrast', 'system'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    className={`theme-option ${theme === t ? 'active' : ''}`}
                    onClick={() => handleThemeChange(t)}
                  >
                    <span>
                      {t === 'high-contrast'
                        ? 'High Contrast'
                        : t.charAt(0).toUpperCase() + t.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* AI Section */}
          <section className="settings-section">
            <h3>AI Assistant</h3>

            <div className="setting-item">
              <label>OpenAI API Key</label>
              <div className="api-key-input">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeyStatus('none');
                  }}
                  placeholder="sk-..."
                  disabled={isTestingKey}
                />
                {keyStatus === 'valid' ? (
                  <button onClick={handleClearApiKey} className="danger">
                    Remove
                  </button>
                ) : (
                  <button onClick={handleSaveApiKey} disabled={!apiKey || isTestingKey}>
                    {isTestingKey ? 'Testing...' : 'Save'}
                  </button>
                )}
              </div>
              {keyStatus === 'valid' && (
                <p className="status-text success">✓ API key is valid</p>
              )}
              {keyStatus === 'invalid' && (
                <p className="status-text error">✗ Invalid API key</p>
              )}
              <p className="help-text">
                Get your API key from{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenAI Dashboard
                </a>
              </p>
            </div>
          </section>

          {/* Sync Section */}
          <section className="settings-section">
            <h3>Sync</h3>

            <div className="setting-item">
              <label>Supabase Status</label>
              {isSupabaseConfigured ? (
                <p className="status-text success">✓ Connected</p>
              ) : (
                <>
                  <p className="status-text warning">⚠ Not configured (offline mode)</p>
                  <p className="help-text">
                    To enable sync, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your
                    environment variables.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="settings-section">
            <h3>Keyboard Shortcuts</h3>

            <div className="shortcuts-list">
              <div className="shortcut-item">
                <span>New Note</span>
                <kbd>⌘N</kbd>
              </div>
              <div className="shortcut-item">
                <span>Search</span>
                <kbd>⌘F</kbd>
              </div>
              <div className="shortcut-item">
                <span>Toggle AI</span>
                <kbd>⌘J</kbd>
              </div>
              <div className="shortcut-item">
                <span>Toggle Sidebar</span>
                <kbd>⌘\</kbd>
              </div>
              <div className="shortcut-item">
                <span>Delete Note</span>
                <kbd>⌘⌫</kbd>
              </div>
              <div className="shortcut-item">
                <span>Settings</span>
                <kbd>⌘,</kbd>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="settings-section">
            <h3>About</h3>
            <p className="about-text">
              Voyena Desktop v1.0.0
              <br />
              Built with Electron, React, and TanStack Query
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
