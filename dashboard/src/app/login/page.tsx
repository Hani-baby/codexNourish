import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2';
import { useTheme } from '../../lib/theme-context';
import { Mail, Lock, AlertCircle, CheckCircle, Sun, Moon, ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, profile, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
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
      
      console.log('Auto-redirecting authenticated user to:', destination);
      navigate(destination, { replace: true });
    }
  }, [user, profile, loading, navigate, location.state]);

  // Check for success message from signup
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the state to prevent showing the message again on refresh
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        setError(error.message);
      } else {
        // Success - user will be redirected by useEffect
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
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
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">
              Sign in to your Nourish account to continue your nutrition journey
            </p>
          </div>

          {/* Messages */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="auth-message auth-message-success"
            >
              <CheckCircle size={20} />
              <span>{successMessage}</span>
            </motion.div>
          )}

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
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="auth-forgot">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="auth-forgot-link"
              >
                Forgot your password?
              </button>
              <Link to="/resend-verification" className="auth-forgot-link">
                Resend verification email
              </Link>
            </div>

            <Button
              type="submit"
              variant="solid"
              size="lg"
              disabled={isLoading}
              className="auth-submit"
            >
              {isLoading ? (
                <>
                  <div className="auth-spinner" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="auth-footer">
            <div className="auth-divider">
              <span>New to Nourish?</span>
            </div>
            <Link to="/signup">
              <Button variant="outline" size="lg" className="auth-link-button">
                Create your account
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

        .auth-message-success {
          background-color: var(--brand-50);
          color: var(--brand-700);
          border: 1px solid var(--brand-200);
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
          padding: var(--space-3) var(--space-3) var(--space-3) 48px;
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

        .auth-forgot {
          text-align: right;
          margin-bottom: var(--space-6);
          display: flex;
          justify-content: space-between;
          gap: var(--space-2);
        }

        .auth-forgot-link {
          font-size: var(--text-sm);
          color: var(--brand-500);
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          transition: color var(--transition-fast);
        }

        .auth-forgot-link:hover {
          color: var(--brand-600);
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

export default LoginPage;
