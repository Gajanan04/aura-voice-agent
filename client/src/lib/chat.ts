export interface ChatHistoryMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface ChatToolCall {
  readonly name: string
  readonly arguments: Readonly<Record<string, unknown>>
  readonly result: {
    readonly ok: boolean
    readonly order?: Readonly<Record<string, unknown>>
    readonly categories?: readonly { readonly category: string; readonly price_range: string }[]
    readonly error?: { readonly code: string; readonly message: string }
  }
}

export interface ChatResponse {
  readonly message: string
  readonly toolCalls: readonly ChatToolCall[]
  readonly history: readonly ChatHistoryMessage[]
}

function isChatResponse(value: unknown): value is ChatResponse {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ChatResponse>
  return typeof candidate.message === 'string'
    && Array.isArray(candidate.toolCalls)
    && Array.isArray(candidate.history)
}

export async function sendChatMessage(message: string, history: readonly ChatHistoryMessage[]): Promise<ChatResponse> {
  let response: Response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, history }),
    })
  } catch {
    throw new Error('Can’t reach Aura support right now. Check that the backend is running and try again.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Aura support returned an unreadable response. Please try again.')
  }

  if (!response.ok) {
    const apiError = typeof payload === 'object' && payload !== null && 'error' in payload
      && typeof payload.error === 'string' ? payload.error : ''
    if (response.status === 503) {
      throw new Error('Aria is not configured yet. Set GEMINI_API_KEY on the server, then restart it.')
    }
    if (response.status === 502) throw new Error('Aria is temporarily unavailable. Please try again in a moment.')
    throw new Error(apiError || 'Your message could not be sent. Please try again.')
  }

  if (!isChatResponse(payload)) throw new Error('Aura support returned an unexpected response. Please try again.')
  return payload
}
