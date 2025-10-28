import React from 'react'
import { Card, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error?: Error
  resetError: () => void
}

function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <Card className="error-boundary">
      <CardContent>
        <div className="error-content">
          <div className="error-icon">
            <AlertTriangle size={48} />
          </div>
          <h3>Something went wrong</h3>
          <p>We're sorry, but something unexpected happened.</p>
          {error && (
            <details className="error-details">
              <summary>Error details</summary>
              <pre>{error.message}</pre>
            </details>
          )}
          <Button onClick={resetError} className="retry-button">
            <RefreshCw size={16} />
            Try again
          </Button>
        </div>
      </CardContent>

      <style jsx>{`
        .error-boundary {
          margin: var(--space-8) auto;
          max-width: 400px;
        }

        .error-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          text-align: center;
          padding: var(--space-8);
        }

        .error-icon {
          color: var(--warning);
        }

        .error-content h3 {
          margin: 0;
          color: var(--text);
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
        }

        .error-content p {
          margin: 0;
          color: var(--text-muted);
        }

        .error-details {
          width: 100%;
          max-width: 300px;
        }

        .error-details summary {
          cursor: pointer;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .error-details pre {
          background: var(--bg-subtle);
          padding: var(--space-3);
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 200px;
          overflow-y: auto;
          margin-top: var(--space-2);
        }

        .retry-button {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
      `}</style>
    </Card>
  )
}

// Hook for handling async errors in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = () => setError(null)

  const handleError = React.useCallback((error: any) => {
    console.error('Error handled:', error)
    setError(error instanceof Error ? error : new Error(String(error)))
  }, [])

  if (error) {
    throw error // This will be caught by the nearest ErrorBoundary
  }

  return { handleError, resetError }
}
