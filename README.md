# Aura Skincare Voice Agent

Browser-based customer support demo for the DataStraw assessment. Customers can speak naturally with Aria or send a typed message. Responses use approved Aura Skincare policies and the three seeded test orders; this is not connected to a live commerce system.

## Stack and architecture

- `client/` is the React, TypeScript, and Vite browser application.
- `server/` is the Express and TypeScript API. The Gemini API key stays in the server environment.
- Voice calls use the Gemini Live API (`gemini-3.8-live`) for bidirectional audio, speech transcription, and audio responses. The server creates a one-use, short-lived Gemini ephemeral token with the session model, Aria instructions, response modality, and function declaration constrained. The browser receives only the model name and that short-lived token; the permanent API key and server instructions stay on the backend.
- The browser handles microphone capture and speaker playback. It sends 16 kHz PCM microphone audio to Gemini Live and plays the returned 24 kHz PCM audio.
- When Gemini calls `get_order_details`, the browser sends the requested order ID to the server’s `/api/orders/lookup` route. That route invokes the existing `server/src/tools/getOrderDetails.ts` function and returns only a seeded result or a safe lookup error.
- Typed `/api/chat` requests remain available and use Gemini text generation with the same Aura instructions, policies, and server-owned lookup tool.
- Gemini Live interim speech hypotheses update in place in the chronological transcript; finalized customer/Aria text replaces the matching partial line. The transcript and structured call outcome are kept in browser memory and shown after the call ends.

The Live API uses a realtime audio-to-audio session instead of a separate speech recognition, text generation, and speech synthesis request for each spoken turn. This reduces the number of network hops and keeps interruption and speech timing inside one session. The main implementation challenge is translating browser microphone audio into the PCM format Gemini Live accepts, scheduling its streamed audio for playback, and preserving reliable transcript and tool-call records around asynchronous Live messages.

See [APPROACH.md](./APPROACH.md) for the concise assessment approach note.

## Run locally

Use Node.js 20 or later. Install dependencies from the project root:

```bash
npm install
```

Copy `.env.example` to `.env` and set the Gemini API key on the server:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
```

Then run both workspaces:

```bash
npm run dev
```

Open the Vite URL printed by the client (normally `http://localhost:5173`). The Vite development server proxies `/api` requests to the Express server.

For production builds and checks:

```bash
npm run typecheck
npm test
npm run build
npm start
```

The client build is emitted to `client/dist`; the server build is emitted to `server/dist`. Serve the client build through a static host or reverse proxy that forwards `/api` to the Express server. Browser microphone access requires HTTPS on deployed sites; localhost is treated as a secure context by browsers.

## API endpoints

- `GET /api/health` reports server health.
- `POST /api/live/token` creates a constrained, short-lived Gemini Live token. It does not return the server API key.
- `POST /api/orders/lookup` accepts `{ "order_id": "ORD-101" }` and calls `get_order_details`.
- `POST /api/chat` accepts `{ "message": "...", "history": [] }` for a text-only Gemini turn.

## Known limitations

The three sample orders are fixed in memory; there is no live commerce, delivery, cancellation, refund, or replacement integration. The demo has no customer authentication, persistent call storage, or per-user rate limiting. Public use should add authenticated short-lived session issuance, abuse controls, and a retention policy before handling real customer data. Browser microphone access requires a supported browser and HTTPS outside localhost.

## Safety and scope

`server/src/data/brandPolicies.ts` contains the approved brand and policy information. `server/src/data/orders.ts` contains ORD-101, ORD-102, and ORD-103. The model is instructed not to invent policy or order details. Every order lookup is executed by the server; unknown and missing IDs return structured errors, and the model receives that result before responding. The only supported action is order lookup; Aria cannot process cancellations, refunds, or replacements in this demo.

The one-use Live token expires quickly. The agent can only read the seeded order records and cannot change an order or perform a transaction.

## Difficult parts and next improvements

The difficult part is managing audio capture/playback and transcript sequencing while the Live API streams transcription, generated audio, interruptions, and function calls independently. The API contract separates the permanent key from the browser by using constrained ephemeral tokens; its model and tool configuration are locked on the server.

With one week, I would add browser/device compatibility checks, a manual playback transcript audit, call cancellation and reconnect handling, and a small evaluation set covering each policy, order, missing/unknown IDs, and out-of-scope requests. I would also verify that every user-visible outcome is grounded in the exact tool response.

For roughly 1,000 conversations/day, I would keep the Express API stateless behind a load balancer, add authenticated short-lived session issuance, server-side rate limits, request IDs and privacy-conscious metrics, and durable storage for outcomes only where retention is required. I would measure Live session duration, token and model cost, error rates, and tool-call correctness before scaling capacity. A queue is not needed for the synchronous voice path; it would only be added for independent post-call work such as analytics exports.
