import { Router } from 'express'
import {
  AgentConfigurationError,
  agentService,
} from '../agent/agentService.js'
import type {
  AgentServiceInput,
  AgentServiceResult,
  ConversationMessage,
} from '../agent/agentService.js'

export type ChatService = (input: AgentServiceInput) => Promise<AgentServiceResult>

export function createChatRouter(service: ChatService = agentService): Router {
  const router = Router()

  router.post('/', async (request, response) => {
    const body: unknown = request.body
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      response.status(400).json({ error: 'Request body must be a JSON object.' })
      return
    }

    const { message, history } = body as { message?: unknown; history?: unknown }
    if (typeof message !== 'string' || message.trim().length === 0) {
      response.status(400).json({ error: 'A non-empty message is required.' })
      return
    }
    if (message.length > 2000) {
      response.status(400).json({ error: 'Message must be 2,000 characters or fewer.' })
      return
    }

    let safeHistory: ConversationMessage[] = []
    if (history !== undefined) {
      if (!Array.isArray(history) || history.length > 50 || history.some((item) =>
        typeof item !== 'object' || item === null || Array.isArray(item) ||
        !('role' in item) || !('content' in item) ||
        !['user', 'assistant'].includes(String(item.role)) ||
        typeof item.content !== 'string' || item.content.length > 2000
      )) {
        response.status(400).json({ error: 'History must contain user or assistant messages.' })
        return
      }
      safeHistory = history as ConversationMessage[]
    }

    try {
      const result = await service({ message: message.trim(), history: safeHistory })
      response.json(result)
    } catch (error) {
      if (error instanceof AgentConfigurationError) {
        response.status(503).json({ error: 'Set GEMINI_API_KEY on the server to enable Aura support.' })
        return
      }
      response.status(502).json({ error: 'Aura support is temporarily unavailable. Please try again.' })
    }
  })

  return router
}
