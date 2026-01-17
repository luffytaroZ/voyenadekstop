import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../services/supabase';

type AuthMode = 'signin' | 'signup' | 'forgot';

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
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
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
            setSuccess('Check your email to verify your account');
          }
          break;
        case 'forgot':
          result = await resetPassword(email);
          if (!result.error) {
            setSuccess('Password reset email sent');
          }
          break;
      }

      if (result.error) {
        setError(result.error);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <h1 className="auth-logo">VOYENA</h1>
          <p className="auth-subtitle">Setup Required</p>
          <div className="auth-notice">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1 className="auth-logo">VOYENA</h1>

        <p className="auth-subtitle">
          {mode === 'signin' && 'Welcome back'}
          {mode === 'signup' && 'Create account'}
          {mode === 'forgot' && 'Reset password'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            disabled={loading}
            autoComplete="email"
            autoFocus
          />

          {mode !== 'forgot' && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={loading}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          )}

          {mode === 'signup' && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              disabled={loading}
              autoComplete="new-password"
            />
          )}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? '...' : (
              <>
                {mode === 'signin' && 'Sign in'}
                {mode === 'signup' && 'Create account'}
                {mode === 'forgot' && 'Send reset link'}
              </>
            )}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'signin' && (
            <>
              <button onClick={() => switchMode('forgot')}>Forgot password?</button>
              <button onClick={() => switchMode('signup')}>Create account</button>
            </>
          )}
          {mode === 'signup' && (
            <button onClick={() => switchMode('signin')}>Already have an account?</button>
          )}
          {mode === 'forgot' && (
            <button onClick={() => switchMode('signin')}>Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}
