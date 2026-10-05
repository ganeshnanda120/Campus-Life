import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, ArrowRight, ShieldAlert, Lock, Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { useAuth } from '../../context/useAuth';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'email' | 'password'>('email');

  // Modals & States
  const [isNotRegisteredModalOpen, setIsNotRegisteredModalOpen] = useState(false);
  const [isInactiveAlert, setIsInactiveAlert] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  // Loading & error tracking
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login, checkEmailAuthorization, sendPasswordReset } = useAuth();

  // Validate standard email format
  const isValidEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // Section 7: Email check step
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsInactiveAlert(false);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid institution email address.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Checking email...');

    try {
      const check = await checkEmailAuthorization(cleanEmail);

      setIsLoading(false);
      setLoadingText('');

      // CASE 1: Email not added by admin (Section 5 & 7)
      if (!check.authorized) {
        setIsNotRegisteredModalOpen(true);
        return;
      }

      // CASE 2: Inactive user (Section 8)
      if (!check.active) {
        setIsInactiveAlert(true);
        setError('Your account is currently inactive. Please contact your administrator.');
        return;
      }

      // CASE 3: First-time activation required (Section 9)
      if (!check.activated) {
        navigate(`/activate?email=${encodeURIComponent(cleanEmail)}`);
        return;
      }

      // CASE 4: Activated user -> advance to password entry (Section 14)
      setStep('password');
    } catch {
      setIsLoading(false);
      setLoadingText('');
      setError('An error occurred during verification. Please check your network connection.');
    }
  };

  // Section 14: Subsequent login with password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Signing in...');

    const result = await login(email.trim().toLowerCase(), password);

    setIsLoading(false);
    setLoadingText('');

    if (result.success) {
      let wasLoggedOut = false;
      try {
        wasLoggedOut = sessionStorage.getItem('campus_life_logged_out') === 'true';
        sessionStorage.removeItem('campus_life_logged_out');
      } catch {
        // ignore
      }
      const isFromLogout = wasLoggedOut || Boolean((location.state as any)?.isLogout);
      const deepLink = !isFromLogout ? (location.state as any)?.from?.pathname : null;
      const destination = deepLink && deepLink !== '/login' && deepLink !== '/' ? deepLink : '/dashboard';
      navigate(destination, { replace: true });
    } else {
      setError(result.error || 'Authentication failed. Please verify your password.');
    }
  };

  // Section 13: Forgot Password Dispatcher
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim() || !isValidEmail(resetEmail)) {
      return;
    }

    setIsResetLoading(true);
    await sendPasswordReset(resetEmail.trim().toLowerCase());
    setIsResetLoading(false);
    setResetSent(true);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: 'var(--bg-canvas)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div className="card-body" style={{ padding: '2rem 1.75rem' }}>
          {/* Institutional Header (Section 6) */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--brand-primary)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <GraduationCap size={28} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
              Campus Life
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Unified Campus Operations Platform
            </p>
          </div>

          {/* Inactive Account Error (Section 8) */}
          {isInactiveAlert && (
            <Alert type="danger" className="mb-4">
              Your account is currently inactive. Please contact your administrator.
            </Alert>
          )}

          {/* Form Step 1: Email Address (Section 6 & 7) */}
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-email"
                    type="email"
                    className={`form-input ${error ? 'error' : ''}`}
                    placeholder="Enter registered email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                      if (isInactiveAlert) setIsInactiveAlert(false);
                    }}
                    required
                    autoFocus
                    disabled={isLoading}
                    style={{ paddingLeft: '2.5rem' }}
                    aria-describedby={error ? 'email-error' : 'email-hint'}
                  />
                  <Mail
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>
                {error && (
                  <span id="email-error" className="form-error">
                    {error}
                  </span>
                )}
                <span id="email-hint" className="form-hint">
                  Access is provisioned exclusively through authorized campus records.
                </span>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isLoading}
                  rightIcon={<ArrowRight size={16} />}
                >
                  {isLoading ? loadingText || 'Checking email...' : 'Next'}
                </Button>
              </div>
            </form>
          ) : (
            /* Form Step 2: Password Entry (Section 14 - Subsequent Login) */
            <form onSubmit={handlePasswordSubmit} noValidate>
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Signing In As
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.25rem',
                  }}
                >
                  <span className="truncate-safe" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {email}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => {
                      setStep('email');
                      setPassword('');
                      setError('');
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="login-password" style={{ margin: 0 }}>
                    Enter Password
                  </label>
                  {/* Section 13: Forgot Password */}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: '0.8rem', padding: 0, color: 'var(--brand-primary)' }}
                    onClick={() => {
                      setResetEmail(email);
                      setResetSent(false);
                      setIsForgotPasswordOpen(true);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input ${error ? 'error' : ''}`}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    autoFocus
                    disabled={isLoading}
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  />
                  <Lock
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: '0.25rem',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {error && <span className="form-error">{error}</span>}
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isLoading}
                >
                  {isLoading ? loadingText || 'Signing in...' : 'Login'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Case 1 Modal: Administrator Not Added You Yet (Section 5 & 7) */}
      <Modal
        isOpen={isNotRegisteredModalOpen}
        onClose={() => setIsNotRegisteredModalOpen(false)}
        title="Administrator Not Added You Yet"
        footer={
          <Button variant="primary" onClick={() => setIsNotRegisteredModalOpen(false)}>
            OK
          </Button>
        }
      >
        <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--status-danger-bg)',
              color: 'var(--status-danger)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <ShieldAlert size={32} />
          </div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Access Denied
          </h4>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: '0 auto', maxWidth: '380px' }}>
            Your email address has not been registered by the administrator. Please contact your administrator.
          </p>
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              textAlign: 'left',
            }}
          >
            <strong>Campus Life Security Notice:</strong>
            <div style={{ marginTop: '0.25rem' }}>
              Public registration is disabled. Accounts can only be provisioned by the designated University Administrator.
            </div>
          </div>
        </div>
      </Modal>

      {/* Section 13: Forgot Password Modal */}
      <Modal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        title="Reset Password"
        footer={
          resetSent ? (
            <Button variant="primary" onClick={() => setIsForgotPasswordOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setIsForgotPasswordOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleForgotPasswordSubmit}
                isLoading={isResetLoading}
              >
                Send Reset Link
              </Button>
            </>
          )
        }
      >
        {resetSent ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--status-success-bg)',
                color: 'var(--status-success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Instructions Dispatched</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              If your email is registered in campus records, a password reset link has been sent to <strong>{resetEmail}</strong>.
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Enter your registered institution email address to receive password recovery instructions.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">
                Registered Email
              </label>
              <input
                id="reset-email"
                type="email"
                className="form-input"
                placeholder="yourname@campuslife.edu"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
