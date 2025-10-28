/**
 * Timeout and retry utilities for robust async operations
 */

export class TimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

export class RetryError extends Error {
  constructor(operation: string, attempts: number, lastError: Error) {
    super(`Operation '${operation}' failed after ${attempts} attempts: ${lastError.message}`)
    this.name = 'RetryError'
    this.cause = lastError
  }
}

/**
 * Run a promise with a timeout deadline
 */
export async function withDeadline<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operation: string = 'operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(operation, timeoutMs)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

/**
 * Retry a function with exponential backoff and jitter
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    baseDelayMs?: number
    maxDelayMs?: number
    operation?: string
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 2000,
    operation = 'operation',
    shouldRetry = () => true
  } = options

  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw new RetryError(operation, attempt, lastError)
      }

      // Exponential backoff with jitter
      const delayMs = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100,
        maxDelayMs
      )
      
      console.warn(`${operation} attempt ${attempt} failed, retrying in ${delayMs.toFixed(0)}ms:`, lastError.message)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw new RetryError(operation, maxAttempts, lastError!)
}

/**
 * Create a cancellable promise that can be aborted
 */
export function makeCancellable<T>(promise: Promise<T>): {
  promise: Promise<T>
  cancel: () => void
  isCancelled: () => boolean
} {
  let cancelled = false
  let rejectFn: (reason?: any) => void

  const cancellablePromise = new Promise<T>((resolve, reject) => {
    rejectFn = reject
    
    promise
      .then(value => {
        if (!cancelled) resolve(value)
      })
      .catch(error => {
        if (!cancelled) reject(error)
      })
  })

  return {
    promise: cancellablePromise,
    cancel: () => {
      cancelled = true
      rejectFn?.(new Error('Operation cancelled'))
    },
    isCancelled: () => cancelled
  }
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Performance measurement utility
 */
export class PerfTimer {
  private startTime: number
  private marks: Map<string, number> = new Map()

  constructor(private operation: string) {
    this.startTime = performance.now()
  }

  mark(label: string): void {
    this.marks.set(label, performance.now() - this.startTime)
  }

  finish(): { operation: string, totalMs: number, marks: Record<string, number> } {
    const totalMs = performance.now() - this.startTime
    const marks: Record<string, number> = {}
    
    this.marks.forEach((time, label) => {
      marks[label] = Math.round(time * 100) / 100
    })

    return {
      operation: this.operation,
      totalMs: Math.round(totalMs * 100) / 100,
      marks
    }
  }
}
