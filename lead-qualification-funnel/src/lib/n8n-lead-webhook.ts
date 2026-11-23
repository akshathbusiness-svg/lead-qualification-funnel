export type N8nLeadPayload = {
  submission_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  state: string
  qualification_status: string
  campaign: string | null
  utm_parameters: Record<string, string>
  answers: {
    age: string | null
    employment: string | null
    condition: string | null
    workImpact: string | null
    benefits: string | null
  }
  utm_data: Record<string, string>
  fbclid: string | null
  landing_page: string
  submitted_at: string
}

const N8N_LEAD_WEBHOOK_URL = import.meta.env.VITE_N8N_LEAD_WEBHOOK_URL
  || 'https://akshath06.app.n8n.cloud/webhook/lexhive-lead'
const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 8_000

const wait = (delayMs: number) => new Promise((resolve) => window.setTimeout(resolve, delayMs))

export async function sendLeadToN8n(payload: N8nLeadPayload): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(N8N_LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (response.ok) return true

      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500
      if (!retryable || attempt === MAX_ATTEMPTS) {
        console.error('[v0] n8n lead webhook failed', {
          submissionId: payload.submission_id,
          status: response.status,
          attempts: attempt,
        })
        return false
      }
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        console.error('[v0] n8n lead webhook failed', {
          submissionId: payload.submission_id,
          message: error instanceof Error ? error.message : 'Unknown webhook error',
          attempts: attempt,
        })
        return false
      }
    }

    await wait(500 * 2 ** (attempt - 1))
  }

  return false
}
