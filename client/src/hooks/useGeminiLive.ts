import { GoogleGenAI, VoiceActivityType, type LiveServerMessage, type Session } from '@google/genai'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatToolCall } from '../lib/chat'
import { lookupOrder, lookupProductCatalog, requestLiveCredentials } from '../lib/geminiLive'
import { LiveTranscriptOrder } from '../lib/liveTranscriptOrder'
import type { LiveTranscriptTurn } from '../lib/liveTranscriptOrder'

export type { LiveTranscriptTurn } from '../lib/liveTranscriptOrder'

export type GeminiCallState = 'IDLE' | 'CONNECTING' | 'READY' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ENDED'
interface GeminiLiveCallbacks {
  readonly onTranscript: (turn: LiveTranscriptTurn) => void
  readonly onToolCall: (call: ChatToolCall) => void
  readonly onStateChange: (state: GeminiCallState) => void
}

interface GeminiLiveController {
  readonly state: GeminiCallState
  readonly isMicrophoneOn: boolean
  readonly isStarting: boolean
  readonly error: string | null
  readonly startCall: () => Promise<void>
  readonly endCall: () => void
  readonly toggleMicrophone: () => Promise<void>
  readonly sendText: (text: string) => void
}

function encodePcm(data: Float32Array, sampleRate: number): string {
  const ratio = sampleRate / 16_000
  const count = Math.floor(data.length / ratio)
  const pcm = new Uint8Array(count * 2)
  const view = new DataView(pcm.buffer)
  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(Math.floor((index + 1) * ratio), data.length)
    let sum = 0
    for (let cursor = start; cursor < end; cursor += 1) sum += data[cursor] ?? 0
    const value = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
    view.setInt16(index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true)
  }
  let binary = ''
  for (let index = 0; index < pcm.length; index += 0x8000) {
    binary += String.fromCharCode(...pcm.subarray(index, Math.min(index + 0x8000, pcm.length)))
  }
  return btoa(binary)
}

export function useGeminiLive(callbacks: GeminiLiveCallbacks): GeminiLiveController {
  const [state, setState] = useState<GeminiCallState>('IDLE')
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const callbacksRef = useRef(callbacks)
  const sessionRef = useRef<Session | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())
  const nextOutputTimeRef = useRef(0)
  const transcriptOrderRef = useRef<LiveTranscriptOrder | null>(null)
  if (!transcriptOrderRef.current) {
    transcriptOrderRef.current = new LiveTranscriptOrder((turn) => callbacksRef.current.onTranscript(turn))
  }
  const connectedRef = useRef(false)
  const microphoneOnRef = useRef(false)
  const callGenerationRef = useRef(0)
  const startingRef = useRef(false)

  useEffect(() => { callbacksRef.current = callbacks }, [callbacks])

  const updateState = useCallback((next: GeminiCallState) => {
    setState(next)
    callbacksRef.current.onStateChange(next)
  }, [])

  const stopMicrophone = useCallback((sendEnd: boolean) => {
    const session = sessionRef.current
    if (sendEnd && session) {
      try { session.sendRealtimeInput({ audioStreamEnd: true }) } catch { /* session may already be closed */ }
    }
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null
      processorRef.current.disconnect()
      processorRef.current = null
    }
    sourceRef.current?.disconnect()
    sourceRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    microphoneOnRef.current = false
    setIsMicrophoneOn(false)
  }, [])

  const attachMicrophone = useCallback(async (
    session = sessionRef.current,
    generation = callGenerationRef.current,
  ): Promise<boolean> => {
    const context = audioContextRef.current
    if (!session || !context) throw new Error('The Gemini Live session is not ready.')
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not provide microphone access.')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    if (callGenerationRef.current !== generation || sessionRef.current !== session || audioContextRef.current !== context) {
      stream.getTracks().forEach((track) => track.stop())
      return false
    }

    let source: MediaStreamAudioSourceNode | null = null
    let processor: ScriptProcessorNode | null = null
    try {
      source = context.createMediaStreamSource(stream)
      processor = context.createScriptProcessor(2048, 1, 1)
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        const output = event.outputBuffer.getChannelData(0)
        output.fill(0)
        try {
          session.sendRealtimeInput({ audio: { data: encodePcm(input, event.inputBuffer.sampleRate), mimeType: 'audio/pcm;rate=16000' } })
        } catch { /* a closed session stops accepting microphone chunks */ }
      }
      source.connect(processor)
      processor.connect(context.destination)
    } catch (error) {
      try { source?.disconnect() } catch { /* cleanup only */ }
      try { processor?.disconnect() } catch { /* cleanup only */ }
      stream.getTracks().forEach((track) => track.stop())
      throw error
    }
    streamRef.current = stream
    sourceRef.current = source
    processorRef.current = processor
    microphoneOnRef.current = true
    setIsMicrophoneOn(true)
    return true
  }, [])

  const closeAudio = useCallback(() => {
    outputSourcesRef.current.forEach((source) => { try { source.stop() } catch { /* already finished */ } })
    outputSourcesRef.current.clear()
    nextOutputTimeRef.current = 0
    const context = audioContextRef.current
    audioContextRef.current = null
    if (context && context.state !== 'closed') void context.close().catch(() => undefined)
  }, [])

  const playAudio = useCallback((base64: string) => {
    const context = audioContextRef.current
    if (!context) return
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    const sampleCount = Math.floor(bytes.length / 2)
    const view = new DataView(bytes.buffer)
    const buffer = context.createBuffer(1, sampleCount, 24_000)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < sampleCount; index += 1) channel[index] = view.getInt16(index * 2, true) / 32_768
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    const startAt = Math.max(context.currentTime, nextOutputTimeRef.current)
    source.start(startAt)
    nextOutputTimeRef.current = startAt + buffer.duration
    outputSourcesRef.current.add(source)
    source.onended = () => outputSourcesRef.current.delete(source)
    updateState('SPEAKING')
  }, [updateState])

  const handleToolCalls = useCallback(async (message: LiveServerMessage, session: Session) => {
    const calls = message.toolCall?.functionCalls ?? []
    for (const call of calls) {
      const args = call.args ?? {}
      const orderId = typeof args.order_id === 'string' ? args.order_id : ''
      let result: ChatToolCall['result']
      if (call.name === 'get_order_details') {
        try { result = await lookupOrder(orderId) } catch {
          result = { ok: false, error: { code: 'LOOKUP_UNAVAILABLE', message: 'The order lookup could not be completed. Please try again.' } }
        }
      } else if (call.name === 'get_product_catalog') {
        try { result = await lookupProductCatalog() } catch {
          result = { ok: false, error: { code: 'CATALOG_UNAVAILABLE', message: 'The product catalog could not be returned. Please try again.' } }
        }
      } else {
        result = {
          ok: false,
          error: {
            code: 'INVALID_TOOL_ARGUMENTS',
            message: 'The requested tool is not available.',
          },
        }
      }
      const toolCall: ChatToolCall = { name: call.name ?? 'get_order_details', arguments: args, result }
      callbacksRef.current.onToolCall(toolCall)
      if (call.id && sessionRef.current === session) {
        session.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name ?? 'get_order_details', response: result }] })
      }
    }
  }, [])

  const handleMessage = useCallback((message: LiveServerMessage, session: Session) => {
    const content = message.serverContent
    const transcriptOrder = transcriptOrderRef.current
    if (message.voiceActivity?.voiceActivityType === VoiceActivityType.ACTIVITY_START) {
      transcriptOrder?.customerActivityStarted()
    }
    const interimCustomer = content?.interimInputTranscription?.text?.trim()
    if (interimCustomer) transcriptOrder?.customerInterim(interimCustomer)
    if (content?.inputTranscription) {
      transcriptOrder?.customerFinal(content.inputTranscription.text ?? '')
      updateState('THINKING')
    }
    if (content?.outputTranscription?.text) {
      transcriptOrder?.ariaTranscript(content.outputTranscription.text)
      updateState('SPEAKING')
    }
    for (const part of content?.modelTurn?.parts ?? []) {
      if (part.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) playAudio(part.inlineData.data)
    }
    if (message.toolCall?.functionCalls?.length) {
      updateState('THINKING')
      void handleToolCalls(message, session)
    }
    if (content?.interrupted) {
      transcriptOrder?.modelTurnFinished()
      outputSourcesRef.current.forEach((source) => { try { source.stop() } catch { /* already finished */ } })
      outputSourcesRef.current.clear()
      nextOutputTimeRef.current = audioContextRef.current?.currentTime ?? 0
      updateState(microphoneOnRef.current ? 'LISTENING' : 'READY')
    }
    if (content?.turnComplete) {
      transcriptOrder?.modelTurnFinished()
      const remaining = Math.max(0, (nextOutputTimeRef.current - (audioContextRef.current?.currentTime ?? 0)) * 1000)
      updateState(remaining > 0 ? 'SPEAKING' : microphoneOnRef.current ? 'LISTENING' : 'READY')
      if (remaining > 0) window.setTimeout(() => {
        if (sessionRef.current === session) updateState(microphoneOnRef.current ? 'LISTENING' : 'READY')
      }, remaining)
    }
  }, [handleToolCalls, playAudio, updateState])

  const startCall = useCallback(async () => {
    if (sessionRef.current || startingRef.current) return
    startingRef.current = true
    const generation = callGenerationRef.current + 1
    callGenerationRef.current = generation
    transcriptOrderRef.current?.reset(true)
    setIsStarting(true)
    setError(null)
    updateState('CONNECTING')
    try {
      const credentials = await requestLiveCredentials()
      if (callGenerationRef.current !== generation) return
      const ai = new GoogleGenAI({ apiKey: credentials.token, httpOptions: { apiVersion: 'v1alpha' } })
      let callbackSession: Session | null = null
      const session = await ai.live.connect({
        model: credentials.model,
        callbacks: {
          onmessage: (message) => { if (callbackSession) handleMessage(message, callbackSession) },
          onerror: () => setError('Gemini Live connection was interrupted. Please restart the call.'),
          onclose: () => {
            if (connectedRef.current && callbackSession && sessionRef.current === callbackSession) {
              connectedRef.current = false
              stopMicrophone(false)
              closeAudio()
              transcriptOrderRef.current?.finishCall()
              sessionRef.current = null
              updateState('ENDED')
            }
          },
        },
      })
      if (callGenerationRef.current !== generation) {
        session.close()
        return
      }
      callbackSession = session
      sessionRef.current = session
      connectedRef.current = true
      let microphoneAvailable = false
      try {
        if (typeof window.AudioContext !== 'function') throw new Error('This browser does not support audio playback.')
        const audioContext = new window.AudioContext({ sampleRate: 16_000 })
        audioContextRef.current = audioContext
        await audioContext.resume()
        if (callGenerationRef.current !== generation) return
        microphoneAvailable = await attachMicrophone(session, generation)
      } catch {
        if (callGenerationRef.current !== generation) return
        setError('Microphone or audio access is unavailable. You can still use typed messages.')
      }
      if (callGenerationRef.current !== generation || sessionRef.current !== session || !connectedRef.current) return
      updateState(microphoneAvailable ? 'LISTENING' : 'READY')
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: 'Greet the customer briefly as Aria and invite them to ask about Aura Skincare.' }] }], turnComplete: true })
    } catch (startError) {
      if (callGenerationRef.current !== generation) return
      const session = sessionRef.current
      sessionRef.current = null
      connectedRef.current = false
      try { session?.close() } catch { /* the connection may not have opened */ }
      stopMicrophone(false)
      closeAudio()
      setError(startError instanceof Error ? startError.message : 'Gemini Live could not be started. Please try again.')
      updateState('IDLE')
    } finally {
      if (callGenerationRef.current === generation) {
        startingRef.current = false
        setIsStarting(false)
      }
    }
  }, [attachMicrophone, closeAudio, handleMessage, stopMicrophone, updateState])

  const endCall = useCallback(() => {
    callGenerationRef.current += 1
    startingRef.current = false
    setIsStarting(false)
    transcriptOrderRef.current?.finishCall()
    connectedRef.current = false
    stopMicrophone(true)
    sessionRef.current?.close()
    sessionRef.current = null
    closeAudio()
    updateState('ENDED')
  }, [closeAudio, stopMicrophone, updateState])

  const toggleMicrophone = useCallback(async () => {
    if (!sessionRef.current) return
    const session = sessionRef.current
    const generation = callGenerationRef.current
    setError(null)
    if (isMicrophoneOn) {
      stopMicrophone(true)
      updateState('READY')
      return
    }

    setIsStarting(true)
    try {
      const attached = await attachMicrophone(session, generation)
      if (callGenerationRef.current !== generation || sessionRef.current !== session) return
      if (attached) updateState('LISTENING')
    } catch {
      if (callGenerationRef.current === generation && sessionRef.current === session) {
        setError('Microphone access is unavailable. Allow microphone access or use typed messages.')
        updateState('READY')
      }
    } finally {
      if (callGenerationRef.current === generation) setIsStarting(false)
    }
  }, [attachMicrophone, isMicrophoneOn, stopMicrophone, updateState])

  const sendText = useCallback((text: string) => {
    const clean = text.trim()
    if (!clean || !sessionRef.current) return
    try {
      transcriptOrderRef.current?.customerTextAlreadyCommitted()
      updateState('THINKING')
      sessionRef.current.sendClientContent({ turns: [{ role: 'user', parts: [{ text: clean }] }], turnComplete: true })
    } catch {
      setError('Gemini Live could not receive that message. Please try again.')
      updateState(microphoneOnRef.current ? 'LISTENING' : 'THINKING')
    }
  }, [updateState])

  useEffect(() => () => {
    callGenerationRef.current += 1
    startingRef.current = false
    connectedRef.current = false
    stopMicrophone(false)
    try { sessionRef.current?.close() } catch { /* cleanup only */ }
    closeAudio()
  }, [closeAudio, stopMicrophone])

  return { state, isMicrophoneOn, isStarting, error, startCall, endCall, toggleMicrophone, sendText }
}
