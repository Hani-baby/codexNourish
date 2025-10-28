import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2';
import { useTheme } from '../../lib/theme-context';
import { Mail, Lock, User, AlertCircle, Sun, Moon, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';

const SignupPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{ isValid: boolean; message: string }>({ isValid: false, message: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp, user, profile, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated and verified
  useEffect(() => {
    if (!loading && user?.email_confirmed_at) {
      // If profile is still loading, wait for it
      if (profile === undefined) {
        return;
      }
      
      // Determine redirect destination based on onboarding status
      let destination = '/';
      
      // If user has a profile and onboarding is complete, go to dashboard
      if (profile && profile.onboarding_complete) {
        destination = location.state?.from?.pathname || '/';
      }
      // If no profile or onboarding incomplete, they'll be redirected to onboarding by OnboardingWrapper
      
      console.log('Auto-redirecting authenticated user from signup to:', destination);
      navigate(destination, { replace: true });
    }
  }, [user, profile, loading, navigate, location.state]);

  // Update password strength when password changes
  useEffect(() => {
    if (password) {
      setPasswordStrength(validatePassword(password));
    } else {
      setPasswordStrength({ isValid: false, message: '' });
    }
  }, [password]);

  const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    
    if (!/(?=.*\d)/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character (@$!%*?&)' };
    }
    
    return { isValid: true, message: 'Password is strong!' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (!passwordStrength.isValid) {
      setError(passwordStrength.message);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signUp(email, password, {
        display_name: name
      });
      
      if (error) {
        setError(error.message);
      } else {
        // Success - redirect to login with success message
        navigate('/login', { 
          state: { 
            message: 'Account created successfully! Please check your email to verify your account before signing in.' 
          } 
        });
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingScreen 
        title="Nourish"
        subtitle="Loading your profile..."
      />
    );
  }

  return (
    <div className="auth-page">
      {/* Background Pattern */}
      <div className="auth-background">
        <div className="auth-pattern" />
      </div>

      {/* Theme Toggle */}
      <div className="auth-theme-toggle">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          leftIcon={theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        >
          {theme === 'light' ? 'Dark' : 'Light'}
        </Button>
      </div>

      {/* Back to Website */}
      <div className="auth-back-link">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.href = 'http://localhost:3000'}
          leftIcon={<ArrowLeft size={16} />}
        >
          Back to Website
        </Button>
      </div>

      <div className="auth-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="auth-card"
        >
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo-container">
              <img src="/mascot.png" alt="Nourish Mascot" className="auth-logo-icon" />
            </div>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">
              Join thousands of users who are transforming their nutrition journey with Nourish
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="auth-message auth-message-error"
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="name" className="auth-label">
                Full name
              </label>
              <div className="auth-input-container">
                <User size={20} className="auth-input-icon" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="email" className="auth-label">
                Email address
              </label>
              <div className="auth-input-container">
                <Mail size={20} className="auth-input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">
                Password
              </label>
              <div className="auth-input-container">
                <Lock size={20} className="auth-input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-password-toggle"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="auth-password-strength"
                >
                  <div className={`auth-strength-text ${passwordStrength.isValid ? 'auth-strength-valid' : 'auth-strength-invalid'}`}>
                    {passwordStrength.message}
                  </div>
                </motion.div>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword" className="auth-label">
                Confirm password
              </label>
              <div className="auth-input-container">
                <Lock size={20} className="auth-input-icon" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="auth-password-toggle"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="auth-password-strength"
                >
                  <div className="auth-strength-text auth-strength-invalid">
                    Passwords do not match
                  </div>
                </motion.div>
              )}
            </div>

            <Button
              type="submit"
              variant="solid"
              size="lg"
              disabled={isLoading || !passwordStrength.isValid || password !== confirmPassword}
              className="auth-submit"
            >
              {isLoading ? (
                <>
                  <div className="auth-spinner" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="auth-footer">
            <div className="auth-divider">
              <span>Already have an account?</span>
            </div>
            <Link to="/login">
              <Button variant="outline" size="lg" className="auth-link-button">
                Sign in to your account
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--brand-50) 0%, var(--bg) 100%);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          padding-top: calc(var(--space-4) + 60px);
        }

        .auth-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          z-index: 0;
        }

        .auth-pattern {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background-image: radial-gradient(circle at 25% 25%, var(--brand-100) 0%, transparent 50%),
                          radial-gradient(circle at 75% 75%, var(--brand-200) 0%, transparent 50%);
          opacity: 0.3;
          animation: float 20s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-20px, -20px) rotate(180deg); }
        }

        .auth-theme-toggle {
          position: fixed;
          top: var(--space-4);
          right: var(--space-4);
          z-index: 1000;
        }

        .auth-back-link {
          position: fixed;
          top: var(--space-4);
          left: var(--space-4);
          z-index: 1000;
        }

        .auth-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
        }

        .auth-card {
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-2xl);
          padding: var(--space-8);
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(10px);
        }

        .auth-header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .auth-logo-container {
          margin-bottom: var(--space-4);
        }

        .auth-logo-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto;
          border-radius: var(--radius-2xl);
          box-shadow: var(--shadow-md);
          object-fit: cover;
        }

        .auth-title {
          font-size: var(--text-3xl);
          font-weight: var(--font-bold);
          color: var(--text);
          margin: 0 0 var(--space-2) 0;
        }

        .auth-subtitle {
          font-size: var(--text-base);
          color: var(--text-muted);
          margin: 0;
          line-height: 1.5;
        }

        .auth-message {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-4);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        .auth-message-error {
          background-color: rgba(225, 77, 77, 0.1);
          color: var(--danger);
          border: 1px solid rgba(225, 77, 77, 0.2);
        }

        .auth-form {
          margin-bottom: var(--space-6);
        }

        .auth-field {
          margin-bottom: var(--space-4);
        }

        .auth-label {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
          margin-bottom: var(--space-2);
        }

        .auth-input-container {
          position: relative;
        }

        .auth-input-icon {
          position: absolute;
          left: var(--space-3);
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          z-index: 1;
        }

        .auth-input {
          width: 100%;
          padding: var(--space-3) 48px var(--space-3) 48px;
          background-color: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: var(--radius-lg);
          font-size: var(--text-base);
          color: var(--input-text);
          transition: all var(--transition-fast);
          box-sizing: border-box;
        }

        .auth-input::placeholder {
          color: var(--input-placeholder);
        }

        .auth-input:focus {
          outline: none;
          border-color: var(--brand-500);
          box-shadow: 0 0 0 3px var(--brand-100);
        }

        .auth-password-toggle {
          position: absolute;
          right: var(--space-3);
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: var(--space-1);
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast);
          z-index: 1;
        }

        .auth-password-toggle:hover {
          color: var(--text);
        }

        .auth-password-strength {
          margin-top: var(--space-2);
        }

        .auth-strength-text {
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
        }

        .auth-strength-valid {
          color: var(--brand-500);
        }

        .auth-strength-invalid {
          color: var(--danger);
        }

        .auth-submit {
          width: 100%;
        }

        .auth-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: var(--space-2);
        }

        .auth-footer {
          text-align: center;
        }

        .auth-divider {
          position: relative;
          margin-bottom: var(--space-4);
        }

        .auth-divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background-color: var(--border);
        }

        .auth-divider span {
          background-color: var(--panel);
          padding: 0 var(--space-4);
          color: var(--text-muted);
          font-size: var(--text-sm);
          position: relative;
        }

        .auth-link-button {
          width: 100%;
        }

        @media (max-width: 480px) {
          .auth-page {
            padding: var(--space-2);
          }

          .auth-card {
            padding: var(--space-6);
          }

          .auth-theme-toggle,
          .auth-back-link {
            position: fixed;
            z-index: 1000;
          }

          .auth-theme-toggle {
            top: var(--space-2);
            right: var(--space-2);
          }

          .auth-back-link {
            top: var(--space-2);
            left: var(--space-2);
          }
        }
      `}</style>
    </div>
  );
};

export default SignupPage;