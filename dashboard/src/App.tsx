import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './lib/theme-context'
import { AuthProvider } from './lib/auth-context-v2'
import { ErrorBoundary } from './lib/error-boundary'
import AppShell from './components/layout/AppShell'
import Dashboard from './app/dashboard/page'
import Plans from './app/plans/page'
import Recipes from './app/recipes/page'
import Groceries from './app/groceries/page'
import AI from './app/ai/page'
import Settings from './app/settings/page'
import LoginPage from './app/login/page'
import SignupPage from './app/signup/page'
import ForgotPasswordPage from './app/forgot-password/page'
import ResendVerificationPage from './app/resend-verification/page'
import OnboardingWrapperV2 from './components/onboarding/OnboardingWrapperV2'

// Component that wraps protected routes with onboarding
const ProtectedRoutes = () => (
  <OnboardingWrapperV2>
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={
          <AppShell pageTitle="Dashboard" pageSubtitle="Welcome back to Nourish">
            <Dashboard />
          </AppShell>
        } />
        <Route path="/plans" element={
          <AppShell pageTitle="Meal Plans" pageSubtitle="Plan your meals, discover recipes, and stay organized">
            <Plans />
          </AppShell>
        } />
        <Route path="/recipes" element={
          <AppShell pageTitle="Recipes" pageSubtitle="Discover and save delicious recipes">
            <Recipes />
          </AppShell>
        } />
        <Route path="/groceries" element={
          <AppShell pageTitle="Groceries" pageSubtitle="Manage your shopping lists and orders">
            <Groceries />
          </AppShell>
        } />
        <Route path="/ai" element={
          <AppShell pageTitle="Chef Nourish AI" pageSubtitle="Your personal cooking assistant">
            <AI />
          </AppShell>
        } />
        <Route path="/settings" element={
          <AppShell pageTitle="Settings" pageSubtitle="Customize your Nourish experience">
            <Settings />
          </AppShell>
        } />
      </Routes>
    </ErrorBoundary>
  </OnboardingWrapperV2>
)

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <Router>
            <Routes>
              {/* Authentication Routes (no AppShell, no onboarding) */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/resend-verification" element={<ResendVerificationPage />} />
              
              {/* Protected Routes (with AppShell and onboarding) */}
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
