import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../../lib/theme-context';
import { Mail, AlertCircle, CheckCircle, Sun, Moon, ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-background">
          <div className="auth-pattern" />
        </div>

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
            <div className="auth-header">
              <div className="auth-logo-container">
                <img src="/mascot.png" alt="Nourish Mascot" className="auth-logo-icon" />
              </div>
              <h1 className="auth-title">Check your email</h1>
              <p className="auth-subtitle">
                We've sent password reset instructions to {email}
              </p>
            </div>

            <div className="auth-message auth-message-success">
              <CheckCircle size={20} />
              <span>Password reset email sent successfully!</span>
            </div>

            <div className="auth-footer">
              <Link to="/login">
                <Button variant="outline" size="lg" className="auth-link-button">
                  Back to Login
                </Button>
              </Link>
              <p className="auth-footer-text">
                Didn't receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => setSuccess(false)}
                  className="auth-text-link"
                >
                  try again
                </button>
              </p>
            </div>
          </motion.div>
        </div>

        <style jsx>{`
          .auth-page {
            min-height: 100vh;
            background: linear-gradient(135deg, var(--brand-50) 0%, var(--bg) 100%);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-4);
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
            position: absolute;
            top: var(--space-6);
            right: var(--space-6);
            z-index: 10;
          }

          .auth-back-link {
            position: absolute;
            top: var(--space-6);
            left: var(--space-6);
            z-index: 10;
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
            margin-bottom: var(--space-6);
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
            margin-bottom: var(--space-6);
            font-size: var(--text-sm);
            font-weight: var(--font-medium);
          }

          .auth-message-success {
            background-color: var(--brand-50);
            color: var(--brand-700);
            border: 1px solid var(--brand-200);
          }

          .auth-footer {
            text-align: center;
          }

          .auth-link-button {
            width: 100%;
            margin-bottom: var(--space-4);
          }

          .auth-footer-text {
            font-size: var(--text-sm);
            color: var(--text-muted);
            margin: 0;
            line-height: 1.5;
          }

          .auth-text-link {
            color: var(--brand-500);
            text-decoration: none;
            background: none;
            border: none;
            cursor: pointer;
            font-size: inherit;
            padding: 0;
            margin: 0;
          }

          .auth-text-link:hover {
            color: var(--brand-600);
            text-decoration: underline;
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
  }

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="auth-pattern" />
      </div>

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
          <div className="auth-header">
            <div className="auth-logo-container">
              <img src="/mascot.png" alt="Nourish Mascot" className="auth-logo-icon" />
            </div>
            <h1 className="auth-title">Forgot password?</h1>
            <p className="auth-subtitle">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>

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
                  Sending reset link...
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>

          <div className="auth-footer">
            <div className="auth-divider">
              <span>Remember your password?</span>
            </div>
            <Link to="/login">
              <Button variant="outline" size="lg" className="auth-link-button">
                Back to Login
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>

      <style jsx>{`
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
          margin-bottom: var(--space-6);
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

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
            top: var(--space-4);
          }

          .auth-theme-toggle {
            right: var(--space-4);
          }

          .auth-back-link {
            left: var(--space-4);
          }
        }
      `}</style>
    </div>
  );
};

export default ForgotPasswordPage;
