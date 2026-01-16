import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../services/supabase';

type AuthMode = 'signin' | 'signup' | 'forgot';

const TITLES: Record<AuthMode, string> = {
  signin: 'Sign In',
  signup: 'Create Account',
  forgot: 'Reset Password',
};

const DESCRIPTIONS: Record<AuthMode, string> = {
  signin: 'Welcome back to Voyena',
  signup: 'Start your journey with Voyena',
  forgot: 'Enter your email to reset your password',
};

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearForm = useCallback(() => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }, []);

  const switchMode = useCallback((newMode: AuthMode) => {
    clearForm();
    setMode(newMode);
  }, [clearForm]);

  const validate = useCallback(() => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (mode !== 'forgot') {
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
      if (mode === 'signup' && password !== confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }

    return true;
  }, [email, password, confirmPassword, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) return;

    setLoading(true);

    try {
      let result: { error: string | null };

      switch (mode) {
        case 'signin':
          result = await signIn(email, password);
          break;
        case 'signup':
          result = await signUp(email, password);
          if (!result.error) {
            setSuccess('Account created! Please check your email to verify.');
          }
          break;
        case 'forgot':
          result = await resetPassword(email);
          if (!result.error) {
            setSuccess('Password reset email sent! Check your inbox.');
          }
          break;
      }

      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-logo">Voyena</h1>
            <p className="auth-description">Supabase not configured</p>
          </div>
          <div className="auth-error">
            <p>To enable authentication, add the following to your .env file:</p>
            <code>
              VITE_SUPABASE_URL=your_supabase_url<br />
              VITE_SUPABASE_ANON_KEY=your_anon_key
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-logo">Voyena</h1>
          <h2 className="auth-title">{TITLES[mode]}</h2>
          <p className="auth-description">{DESCRIPTIONS[mode]}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              autoComplete="email"
              autoFocus
            />
          </div>

          {mode !== 'forgot' && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>
          )}

          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="loading-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            ) : (
              TITLES[mode]
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'signin' && (
            <>
              <button
                className="auth-link"
                onClick={() => switchMode('forgot')}
              >
                Forgot password?
              </button>
              <div className="auth-divider" />
              <p>
                Don't have an account?{' '}
                <button
                  className="auth-link"
                  onClick={() => switchMode('signup')}
                >
                  Create one
                </button>
              </p>
            </>
          )}

          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                className="auth-link"
                onClick={() => switchMode('signin')}
              >
                Sign in
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <button
              className="auth-link"
              onClick={() => switchMode('signin')}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
