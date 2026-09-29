import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import healthRouter from './routes/health.js'
import { createChatRouter, type ChatService } from './routes/chat.js'
import { createLiveRouter, type LiveTokenService } from './routes/live.js'
import { createOrdersRouter } from './routes/orders.js'
import { createCatalogRouter } from './routes/catalog.js'

const clientDistPath = fileURLToPath(new URL('../../client/dist', import.meta.url))
const clientIndexPath = fileURLToPath(new URL('../../client/dist/index.html', import.meta.url))

export function createApp(chatService?: ChatService, liveTokenService?: LiveTokenService): Express {
  const app = express()
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (request.method === 'OPTIONS') {
      response.sendStatus(204)
      return
    }
    next()
  })
  app.use(express.json({ limit: '16kb' }))
  app.use('/api/health', healthRouter)
  app.use('/api/chat', createChatRouter(chatService))
  app.use('/api/live', createLiveRouter(liveTokenService))
  app.use('/api/orders', createOrdersRouter())
  app.use('/api/catalog', createCatalogRouter())

  if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath))
    app.get('*', (request: Request, response: Response, next: NextFunction) => {
      if (request.path.startsWith('/api/')) {
        next()
        return
      }
      if (existsSync(clientIndexPath)) {
        response.sendFile(clientIndexPath)
        return
      }
      next()
    })
  }

  app.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const status = typeof _error === 'object' && _error !== null && 'status' in _error && _error.status === 413 ? 413 : 400
    response.status(status).json({ error: status === 413 ? 'Request body is too large.' : 'Request body could not be processed.' })
  })
  return app
}

