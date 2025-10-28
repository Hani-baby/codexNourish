interface LogContext {
  [key: string]: unknown
}

interface Logger {
  info: (message: string, context?: LogContext, emoji?: string) => void
  warn: (message: string, context?: LogContext, emoji?: string) => void
  error: (message: string, context?: LogContext, emoji?: string) => void
  child: (scope: string, defaultEmoji?: string) => Logger
}

const formatContext = (context?: LogContext) => {
  if (!context || Object.keys(context).length === 0) {
    return ''
  }
  try {
    return ` - ${JSON.stringify(context)}`
  } catch {
    return ''
  }
}

const joinScopes = (parent: string, child: string) => {
  const trimmedChild = child.trim()
  if (!trimmedChild) {
    return parent
  }
  return `${parent} > ${trimmedChild}`
}

const createLogger = (scope: string, defaultEmoji = '[i]'): Logger => {
  const normalizedScope = scope.trim() ? scope : 'EdgeFn'
  const emit = (
    level: 'log' | 'warn' | 'error',
    message: string,
    context?: LogContext,
    emoji?: string,
  ) => {
    const symbol = emoji ?? defaultEmoji
    const line = `${symbol} ${normalizedScope}: ${message}${formatContext(context)}`
    console[level](line)
  }

  return {
    info(message: string, context?: LogContext, emoji?: string) {
      emit('log', message, context, emoji)
    },
    warn(message: string, context?: LogContext, emoji?: string) {
      emit('warn', message, context, emoji ?? defaultEmoji)
    },
    error(message: string, context?: LogContext, emoji?: string) {
      emit('error', message, context, emoji ?? defaultEmoji)
    },
    child(childScope: string, childEmoji?: string) {
      return createLogger(joinScopes(normalizedScope, childScope), childEmoji ?? defaultEmoji)
    },
  }
}

export const rootLogger = createLogger('EdgeFn')
export const orchestratorLogger = createLogger('Orchestrator', '[or]')

export { createLogger }
export type { Logger, LogContext }
