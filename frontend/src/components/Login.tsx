import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MOF_BRANDMARK_SRC } from '../constants/chatConstants';
import { isMofEmail, MOF_EMAIL_DOMAIN, MOF_EMAIL_ERROR, normalizeMofEmail } from '../utils/mofEmail';
import './Login.css';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onSignUp: (username: string, password: string, fullName: string) => Promise<void>;
  themeColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const Login: React.FC<LoginProps> = ({
  onLogin,
  onSignUp,
  themeColors = {
    primary: '#C6A75D',
    secondary: '#B8985A',
    accent: '#E5D4A6',
  },
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = normalizeMofEmail(username);
    const normalizedName = fullName.trim().replace(/\s+/g, ' ');

    if (!normalizedEmail || !password) {
      setError('Please enter both email and password');
      return;
    }
    if (!isMofEmail(normalizedEmail)) {
      setError(MOF_EMAIL_ERROR);
      return;
    }
    if (mode === 'signup' && normalizedName.length < 2) {
      setError('Please enter your full name');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      setUsername(normalizedEmail);
      await (mode === 'signup' ? onSignUp(normalizedEmail, password, normalizedName) : onLogin(normalizedEmail, password));
    } catch (err: any) {
      setError(err.message || (mode === 'signup' ? 'Unable to create account' : 'Invalid email or password'));
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-pattern"></div>
      </div>

      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.div
          className="login-logo-section"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <img
            src={MOF_BRANDMARK_SRC}
            alt="UAE Ministry of Finance"
            className="login-logo"
          />
          <h1 className="login-title">AI Assistant Portal</h1>
          <p className="login-subtitle">
            {mode === 'signup' ? 'Create an account to test the AI assistant' : 'Sign in to access your intelligent assistant'}
          </p>
        </motion.div>

        <motion.form
          className="login-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {mode === 'signup' && (
            <div className="login-field">
              <label htmlFor="full-name" className="login-label">Full name</label>
              <div className="login-input-wrapper">
                <input
                  id="full-name"
                  name="name"
                  type="text"
                  value={fullName}
                  onChange={e => {
                    setFullName(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your full name"
                  className="login-input"
                  disabled={isLoading}
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
            </div>
          )}

          <div className="login-field">
            <label htmlFor="username" className="login-label">
              Email
            </label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <input
                id="username"
                name="email"
                type="email"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder={`name@${MOF_EMAIL_DOMAIN}`}
                className="login-input"
                disabled={isLoading}
                autoComplete="email"
                autoCapitalize="none"
                inputMode="email"
                spellCheck={false}
                required
                aria-describedby="email-requirement"
              />
            </div>
            <p id="email-requirement" className="login-field-help">
              Use your Ministry email ending in @{MOF_EMAIL_DOMAIN}.
            </p>
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">
              Password
            </label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter your password"
                className="login-input"
                disabled={isLoading}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="login-password-toggle"
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <p className="login-password-help">
              Forgotten your password? Contact your administrator for assistance.
            </p>
          )}

          {mode === 'signup' && (
            <div className="login-field">
              <label htmlFor="confirm-password" className="login-label">Confirm password</label>
              <div className="login-input-wrapper">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your password again"
                  className="login-input"
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {error && (
            <motion.div
              className="login-error"
              id="login-error"
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
            style={{
              background: isLoading
                ? '#999'
                : `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
            }}
          >
            {isLoading ? (
              <>
                <svg className="login-spinner" viewBox="0 0 24 24">
                  <circle
                    className="login-spinner-circle"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                </svg>
                {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              <>
                {mode === 'signup' ? 'Create Account' : 'Sign In'}
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </>
            )}
          </button>

          <button
            type="button"
            className="login-mode-toggle"
            disabled={isLoading}
            onClick={() => {
              setMode(current => current === 'login' ? 'signup' : 'login');
              setError('');
              setPassword('');
              setConfirmPassword('');
              setFullName('');
              setShowPassword(false);
            }}
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : 'New tester? Create an account'}
          </button>
        </motion.form>
      </motion.div>

      <div className="login-decoration login-decoration-1"></div>
      <div className="login-decoration login-decoration-2"></div>
    </div>
  );
};
