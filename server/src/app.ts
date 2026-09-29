import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import healthRouter from './routes/health.js'
import { createChatRouter, type ChatService } from './routes/chat.js'
import { createLiveRouter, type LiveTokenService } from './routes/live.js'
import { createOrdersRouter } from './routes/orders.js'
import { createCatalogRouter } from './routes/catalog.js'

export function createApp(chatService?: ChatService, liveTokenService?: LiveTokenService): Express {
  const app = express()
  app.use(express.json({ limit: '16kb' }))
  app.use('/api/health', healthRouter)
  app.use('/api/chat', createChatRouter(chatService))
  app.use('/api/live', createLiveRouter(liveTokenService))
  app.use('/api/orders', createOrdersRouter())
  app.use('/api/catalog', createCatalogRouter())
  app.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const status = typeof _error === 'object' && _error !== null && 'status' in _error && _error.status === 413 ? 413 : 400
    response.status(status).json({ error: status === 413 ? 'Request body is too large.' : 'Request body could not be processed.' })
  })
  return app
}
