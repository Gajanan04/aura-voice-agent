import { Modality, type LiveConnectConfig } from '@google/genai'
import { ariaInstructions } from '../agent/instructions.js'
import { brandPolicyInfo } from '../data/brandPolicies.js'
import { auraToolDefinitions } from '../agent/toolDefinitions.js'

export const GEMINI_LIVE_MODEL = 'gemini-3.8-live'

export const geminiLiveConfig = {
  responseModalities: [Modality.AUDIO],
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: false,
      silenceDurationMs: 500,
    },
  },
  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
  systemInstruction: {
    parts: [{ text: `${ariaInstructions}\n\nApproved Aura Skincare brand and policy information (the only approved non-order facts):\n${JSON.stringify(brandPolicyInfo)}` }],
  },
  tools: [{ functionDeclarations: auraToolDefinitions }],
} satisfies LiveConnectConfig
