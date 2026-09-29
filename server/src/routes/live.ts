import { Router } from 'express'
import { GeminiConfigurationError, createLiveToken } from '../live/tokenService.js'

export type LiveTokenService = typeof createLiveToken

export function createLiveRouter(service: LiveTokenService = createLiveToken): Router {
  const router = Router()

  router.post('/token', async (_request, response) => {
    try {
      response.json(await service())
    } catch (error) {
      if (error instanceof GeminiConfigurationError) {
        response.status(503).json({ error: 'Aria is not configured yet. Set GEMINI_API_KEY on the server, then restart it.' })
        return
      }
      response.status(502).json({ error: 'Gemini Live could not be started. Please try again.' })
    }
  })

  return router
}
