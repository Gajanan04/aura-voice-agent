# Aura Skincare Voice Agent

A browser-based AI voice customer support agent built for the **DataStraw AI Voice Agent Assessment**.

Customers can speak naturally with **Aria**, Aura Skincare's AI customer support specialist, or send a typed message. The agent is grounded in Aura Skincare's approved policies and seeded demo data. It is not connected to a live commerce or delivery system.

---

## 🔗 Links

| Resource | Link |
|---|---|
| 🌐 Live Application | https://aura-voice-agent-yftx.onrender.com |
| 💻 GitHub Repository | https://github.com/Gajanan04/aura-voice-agent |
| 🎥 Demo Video | https://drive.google.com/drive/folders/1HX9vIzodJbn0w1-NZYBmIdUn3-SN1Yei |

---

## ✨ Features

- 🎙️ Real-time browser voice conversation with Aria
- 🔊 Gemini Live bidirectional audio streaming
- 📝 Live customer and agent speech transcription
- 🛡️ Aura Skincare policy grounding and guardrails
- 📦 Real-time seeded order lookup
- 🧴 Product catalog lookup
- ❌ Invalid and missing order handling
- 💬 Conversation context
- 🗣️ Barge-in / interruption handling
- 🔄 Listening, Thinking, and Speaking states
- 📋 Chronological call transcript
- 📊 Structured post-call summary
- 🧠 Long-session context compression
- ⌨️ Typed text fallback
- 📱 Responsive browser interface

---

# 🏗️ Architecture

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Web Audio API

### Backend

- Node.js
- Express
- TypeScript
- `@google/genai`

### AI

- Gemini Live API
- `gemini-3.8-live` — realtime voice
- `gemini-3.8-flash` — typed text fallback

---

## Project Structure

```text
aura-voice-agent/
│
├── client/                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   └── tests/
│
├── server/                  # Express + TypeScript
│   └── src/
│       ├── agent/
│       ├── data/
│       ├── live/
│       ├── routes/
│       └── tools/
│
├── APPROACH.md
├── README.md
├── .env.example
└── package.json
````

---

## Voice Architecture

The application uses a realtime audio-to-audio Gemini Live session instead of making separate speech-to-text, LLM, and text-to-speech requests for every spoken turn.

```text
                ┌─────────────────────┐
                │   Browser / React   │
                │                     │
                │  Microphone + UI    │
                └──────────┬──────────┘
                           │
                    16 kHz PCM Audio
                           │
                           ▼
                ┌─────────────────────┐
                │    Gemini Live      │
                │ gemini-3.8-live     │
                └──────────┬──────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         Voice Response             Tool Call
              │                         │
              ▼                         ▼
       Browser Playback          Browser Tool Handler
                                        │
                                        ▼
                                Express API Server
                                        │
                                        ▼
                              Server-side Tool/Data
```

This approach reduces the number of network hops for spoken interactions and keeps realtime audio, interruptions, transcription, and model responses inside one Live session.

---

# 🔐 Security & Token Handling

The permanent `GEMINI_API_KEY` is stored only on the server.

It is **never exposed to the browser**.

The browser requests a constrained, short-lived Gemini Live token:

```text
Browser
   │
   │ POST /api/live/token
   ▼
Express Server
   │
   │ Creates constrained short-lived token
   ▼
Browser
   │
   │ Uses temporary token
   ▼
Gemini Live
```

The server controls:

* Gemini model
* System instructions
* Available tools
* Session configuration

The browser receives only the temporary credentials required for the Live session.

---

# 🎙️ Gemini Live Configuration

The final Live session uses:

* **Model:** `gemini-3.8-live`
* Automatic voice activity detection
* `silenceDurationMs: 500`
* `contextWindowCompression.slidingWindow`
* Audio response modality
* Speech transcription
* Server-defined system instructions
* Server-defined function declarations

### Voice Activity Detection

A 500ms silence duration is used to reduce unnecessary waiting after the customer finishes speaking while keeping automatic activity detection enabled.

### Long-Session Context

Sliding-window context compression is enabled to make long-running Gemini Live sessions more robust.

This avoids manually resetting the conversation after a fixed number of turns and helps preserve the system instructions and relevant context during extended sessions.

---

# 🛠️ Tools

The agent currently uses two tools.

## `get_order_details(order_id)`

Retrieves information from the seeded Aura Skincare order database.

Available demo orders:

```text
ORD-101
ORD-102
ORD-103
```

The server performs the actual lookup.

Unknown and missing order IDs return structured errors rather than fabricated information.

---

## `get_product_catalog()`

Provides the demo product catalog at category level, including available skincare categories and price ranges.

This is demo catalog information only.

It is **not connected to live inventory or a commerce platform**.

---

# 📦 Order Lookup Flow

When a customer asks about an order, Gemini determines that order information is required and requests the `get_order_details` tool.

The browser forwards the requested order ID to:

```text
POST /api/orders/lookup
```

The Express server executes the server-side tool and returns the result.

```text
Customer
   │
   ▼
Gemini Live
   │
   │ get_order_details(order_id)
   ▼
Browser Tool Handler
   │
   ▼
POST /api/orders/lookup
   │
   ▼
Server Tool
   │
   ▼
Seeded Order Data
   │
   ▼
Tool Result → Gemini Live → Aria
```

This keeps order data access controlled by the server.

---

# 🧴 Aura Skincare Policies

Approved brand information is stored in:

```text
server/src/data/brandPolicies.ts
```

Seeded orders are stored in:

```text
server/src/data/orders.ts
```

The agent is instructed to use only approved information and avoid unsupported promises.

## Shipping

* Free delivery on orders above ₹499
* ₹50 shipping fee for orders below ₹499
* Standard delivery takes 3–5 business days

## Returns

* Returns accepted within 7 days of delivery
* Product must be unopened and unused
* Original packaging is required

## Damaged / Defective Products

* Must be reported within 48 hours of delivery
* Photos are required for replacement

## Cancellation

* Orders can only be cancelled while their status is `Processing`
* Shipped or Out for Delivery orders cannot be cancelled
* Customers may refuse delivery at the doorstep

## Cash on Delivery

* COD available for orders up to ₹2,500
* Payment can be made by cash or UPI at the doorstep

---

# 🛡️ Guardrails & Scope

Aria is designed to remain within Aura Skincare customer-support scope.

### Supported

* Order tracking
* Cancellation eligibility
* Shipping questions
* Return/refund policy questions
* COD information
* Product/category information

### Out of Scope

* Programming help
* Flight booking
* General unrelated questions
* Actions outside the available tools

For unsupported requests, Aria politely redirects the customer back to Aura Skincare support.

The demo does **not** directly execute:

* Cancellations
* Refunds
* Replacements
* Payments
* Order modifications

It only provides information based on approved policies and seeded data.

---

# 📋 Post-Call Transcript & Summary

When the call ends, the application displays a chronological transcript containing:

* Customer messages
* Aria messages

The application also generates a structured call outcome.

Example:

```json
{
  "customer_intent": "ORDER_TRACKING",
  "order_id": "ORD-101",
  "resolution_status": "RESOLVED",
  "call_summary": "Customer asked about the delivery status of ORD-101."
}
```

The transcript handles interim speech hypotheses and finalized speech so that temporary transcription does not create unnecessary duplicate turns.

The call outcome is maintained in browser memory for the current session.

---

# 🎧 Audio Pipeline

The browser microphone pipeline is:

```text
Microphone
    │
    ▼
16 kHz PCM
    │
    ▼
Gemini Live
    │
    ▼
24 kHz PCM Response
    │
    ▼
Web Audio Playback
```

The application also handles Gemini Live interruption events so active generated audio can be stopped when the customer interrupts Aria.

---

# 🌐 API Endpoints

## Health

```http
GET /api/health
```

Returns server health information.

## Live Token

```http
POST /api/live/token
```

Creates a constrained, short-lived Gemini Live token.

The permanent Gemini API key is never returned.

## Order Lookup

```http
POST /api/orders/lookup
```

Example:

```json
{
  "order_id": "ORD-101"
}
```

## Typed Chat

```http
POST /api/chat
```

Example:

```json
{
  "message": "What is the return policy?",
  "history": []
}
```

The typed chat path uses Gemini text generation with the same Aura instructions and server-owned tools.

---

# 🚀 Run Locally

Use **Node.js 20 or later**.

## 1. Install Dependencies

From the project root:

```bash
npm install
```

## 2. Configure Environment

Copy `.env.example` to `.env` and configure the Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
```

Never commit the real `.env` file.

## 3. Start Development

```bash
npm run dev
```

The client normally runs at:

```text
http://localhost:5173
```

The Express server runs on:

```text
http://localhost:3001
```

The Vite development server proxies `/api` requests to Express.

---

# 🏭 Production Build

Run:

```bash
npm run typecheck
npm test
npm run build
```

The production build generates:

```text
client/dist
server/dist
```

Start the production server with:

```bash
npm start
```

In production, Express serves the built React application and handles the `/api` routes from the same service.

Production microphone access requires HTTPS.

---

# ☁️ Deployment

The application is deployed as a **Render Web Service**.

The production service provides:

```text
Render
  │
  ▼
Express Server
  ├── React Production Build
  └── /api/*
```

### Production URL

[https://aura-voice-agent-yftx.onrender.com](https://aura-voice-agent-yftx.onrender.com)

### GitHub Repository

[https://github.com/Gajanan04/aura-voice-agent](https://github.com/Gajanan04/aura-voice-agent)

---

# 🧪 Testing

The project includes client and server tests covering:

* Order lookup
* Product catalog
* Agent behavior
* API routes
* Transcript ordering
* Call outcome generation
* Gemini Live configuration

Run the test suite:

```bash
npm test
```

Run the production build:

```bash
npm run build
```

---

# 🧠 Why This Architecture and Stack?

The architecture was chosen around the main requirement of the assignment: a natural browser-based realtime voice support experience.

**React + TypeScript + Vite** provide a lightweight and maintainable browser interface for the voice agent, transcript and call states.

**Express + TypeScript** provide a clear server boundary for secrets, policy data, order data and tool execution.

**Gemini Live** was selected because it supports realtime bidirectional audio, allowing the application to handle voice interaction without building a separate STT → LLM → TTS request chain for every spoken turn.

**Server-side tools** ensure that order and catalog information comes from controlled application data rather than being invented by the model.

---

# 🔧 Most Difficult Part

The most difficult part was coordinating realtime audio, transcription, interruptions, tool calls and transcript ordering inside a single Gemini Live session.

Live messages can arrive asynchronously, so the application needed to distinguish interim and finalized speech while maintaining a reliable chronological Customer → Aria transcript.

The solution was to use dedicated client-side transcript ordering/state logic while keeping tool execution server-controlled.

Another important challenge was preventing the model from inventing order or policy information. This was handled using explicit Aura instructions, centralized policy data, seeded order data and server-side tools.

---

# 📅 If I Had One More Week

With one additional week, I would prioritize reliability and evaluation rather than adding more features.

I would improve:

* Browser and device compatibility checks
* Reconnect and call-cancellation handling
* Automated evaluation coverage
* Tests for every policy and order scenario
* Missing and unknown order handling
* Additional out-of-scope scenarios
* Manual transcript/playback auditing
* More systematic latency measurements
* Tool-call correctness monitoring

The main goal would be to verify that every user-visible outcome remains grounded in the approved Aura information and actual tool responses.

---

# 📈 Scaling to Approximately 1,000 Conversations/Day

At approximately 1,000 conversations per day, I would keep the API layer stateless and run multiple server instances behind a load balancer.

I would add:

* Authenticated short-lived session issuance
* Server-side rate limiting
* Request IDs for tracing
* Privacy-conscious operational metrics
* Durable storage where required
* Live session duration monitoring
* Gemini token/model cost monitoring
* Voice/session error monitoring
* Tool-call success and correctness metrics
* Operational alerts

The synchronous voice path should remain lightweight.

A queue would not be necessary for the core voice interaction, but it could be introduced for independent post-call work such as analytics processing or exports.

Before scaling further, I would measure actual session duration, model usage, tool-call frequency, concurrency and error rates to identify the real bottlenecks.

---

# ⚠️ Known Limitations

This is an assessment demo rather than a production commerce platform.

Current limitations:

* Orders are fixed seeded records stored in memory.
* There is no live commerce integration.
* There is no live delivery-provider integration.
* There is no customer authentication.
* Call data is not persisted to a production database.
* There is no per-user rate limiting.
* Cancellations, refunds and replacements are not actually executed.
* Product catalog information is demo data rather than live inventory.

Before handling real customer data, the system would require stronger authentication, abuse controls, persistent storage where appropriate, monitoring and a defined data-retention policy.

---

# 🔒 Safety & Data Scope

The permanent Gemini API key remains server-side.

The agent can only access the seeded Aura order and catalog information through the available tools.

Unknown order IDs return structured errors.

The agent cannot modify orders or perform transactions.

No real customer or payment data is used by the demo.

---

# 📹 Demo Video

The demo video demonstrates:

* Voice interaction with Aria
* Order lookup
* Policy-related conversation
* Product catalog lookup
* Out-of-scope handling
* Post-call transcript
* Structured call summary
* Architecture walkthrough

### Demo Video

[https://drive.google.com/drive/folders/1HX9vIzodJbn0w1-NZYBmIdUn3-SN1Yei](https://drive.google.com/drive/folders/1HX9vIzodJbn0w1-NZYBmIdUn3-SN1Yei)

---

# 📝 Assessment Approach

The implementation uses a browser-based Gemini Live session for realtime voice interaction, with Express providing server-controlled authentication, policy information and tool execution.

The agent is grounded in Aura Skincare's approved policies and seeded order data, while structured transcript and call-outcome handling provide the required post-call customer-support experience.

See [`APPROACH.md`](./APPROACH.md) for the concise technical approach.

---

## 👤 Author

**Gajanan Girish Ghirnikar**

Built for the **DataStraw AI Voice Agent Assessment**.

````
