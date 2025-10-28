import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, 
  Calendar, 
  ChefHat, 
  ShoppingCart, 
  Bot,
  Settings,
  X,
  TestTube
} from 'lucide-react'
import logoImg from '../../../images/logo.png'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  variant: 'expanded' | 'collapsed' | 'mobile'
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Meal Plans', href: '/plans', icon: Calendar },
  { name: 'Recipes', href: '/recipes', icon: ChefHat },
  { name: 'Groceries', href: '/groceries', icon: ShoppingCart },
  { name: 'Chef Nourish AI', href: '/ai', icon: Bot, special: true },
  { name: 'Testing', href: '/testing', icon: TestTube },
]

export default function Sidebar({ isOpen, onClose, variant }: SidebarProps) {
  const location = useLocation()

  const isActive = (href: string) => {
    return href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)
  }

  if (variant === 'mobile') {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="sidebar-overlay"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="sidebar sidebar-mobile"
            >
              <SidebarContent 
                navigation={navigation}
                isActive={isActive}
                onClose={onClose}
                variant={variant}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    )
  }

  return (
    <aside className={`sidebar sidebar-${variant}`}>
      <SidebarContent 
        navigation={navigation}
        isActive={isActive}
        onClose={onClose}
        variant={variant}
      />
    </aside>
  )
}

interface SidebarContentProps {
  navigation: typeof navigation
  isActive: (href: string) => boolean
  onClose: () => void
  variant: 'expanded' | 'collapsed' | 'mobile'
}

function SidebarContent({ navigation, isActive, onClose, variant }: SidebarContentProps) {
  const showLabels = variant === 'expanded' || variant === 'mobile'

  return (
    <>
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <img src={logoImg} alt="Nourish Logo" />
          </div>
          {showLabels && <span className="logo-text">Nourish</span>}
        </div>
        {variant === 'mobile' && (
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            onClick={variant === 'mobile' ? onClose : undefined}
            className={`nav-item ${isActive(item.href) ? 'active' : ''} ${item.special ? 'special' : ''}`}
            title={!showLabels ? item.name : undefined}
          >
            <div className="nav-icon">
              <item.icon size={20} />
            </div>
            {showLabels && <span className="nav-label">{item.name}</span>}
            {isActive(item.href) && <div className="active-indicator" />}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link
          to="/settings"
          onClick={variant === 'mobile' ? onClose : undefined}
          className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
          title={!showLabels ? 'Settings' : undefined}
        >
          <div className="nav-icon">
            <Settings size={20} />
          </div>
          {showLabels && <span className="nav-label">Settings</span>}
          {isActive('/settings') && <div className="active-indicator" />}
        </Link>
      </div>

      <style jsx>{`
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-6);
          border-bottom: 1px solid var(--border);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--text-lg);
          background: var(--brand-500);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .logo-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        [data-theme="dark"] .logo-icon {
          background: var(--brand-400);
        }

        .logo-text {
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
          color: var(--text);
        }

        .close-button {
          padding: var(--space-2);
          color: var(--icon);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .close-button:hover {
          background-color: var(--hover-bg);
        }

        .sidebar-nav {
          flex: 1;
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .sidebar-footer {
          padding: var(--space-4);
          border-top: 1px solid var(--border);
        }

        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          border-radius: var(--radius-lg);
          color: var(--text-muted);
          transition: all var(--transition-fast);
          text-decoration: none;
          min-height: 44px;
        }

        .nav-item:hover {
          background-color: var(--hover-bg);
          color: var(--text);
        }

        .nav-item.active {
          background-color: var(--brand-50);
          color: var(--brand-500);
        }

        [data-theme="dark"] .nav-item.active {
          background-color: var(--brand-100);
          color: var(--brand-400);
          box-shadow: 0 0 0 1px var(--brand-400);
        }

        .nav-item.special:hover {
          box-shadow: 0 0 20px var(--brand-200);
        }

        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .nav-label {
          font-weight: var(--font-medium);
          font-size: var(--text-sm);
        }

        .active-indicator {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background-color: var(--brand-500);
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }

        [data-theme="dark"] .active-indicator {
          background-color: var(--brand-400);
        }
      `}</style>

      <style jsx>{`
        :global(.sidebar) {
          background-color: var(--panel);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        :global(.sidebar-expanded) {
          width: var(--sidebar-width-expanded);
        }

        :global(.sidebar-collapsed) {
          width: var(--sidebar-width-collapsed);
        }

        :global(.sidebar-mobile) {
          position: fixed;
          top: 0;
          left: 0;
          width: var(--sidebar-width-expanded);
          z-index: var(--z-modal);
          box-shadow: var(--shadow-lg);
        }

        :global(.sidebar-overlay) {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: var(--z-modal-backdrop);
        }

        @media (max-width: 767px) {
          :global(.sidebar-collapsed) {
            display: none;
          }
        }
      `}</style>
    </>
  )
}
