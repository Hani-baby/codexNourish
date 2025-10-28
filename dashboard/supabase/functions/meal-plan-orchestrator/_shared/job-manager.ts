import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'

import { AsyncJobRecord, JobStatus, OrchestratorError } from '../../_shared/types.ts'

interface CreateJobParams {
  userId: string
  jobType: string
  payload: Record<string, unknown>
  meta?: Record<string, unknown>
}

interface UpdateJobParams {
  status?: JobStatus
  progress?: number
  result?: Record<string, unknown> | null
  error?: string | null
  meta?: Record<string, unknown>
}

const ensureNoError = <T>(error: Error | null, message: string): asserts error is null => {
  if (error) {
    throw new OrchestratorError(`${message}: ${error.message}`, 500, error)
  }
}

export const createJob = async (
  client: SupabaseClient,
  params: CreateJobParams,
): Promise<AsyncJobRecord> => {
  const { userId, jobType, payload, meta = {} } = params
  const { data, error } = await client
    .from('async_jobs')
    .insert({
      user_id: userId,
      job_type: jobType,
      status: 'pending',
      progress: 0,
      payload,
      meta,
    })
    .select('*')
    .single()

  ensureNoError(error, 'Failed to create async job')

  if (!data) {
    throw new OrchestratorError('Failed to create async job: no data returned')
  }

  return data as AsyncJobRecord
}

export const updateJob = async (
  client: SupabaseClient,
  jobId: string,
  params: UpdateJobParams,
): Promise<AsyncJobRecord> => {
  const { data, error } = await client
    .from('async_jobs')
    .update({
      ...('status' in params ? { status: params.status } : {}),
      ...('progress' in params ? { progress: params.progress } : {}),
      ...('result' in params ? { result: params.result } : {}),
      ...('error' in params ? { error: params.error } : {}),
      ...('meta' in params ? { meta: params.meta } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select('*')
    .single()

  ensureNoError(error, `Failed to update async job ${jobId}`)

  if (!data) {
    throw new OrchestratorError(`Failed to update async job ${jobId}: no data returned`)
  }

  return data as AsyncJobRecord
}

export const appendJobMeta = async (
  client: SupabaseClient,
  job: AsyncJobRecord,
  patch: Record<string, unknown>,
): Promise<AsyncJobRecord> => {
  const updatedMeta = {
    ...(job.meta ?? {}),
    ...patch,
  }
  return updateJob(client, job.id, { meta: updatedMeta })
}

export const updateJobProgress = async (
  client: SupabaseClient,
  job: AsyncJobRecord,
  progress: number,
  patch: Partial<UpdateJobParams> = {},
): Promise<AsyncJobRecord> => {
  return updateJob(client, job.id, {
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    ...patch,
  })
}

export const markJobProcessing = async (
  client: SupabaseClient,
  job: AsyncJobRecord,
): Promise<AsyncJobRecord> => {
  return updateJob(client, job.id, { status: 'processing', progress: Math.max(job.progress, 10) })
}

export const markJobCompleted = async (
  client: SupabaseClient,
  job: AsyncJobRecord,
  result: Record<string, unknown>,
): Promise<AsyncJobRecord> => {
  return updateJob(client, job.id, {
    status: 'completed',
    progress: 100,
    result,
    error: null,
  })
}

export const markJobFailed = async (
  client: SupabaseClient,
  job: AsyncJobRecord,
  message: string,
  metaPatch: Record<string, unknown> = {},
): Promise<AsyncJobRecord> => {
  return updateJob(client, job.id, {
    status: 'failed',
    progress: 100,
    error: message,
    meta: {
      ...(job.meta ?? {}),
      ...metaPatch,
    },
  })
}

export const findActiveJobBySignature = async (
  client: SupabaseClient,
  userId: string,
  signature: string,
): Promise<AsyncJobRecord | null> => {
  const { data, error } = await client
    .from('async_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('job_type', 'meal_plan_generation')
    .in('status', ['pending', 'processing'])
    .contains('meta', { payload_signature: signature })
    .order('queued_at', { ascending: false })
    .limit(1)

  ensureNoError(error, 'Failed to lookup existing async job')

  return data && data.length > 0 ? (data[0] as AsyncJobRecord) : null
}
