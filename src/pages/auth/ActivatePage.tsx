import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Mail,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  ArrowLeft,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/useAuth';

export const ActivatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    checkEmailAuthorization,
    initiateFirstTimeActivation,
    checkEmailVerified,
    completePasswordSetup
  } = useAuth();

  const queryEmail = searchParams.get('email');

  // Steps: 'email_input' -> 'email_verification' -> 'password_setup' -> 'activated'
  const [step, setStep] = useState<'email_input' | 'email_verification' | 'password_setup' | 'activated'>('email_input');
  const [email, setEmail] = useState(() => queryEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status flags
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isUnauthorizedModalOpen, setIsUnauthorizedModalOpen] = useState(false);

  const startVerificationFlow = useCallback(async (targetEmail: string) => {
    setError('');
    setIsLoading(true);
    setLoadingText('Checking account authorization...');

    const clean = targetEmail.trim().toLowerCase();
    const check = await checkEmailAuthorization(clean);

    if (!check.authorized) {
      setIsLoading(false);
      setIsUnauthorizedModalOpen(true);
      return;
    }

    if (!check.active) {
      setIsLoading(false);
      setError('Your account is currently inactive. Please contact your administrator.');
      return;
    }

    // If already activated, redirect to standard login
    if (check.activated) {
      setIsLoading(false);
      navigate('/login', { replace: true });
      return;
    }

    // Check if email was already verified previously
    setLoadingText('Checking verification status...');
    const isAlreadyVerified = Boolean(check.emailVerified) || (await checkEmailVerified(clean));

    if (isAlreadyVerified) {
      // Skip verification email and move directly to password setup!
      setIsLoading(false);
      setStep('password_setup');
      return;
    }

    setLoadingText('Sending verification email...');
    await initiateFirstTimeActivation(clean);
    setIsLoading(false);
    setStep('email_verification');
    setResendCooldown(30);
  }, [checkEmailAuthorization, checkEmailVerified, initiateFirstTimeActivation, navigate]);

  // Initial dispatch when email query parameter is present on load
  useEffect(() => {
    if (!queryEmail) return;

    let isMounted = true;
    const clean = queryEmail.trim().toLowerCase();
    setEmail(clean);
    setIsLoading(true);
    setLoadingText('Checking account authorization...');

    (async () => {
      try {
        const check = await checkEmailAuthorization(clean);
        if (!isMounted) return;

        if (!check.authorized) {
          setIsLoading(false);
          setIsUnauthorizedModalOpen(true);
          setStep('email_input');
          return;
        }

        if (!check.active) {
          setIsLoading(false);
          setError('Your account is currently inactive. Please contact your administrator.');
          setStep('email_input');
          return;
        }

        if (check.activated) {
          setIsLoading(false);
          navigate('/login', { replace: true });
          return;
        }

        // Check if user already verified their email previously
        setLoadingText('Checking verification status...');
        const isAlreadyVerified = Boolean(check.emailVerified) || (await checkEmailVerified(clean));
        if (!isMounted) return;

        setIsLoading(false);
        if (isAlreadyVerified) {
          // Skip email verification! Go straight to password setup!
          setStep('password_setup');
        } else {
          // Send verification email and show verification step
          setIsLoading(true);
          setLoadingText('Sending verification email...');
          await initiateFirstTimeActivation(clean);
          if (!isMounted) return;
          setIsLoading(false);
          setStep('email_verification');
          setResendCooldown(30);
        }
      } catch {
        if (!isMounted) return;
        setIsLoading(false);
        setError('Failed to verify account authorization.');
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [queryEmail, checkEmailAuthorization, checkEmailVerified, initiateFirstTimeActivation, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleInitialEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your authorized institution email.');
      return;
    }
    startVerificationFlow(email.trim().toLowerCase());
  };

  // Section 10: Check actual Firebase email verification status
  const handleCheckEmailVerified = async () => {
    setIsLoading(true);
    setLoadingText('Checking verification status...');
    setVerificationFeedback(null);
    setError('');

    const verified = await checkEmailVerified(email.trim().toLowerCase());
    setIsLoading(false);

    if (verified) {
      setStep('password_setup');
    } else {
      setVerificationFeedback('Verification link has not been confirmed yet. Please open the link received in your inbox and retry.');
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setLoadingText('Resending verification email...');
    await initiateFirstTimeActivation(email.trim().toLowerCase());
    setIsLoading(false);
    setResendCooldown(30);
    setVerificationFeedback('A fresh verification link has been sent to your email.');
  };

  // Section 6 & 12: Strict password criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please satisfy all password security requirements.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Activating account credentials...');
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const result = await completePasswordSetup(password, cleanEmail);
    setIsLoading(false);

    if (result.success) {
      // Directly log into dashboard!
      navigate('/dashboard', { replace: true });
    } else {
      setError(result.error || 'Failed to complete password configuration.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        backgroundColor: 'var(--bg-canvas)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-xl, 16px)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div className="card-body" style={{ padding: '2.5rem 2.25rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 'var(--radius-xl, 16px)',
                backgroundColor: 'var(--brand-primary)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.15rem',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)',
              }}
            >
              <ShieldCheck size={30} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
              First-Time Account Activation
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              Step-by-step verification and initial credential initialization
            </p>
          </div>

          {error && (
            <Alert type="danger" className="mb-4">
              {error}
            </Alert>
          )}

          {/* STEP 1: Enter Email (if not pre-populated) */}
          {step === 'email_input' && (
            <form onSubmit={handleInitialEmailSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="activate-email">
                  Authorized Campus Email
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="activate-email"
                    type="email"
                    className="form-input"
                    placeholder="e.g. new.student@campuslife.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={isLoading}
                    style={{ paddingLeft: '2.5rem' }}
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
                <span className="form-hint">
                  Activation is available only for emails registered by the administrator.
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
                  {isLoading ? loadingText || 'Verifying email...' : 'Start Activation'}
                </Button>
              </div>

              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <Link to="/login" style={{ fontSize: '0.85rem' }}>
                  Return to Login
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Email Verification Screen (Section 10) */}
          {step === 'email_verification' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--brand-primary-light)',
                    color: 'var(--brand-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.75rem',
                  }}
                >
                  <Mail size={24} />
                </div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>Verify Your Email</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  We sent a verification link to your registered email address:
                </p>
                <div style={{ fontWeight: 600, color: 'var(--brand-primary)', marginTop: '0.25rem' }}>
                  {email}
                </div>
              </div>

              {verificationFeedback && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <Alert type="warning">{verificationFeedback}</Alert>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleCheckEmailVerified}
                  isLoading={isLoading}
                  leftIcon={<CheckCircle2 size={16} />}
                >
                  {isLoading ? loadingText || 'Checking status...' : "I've verified my email"}
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleResendEmail}
                  disabled={resendCooldown > 0 || isLoading}
                  leftIcon={<RefreshCw size={16} />}
                >
                  {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend verification email'}
                </Button>

                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setStep('email_input')}
                  leftIcon={<ArrowLeft size={16} />}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Password Setup & Confirmation (Section 6 & 12) */}
          {step === 'password_setup' && (
            <form onSubmit={handlePasswordSubmit} noValidate>
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--status-success-bg)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-success-text)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>Email confirmed! Please establish your personal login password.</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="setup-password">
                  Set Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="setup-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="e.g. Campus2026"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="setup-confirm-password">
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="setup-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
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
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
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
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Password Validation Checklist (Section 6 & 12) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  marginBottom: '1.25rem',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  Required Security Criteria:
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: hasMinLength ? 'var(--status-success-text)' : 'var(--text-muted)',
                  }}
                >
                  <Check size={14} /> At least 8 characters
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: hasUppercase ? 'var(--status-success-text)' : 'var(--text-muted)',
                  }}
                >
                  <Check size={14} /> At least one uppercase letter (A-Z)
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: hasLowercase ? 'var(--status-success-text)' : 'var(--text-muted)',
                  }}
                >
                  <Check size={14} /> At least one lowercase letter (a-z)
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: hasNumber ? 'var(--status-success-text)' : 'var(--text-muted)',
                  }}
                >
                  <Check size={14} /> At least one number (0-9)
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: passwordsMatch ? 'var(--status-success-text)' : 'var(--text-muted)',
                  }}
                >
                  <Check size={14} /> Passwords match exactly
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={!isPasswordValid || isLoading}
                isLoading={isLoading}
              >
                {isLoading ? loadingText || 'Saving credentials...' : 'Continue'}
              </Button>
            </form>
          )}

          {/* STEP 4: Activation Complete (Section 11) */}
          {step === 'activated' && (
            <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                <CheckCircle2 size={34} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Account Activated!</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Your initial password setup is finalized. For all future logins, simply use your registered email and password.
              </p>
              <Button variant="primary" fullWidth onClick={() => navigate('/dashboard')}>
                Enter Campus Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Case 1 Modal: Administrator Not Added You Yet */}
      <Modal
        isOpen={isUnauthorizedModalOpen}
        onClose={() => setIsUnauthorizedModalOpen(false)}
        title="Administrator Not Added You Yet"
        footer={
          <Button variant="primary" onClick={() => setIsUnauthorizedModalOpen(false)}>
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
            <ShieldCheck size={32} />
          </div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Authorization Required
          </h4>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Your email address has not been registered by the administrator. Please contact your administrator.
          </p>
        </div>
      </Modal>
    </div>
  );
};
