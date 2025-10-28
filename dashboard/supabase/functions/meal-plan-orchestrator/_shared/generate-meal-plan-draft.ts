import {
  DraftGenerationResult,
  NormalizedMealPlanRequest,
  PermanentError,
  TransientError,
} from '../../_shared/types.ts'

interface GenerateDraftOptions {
  jobId: string
  supabaseUrl: string
  serviceRoleKey: string
  accessToken?: string
  retryAttempt?: number
}

const FUNCTION_ENDPOINT = '/functions/v1/generate-meal-plan-draft'

const isTransientStatus = (status: number) => status >= 500 || status === 408

export const generateMealPlanDraft = async (
  payload: NormalizedMealPlanRequest,
  options: GenerateDraftOptions,
): Promise<DraftGenerationResult> => {
  const { jobId, supabaseUrl, serviceRoleKey, accessToken } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'X-Job-Id': jobId,
    'X-User-Id': payload.user_id,
  }

  if (accessToken) {
    headers['X-User-Access-Token'] = accessToken
  }

  const requestBody = {
    ...payload,
    job_id: jobId,
  }

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}${FUNCTION_ENDPOINT}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })
  } catch (error) {
    throw new TransientError('generate-meal-plan-draft invocation failed', {
      cause: error instanceof Error ? error.message : error,
    })
  }

  const responseText = await response.text()
  let parsedBody: Record<string, unknown> = {}
  try {
    parsedBody = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {}
  } catch {
    // ignore parse errors; handled below
  }

  if (!response.ok) {
    const message =
      typeof parsedBody.error === 'string'
        ? parsedBody.error
        : typeof parsedBody.message === 'string'
        ? parsedBody.message
        : `generate-meal-plan-draft responded with status ${response.status}`

    if (isTransientStatus(response.status)) {
      throw new TransientError(message, { status: response.status, body: parsedBody })
    }

    throw new PermanentError(message, response.status, parsedBody)
  }

  const draftId = parsedBody.draft_id ?? parsedBody.draftId
  const status = parsedBody.status ?? parsedBody.draft_status ?? 'generating'

  if (typeof draftId !== 'string' || !draftId) {
    throw new PermanentError('generate-meal-plan-draft response missing draft_id', 500, parsedBody)
  }

  return {
    draft_id: draftId,
    status: status as DraftGenerationResult['status'],
    meal_plan_id:
      typeof parsedBody.meal_plan_id === 'string'
        ? (parsedBody.meal_plan_id as string)
        : typeof parsedBody.mealPlanId === 'string'
        ? (parsedBody.mealPlanId as string)
        : null,
    meta: typeof parsedBody.meta === 'object' ? (parsedBody.meta as Record<string, unknown>) : {},
  }
}
