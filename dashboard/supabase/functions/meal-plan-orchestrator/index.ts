import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'

import { orchestratorLogger } from '../_shared/logger.ts'
import {
  AuthorizationError,
  AsyncJobRecord,
  NormalizedMealPlanRequest,
  OrchestratorError,
  RecipeAssignmentResult,
  RecipeAssignmentRunStats,
  RecipeAssignmentResumeHint,
  RecipeAssignerRunPayload,
  TransientError,
  ValidationError,
} from '../_shared/types.ts'
import {
  appendJobMeta,
  createJob,
  findActiveJobBySignature,
  markJobCompleted,
  markJobFailed,
  markJobProcessing,
  updateJobProgress,
} from './_shared/job-manager.ts'
import { validateAndNormalizePayload } from '../_shared/validation.ts'
import { generateMealPlanDraft } from './_shared/generate-meal-plan-draft.ts'
import { handleCors, createJsonResponse, createErrorResponse } from '../_shared/cors.ts'

const logger = orchestratorLogger
const cleanupLogger = orchestratorLogger.child('Cleanup')

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables', {}, '🛑')
  throw new Error('Supabase environment not configured')
}

const MAX_ATTEMPTS = 3
const MAX_ASSIGNER_RUNS = 6
const BACKOFF_DELAYS = [4000, 8000, 16000]

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  createJsonResponse(body, status)

const extractAccessToken = (req: Request): string => {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer', '').trim()
  if (!token) {
    throw new AuthorizationError('Missing bearer token')
  }
  return token
}

const ensureHouseholdAccess = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  householdId: string,
) => {
  const { data, error } = await client
    .from('household_members')
    .select('role, status')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .maybeSingle()

  if (error) {
    throw new OrchestratorError('Failed to verify household membership', 500, error)
  }

  if (!data || data.status !== 'active') {
    throw new AuthorizationError('User does not have access to this household')
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface RecipeAssignerRunResult {
  assignments: RecipeAssignmentResult[]
  stats: RecipeAssignmentRunStats
  hasMore: boolean
  resumeHint: RecipeAssignmentResumeHint | null
  status: 'partial' | 'completed'
}

const callRecipeAssigner = async (
  draftId: string,
  normalized: NormalizedMealPlanRequest,
  serviceRoleKey: string,
): Promise<RecipeAssignerRunResult> => {
  const assignerPayload = {
    draft_id: draftId,
    household_id: normalized.household_id,
    user_id: normalized.user_id,
  }

  logger.info('Calling recipe-assigner', {
    draft_id: draftId,
    household_id: normalized.household_id,
    user_id: normalized.user_id,
  }, '🔧')

  const response = await fetch(`${supabaseUrl}/functions/v1/recipe-assigner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(assignerPayload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Recipe assigner responded with status ${response.status}`
    try {
      const errorBody = JSON.parse(errorText)
      errorMessage = errorBody.error || errorBody.message || errorMessage
    } catch {
      // Use default error message if parsing fails
    }
    throw new Error(errorMessage)
  }

  const responseBody = await response.json()
  if (!responseBody.success) {
    throw new Error(responseBody.error || 'Recipe assigner failed')
  }

  const payload = responseBody as Partial<RecipeAssignerRunPayload>

  const stats: RecipeAssignmentRunStats = {
    totalItems: payload?.stats?.totalItems ?? 0,
    assignedBeforeRun: payload?.stats?.assignedBeforeRun ?? 0,
    assignedThisRun: payload?.stats?.assignedThisRun ?? 0,
    totalAssigned: payload?.stats?.totalAssigned ?? 0,
    remaining: payload?.stats?.remaining ?? 0,
    elapsedMs: payload?.stats?.elapsedMs ?? 0,
    nextItemIndex:
      typeof payload?.stats?.nextItemIndex === "number" ? payload?.stats?.nextItemIndex : null,
    pendingAssignments: payload?.stats?.pendingAssignments ?? payload?.stats?.pending_assignments ?? 0,
  }

  const hasMore = Boolean(payload.has_more) || payload.status === 'partial'
  const status = payload.status === 'partial' ? 'partial' : 'completed'

  logger.info('Recipe assigner run completed', {
    draft_id: draftId,
    status,
    has_more: hasMore,
    assigned_this_run: stats.assignedThisRun,
    total_assigned: stats.totalAssigned,
    remaining: stats.remaining,
  }, hasMore ? '??' : '??')

  return {
    assignments: Array.isArray(payload.assignments) ? payload.assignments : [],
    stats,
    hasMore,
    resumeHint: payload.resume_hint ?? null,
    status,
  }
}

const cleanupFailedDrafts = async (jobId: string, errorMessage: string) => {
  try {
    const { data, error } = await serviceClient
      .from('meal_plan_drafts')
      .select('id, created_at, error_message')
      .eq('job_id', jobId)
      .eq('status', 'failed')
      .order('created_at', { ascending: true })

    if (error) {
      cleanupLogger.warn('Failed to query drafts for cleanup', { job_id: jobId, error: error.message })
      return
    }

    const drafts = (data ?? []).filter(
      (row) => typeof row.error_message === 'string' && row.error_message === errorMessage,
    )

    if (drafts.length <= 1) {
      return
    }

    const [, ...duplicates] = drafts
    const idsToDelete = duplicates.map((row) => row.id)

    const { error: deleteError } = await serviceClient
      .from('meal_plan_drafts')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      cleanupLogger.warn('Failed to delete duplicate failed drafts', {
        job_id: jobId,
        error: deleteError.message,
      })
      return
    }

    cleanupLogger.info('Cleaned up duplicate failed drafts', {
      job_id: jobId,
      removed_count: idsToDelete.length,
    }, '🧹')
  } catch (error) {
    cleanupLogger.warn('Unexpected error during cleanup', {
      job_id: jobId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

const processJob = async (
  originalJob: AsyncJobRecord,
  normalized: NormalizedMealPlanRequest,
  accessToken: string,
) => {
  let job = originalJob
  normalized.job_id = job.id

  job = await markJobProcessing(serviceClient, job)
  logger.info('Job moved to processing state', { job_id: job.id }, '🚀')

  job = await updateJobProgress(serviceClient, job, 15)
  const errorCounts = new Map<string, number>()

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptEmoji = attempt === 1 ? '🔄' : '🔁'
    logger.info(`Calling generate-meal-plan-draft (attempt ${attempt}/${MAX_ATTEMPTS})`, {
      job_id: job.id,
    }, attemptEmoji)

    job = await appendJobMeta(serviceClient, job, {
      retry_count: attempt - 1,
      last_attempt_at: new Date().toISOString(),
    })

    try {
      job = await updateJobProgress(serviceClient, job, 30 + attempt * 10)

      const draft = await generateMealPlanDraft(normalized, {
        jobId: job.id,
        supabaseUrl,
        serviceRoleKey,
        accessToken,
        retryAttempt: attempt,
      })

      logger.info('Draft generation completed', { job_id: job.id, draft_id: draft.draft_id }, '?')

      logger.info('Starting recipe assignment process', { job_id: job.id, draft_id: draft.draft_id }, '??')
      job = await updateJobProgress(serviceClient, job, 80)

      const aggregatedAssignments: RecipeAssignmentResult[] = []
      let latestStats: RecipeAssignmentRunStats | null = null
      let hasMoreAssignments = true
      let assignerRuns = 0
      let stalledRuns = 0
      let previousTotalAssigned = -1

      try {
        while (hasMoreAssignments) {
          assignerRuns += 1

          logger.info('Invoking recipe assigner pass', {
            job_id: job.id,
            draft_id: draft.draft_id,
            pass: assignerRuns,
          }, '??')

          const assignerResponse = await callRecipeAssigner(draft.draft_id, normalized, serviceRoleKey)
          const stats = assignerResponse.stats
          aggregatedAssignments.push(...assignerResponse.assignments)
          latestStats = stats
          hasMoreAssignments = assignerResponse.hasMore

          const totalItems = Math.max(stats.totalItems, 1)
          const totalAssigned = Math.max(stats.totalAssigned, aggregatedAssignments.length)
          const pendingCount = Math.max(stats.pendingAssignments ?? 0, 0)
          const completionNumerator = Math.min(totalItems, totalAssigned + pendingCount)
          const assignmentProgress =
            80 + Math.min(18, Math.round((completionNumerator / totalItems) * 18))

          if (assignerRuns > MAX_ASSIGNER_RUNS && pendingCount === 0) {
            throw new Error(`Recipe assignment did not complete after ${MAX_ASSIGNER_RUNS} passes`)
          }

          job = await updateJobProgress(serviceClient, job, assignmentProgress)
          job = await appendJobMeta(serviceClient, job, {
            recipe_assignment: {
              runs: assignerRuns,
              last_run: {
                has_more: hasMoreAssignments,
                assignments_this_run: assignerResponse.assignments.length,
                total_assigned: stats.totalAssigned,
                pending_assignments: pendingCount,
                remaining: stats.remaining,
                elapsed_ms: stats.elapsedMs,
                resume_hint: assignerResponse.resumeHint,
              },
            },
          })

          if (!hasMoreAssignments) {
            break
          }

          const progressValue = stats.totalAssigned + pendingCount

          if (progressValue <= previousTotalAssigned) {
            if (pendingCount === 0) {
              stalledRuns += 1
            }
          } else {
            stalledRuns = 0
          }
          previousTotalAssigned = progressValue

          if (stalledRuns >= 2) {
            throw new Error('Recipe assignment stalled without making progress')
          }

          const waitMs = Math.min(5000, 1000 * assignerRuns)
          logger.info('Recipe assignment still in progress', {
            job_id: job.id,
            draft_id: draft.draft_id,
            pass: assignerRuns,
            wait_ms: waitMs,
            remaining: stats.remaining,
            pending_assignments: pendingCount,
            resume_hint: assignerResponse.resumeHint,
          }, '??')
          await delay(waitMs)
        }

        job = await markJobCompleted(serviceClient, job, {
          draft_id: draft.draft_id,
          status: draft.status,
          meal_plan_id: draft.meal_plan_id ?? null,
          attempt_count: attempt,
          recipe_assignments: aggregatedAssignments,
          assignment_summary: latestStats,
          assignment_passes: assignerRuns,
        })

        logger.info('Recipe assignment completed', {
          job_id: job.id,
          draft_id: draft.draft_id,
          matched_recipes: aggregatedAssignments.filter((a) => a.source === 'existing').length,
          generated_recipes: aggregatedAssignments.filter((a) => a.source === 'generated').length,
          total_assignments: aggregatedAssignments.length,
        }, '??')
        logger.info('Job completed successfully', { job_id: job.id }, '??')
        return
      } catch (assignerError) {
        const assignerMessage =
          assignerError instanceof Error ? assignerError.message : String(assignerError)
        logger.error('Recipe assignment failed', {
          job_id: job.id,
          draft_id: draft.draft_id,
          error: assignerMessage,
        }, '??')

        job = await markJobFailed(serviceClient, job, `Recipe assignment failed: ${assignerMessage}`, {
          draft_id: draft.draft_id,
          last_error: assignerMessage,
          retry_count: attempt,
          assignment_passes: assignerRuns,
          assignment_summary: latestStats,
        })
        return
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn('Draft generation attempt failed', {
        job_id: job.id,
        attempt,
        message,
      })

      const attemptsForError = (errorCounts.get(message) ?? 0) + 1
      errorCounts.set(message, attemptsForError)

      const isTransient = error instanceof TransientError

      job = await appendJobMeta(serviceClient, job, {
        last_error: message,
      })

      if (!isTransient || attempt === MAX_ATTEMPTS) {
        job = await markJobFailed(serviceClient, job, message, {
          last_error: message,
          retry_count: attempt,
        })
        logger.error('Job failed after retries', { job_id: job.id, message }, '💀')

        const shouldCleanup =
          attempt === MAX_ATTEMPTS &&
          errorCounts.size === 1 &&
          attemptsForError === MAX_ATTEMPTS

        if (shouldCleanup) {
          await cleanupFailedDrafts(job.id, message)
        }
        return
      }

      const delayMs = BACKOFF_DELAYS[attempt - 1] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1]
      logger.info('Retrying after backoff', { job_id: job.id, delay_ms: delayMs }, '⏳')
      await delay(delayMs)
    }
  }
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req)
  if (corsResponse) {
    return corsResponse
  }

  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405)
  }

  logger.info('Received plan creation request', {}, '🎯')

  try {
    const accessToken = extractAccessToken(req)

    const { data: sessionUser, error: authError } = await serviceClient.auth.getUser(accessToken)
    if (authError || !sessionUser?.user) {
      throw new AuthorizationError('Invalid or expired token', authError)
    }

    const userId = sessionUser.user.id
    
    // Log the user_id from JWT
    logger.info('Extracted user from JWT', {
      user_id: userId,
      user_email: sessionUser.user.email,
    }, '🔐')

    let rawPayload: unknown
    try {
      rawPayload = await req.json()
    } catch (error) {
      throw new ValidationError('Invalid JSON body', error)
    }

    logger.info('Request details', {
      user_id: userId,
      body_preview: JSON.stringify(rawPayload)?.slice(0, 200),
    }, '📋')

    const payloadRecord =
      rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {}

    const providedHouseholdId =
      typeof payloadRecord.household_id === 'string'
        ? payloadRecord.household_id
        : typeof payloadRecord.householdId === 'string'
        ? payloadRecord.householdId
        : undefined

    let fallbackHouseholdId: string | undefined

    if (!providedHouseholdId) {
      const { data, error } = await serviceClient
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(2)

      if (error) {
        throw new OrchestratorError('Unable to resolve household membership', 500, error)
      }

      if (!data || data.length === 0) {
        throw new ValidationError('household_id is required')
      }

      if (data.length > 1) {
        throw new ValidationError(
          'Multiple active households found. Pass household_id explicitly to generate a plan.',
        )
      }

      fallbackHouseholdId = data[0].household_id as string
      logger.info('Resolved household_id from membership', { household_id: fallbackHouseholdId }, '🧭')
    }

    const { normalized, canonicalPayload, payloadSignature } =
      await validateAndNormalizePayload(rawPayload, {
        userIdFromToken: userId,
        fallbackHouseholdId,
      })

    logger.info('Validation passed', {
      user_id: normalized.user_id,
      household_id: normalized.household_id,
      start_date: normalized.start_date,
      end_date: normalized.end_date,
      meals_per_day: normalized.meals_per_day,
    }, '✅')

    await ensureHouseholdAccess(serviceClient, normalized.user_id, normalized.household_id)

    const existingJob = await findActiveJobBySignature(
      serviceClient,
      normalized.user_id,
      payloadSignature,
    )

    if (existingJob) {
      logger.info('Found active job for payload signature', {
        job_id: existingJob.id,
      }, '♻️')
      return jsonResponse(200, {
        success: true,
        job_id: existingJob.id,
        status: existingJob.status,
        progress: existingJob.progress,
        message: 'Meal plan generation already in progress',
      })
    }

    const job = await createJob(serviceClient, {
      userId: normalized.user_id,
      jobType: 'meal_plan_generation',
      payload: canonicalPayload,
      meta: {
        retry_count: 0,
        payload_signature: payloadSignature,
      },
    })

    logger.info('Created async job', { job_id: job.id }, '📝')

    processJob(job, normalized, accessToken).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Unhandled error in background processing', { job_id: job.id, message })
    })

    return jsonResponse(202, {
      success: true,
      job_id: job.id,
      status: job.status,
      progress: job.progress,
      message: 'Meal plan generation started',
    })
  } catch (error) {
    if (error instanceof OrchestratorError) {
      logger.error(error.message, { details: error.details }, '❌')
      return createErrorResponse(error.message, error.status)
    }

    const message = error instanceof Error ? error.message : 'Unexpected error'
    logger.error('Unexpected orchestrator failure', { message, error })
    return createErrorResponse(message, 500)
  }
})





