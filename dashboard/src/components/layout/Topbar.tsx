import React, { useState } from 'react'
import { Menu, Sun, Moon, Bell, User, LogOut, Settings } from 'lucide-react'
import { useTheme } from '../../lib/theme-context'
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2'
import { useMediaQuery } from '../../lib/hooks'
import logoImg from '../../../images/logo.png'

interface TopbarProps {
  onMenuClick: () => void
  pageTitle?: string
  pageSubtitle?: string
}

export default function Topbar({ onMenuClick, pageTitle = "Dashboard", pageSubtitle = "Welcome back to Nourish" }: TopbarProps) {
  const { theme, toggleTheme } = useTheme()
  const { user, profile, signOut } = useAuth()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  return (
    <header className="topbar">
      <div className="topbar-left">
        {isMobile && (
          <button onClick={onMenuClick} className="menu-button">
            <Menu size={20} />
          </button>
        )}
        <div className="logo-container">
          <img src={logoImg} alt="Nourish Logo" className="topbar-logo" />
        </div>
        <div className="page-info">
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        <button onClick={toggleTheme} className="icon-button" title="Toggle theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <button className="icon-button" title="Notifications">
          <Bell size={20} />
          <span className="notification-badge">3</span>
        </button>

        <div className="profile-dropdown">
          <button 
            className="profile-button" 
            title="Profile menu"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="profile-avatar" />
            ) : (
              <User size={20} />
            )}
          </button>
          
          {showProfileMenu && (
            <div className="profile-menu">
              <div className="profile-info">
                <div className="profile-name">
                  {profile?.display_name || user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="profile-email">{user?.email}</div>
              </div>
              <div className="profile-divider"></div>
              <button className="profile-menu-item" onClick={() => setShowProfileMenu(false)}>
                <Settings size={16} />
                Settings
              </button>
              <button className="profile-menu-item logout" onClick={() => signOut()}>
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .topbar {
          height: var(--topbar-height);
          background-color: var(--panel);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-6);
          position: sticky;
          top: 0;
          z-index: var(--z-sticky);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .logo-container {
          display: flex;
          align-items: center;
        }

        .topbar-logo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .menu-button {
          padding: var(--space-2);
          color: var(--icon);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .menu-button:hover {
          background-color: var(--hover-bg);
        }

        .page-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .page-title {
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }

        .page-subtitle {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .icon-button {
          position: relative;
          padding: var(--space-2);
          color: var(--icon);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-button:hover {
          background-color: var(--hover-bg);
        }

        .profile-dropdown {
          position: relative;
        }

        .profile-button {
          padding: var(--space-2);
          color: var(--icon);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-button:hover {
          background-color: var(--hover-bg);
        }

        .profile-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }

        .profile-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          min-width: 200px;
          z-index: var(--z-dropdown);
          margin-top: var(--space-2);
        }

        .profile-info {
          padding: var(--space-4);
        }

        .profile-name {
          font-weight: var(--font-semibold);
          color: var(--text);
          margin-bottom: var(--space-1);
        }

        .profile-email {
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .profile-divider {
          height: 1px;
          background: var(--border);
          margin: var(--space-2) 0;
        }

        .profile-menu-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          text-align: left;
          color: var(--text);
          font-size: var(--text-sm);
          transition: all var(--transition-fast);
        }

        .profile-menu-item:hover {
          background-color: var(--hover-bg);
        }

        .profile-menu-item.logout {
          color: var(--danger);
          border-top: 1px solid var(--border);
          margin-top: var(--space-1);
        }

        .notification-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background-color: var(--danger);
          color: white;
          font-size: 10px;
          font-weight: var(--font-semibold);
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        @media (max-width: 767px) {
          .topbar {
            padding: 0 var(--space-4);
          }

          .page-subtitle {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}
