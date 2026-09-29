import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'

// The server runs from its workspace directory during development. Resolve the
// shared project .env relative to this file so startup works from any cwd.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })

const app = createApp()
const port = Number(process.env.PORT) || 3001

app.listen(port, () => console.log(`Aura voice agent backend listening on port ${port}`))
