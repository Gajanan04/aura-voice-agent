# Aura Skincare Agent — Approach Note

## Scope

Aria is a browser-based support agent for the supplied Aura Skincare policies and three assessment orders. Order records are fixed mock data. The demo can look up order information; it cannot mutate an order, issue a refund, or approve a replacement.

## Architecture

The React/TypeScript client captures microphone audio, streams PCM to Gemini Live using a short-lived server-issued token, plays Gemini's returned audio, and records customer/Aria transcript turns. The Express/TypeScript server keeps the permanent `GEMINI_API_KEY`, constrains the Live model configuration and instructions, and owns `get_order_details`. A typed message can be sent through the same Live session, including when microphone access is unavailable. A separate `/api/chat` endpoint supports text-based evaluation.

## Grounding and safety

The agent receives one approved Aura policy module. Order facts come only from `get_order_details`; unknown and missing IDs return explicit errors. Gemini's original model function-call content is preserved during the text tool round trip so required thought signatures and function IDs are retained. Instructions make clear that order lookup is the only action the demo can perform.

## Engineering tradeoffs

Gemini Live keeps speech input, response audio, interruption behavior, and transcription in a single persistent session, reducing per-turn service hops. The browser uses native Web Audio and the Gemini SDK rather than a separate STT-to-LLM-to-TTS cascade. The transcript is kept in memory and interim text is updated in place; the final JSON outcome is derived locally when the call ends.

The hardest part is keeping audio, tool calls, and transcript events ordered while the Live connection streams asynchronously. The client stops microphone tracks and queued audio on call end or disconnect, and the server sends tool results back with their original call IDs.

## Next steps and scale

With another week, I would run browser/device testing for permission denial, interruptions, reconnects, and long calls; add an evaluation set against each policy and guardrail; and measure latency, audio quality, tool accuracy, and per-call model cost. Before handling 1,000 calls/day, I would add authenticated short-lived session issuance, rate limits, privacy-conscious request IDs/metrics, and durable outcome storage only if retention is required. The Express API can then run statelessly behind a load balancer; a queue is not needed for the synchronous voice conversation.
