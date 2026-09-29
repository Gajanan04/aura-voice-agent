import { GoogleGenAI } from '@google/genai'
import { GEMINI_LIVE_MODEL, geminiLiveConfig } from './liveConfig.js'

export interface LiveTokenResult {
  readonly token: string
  readonly model: string
}

export class GeminiConfigurationError extends Error {
  constructor() {
    super('The Gemini voice service is not configured.')
    this.name = 'GeminiConfigurationError'
  }
}

export async function createLiveToken(): Promise<LiveTokenResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new GeminiConfigurationError()

  const client = new GoogleGenAI({ apiKey })
  const now = Date.now()
  const token = await client.authTokens.create({
    config: {
      uses: 1,
      newSessionExpireTime: new Date(now + 60_000).toISOString(),
      expireTime: new Date(now + 30 * 60_000).toISOString(),
      liveConnectConstraints: { model: GEMINI_LIVE_MODEL, config: geminiLiveConfig },
    },
  })

  if (!token.name) throw new Error('Gemini did not return a Live API token.')
  return { token: token.name, model: GEMINI_LIVE_MODEL }
}
