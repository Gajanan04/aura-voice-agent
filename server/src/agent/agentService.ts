import { FunctionCallingConfigMode, GoogleGenAI, type Content, type Part } from '@google/genai'
import { ariaInstructions } from './instructions.js'
import { auraToolDefinitions, orderLookupTool, productCatalogTool } from './toolDefinitions.js'
import { brandPolicyInfo } from '../data/brandPolicies.js'
import type { InvalidToolArgumentsResult, OrderLookupResult, ProductCatalogResult } from '../data/types.js'
import { get_order_details } from '../tools/getOrderDetails.js'
import { get_product_catalog } from '../tools/getProductCatalog.js'

export interface ConversationMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface AgentToolCallMessage {
  readonly id: string
  readonly type: 'function'
  readonly function: { readonly name: string; readonly arguments: string }
}

export type AgentInputItem =
  | { readonly role: 'user' | 'assistant'; readonly content: string }
  | { readonly role: 'model'; readonly modelContent: Content }
  | { readonly role: 'assistant'; readonly content: null; readonly tool_calls: readonly AgentToolCallMessage[] }
  | { readonly role: 'tool'; readonly tool_call_id: string; readonly name: string; readonly content: string }

export interface AgentModelFunctionCall {
  readonly callId: string
  readonly name: string
  readonly arguments: string
}

export interface AgentModelResponse {
  readonly id: string
  readonly outputText: string
  readonly functionCalls: readonly AgentModelFunctionCall[]
  /** Preserve the SDK's full model turn, including Gemini 3 thought signatures. */
  readonly modelContent?: Content
}

export interface AgentModelRequest {
  readonly model: string
  readonly instructions: string
  readonly input: readonly AgentInputItem[]
  readonly toolChoice: 'auto' | 'none'
}

export interface AgentModelClient {
  createResponse(request: AgentModelRequest): Promise<AgentModelResponse>
}

export interface ToolCallRecord {
  readonly name: string
  readonly arguments: Readonly<Record<string, unknown>>
  readonly result: OrderLookupResult | ProductCatalogResult | InvalidToolArgumentsResult
}

export interface AgentServiceInput {
  readonly message: string
  readonly history?: readonly ConversationMessage[]
  /** Injection point for deterministic tests; production callers should omit it. */
  readonly modelClient?: AgentModelClient
  /** Model override is useful for tests; production uses the approved Gemini model. */
  readonly model?: string
}

export interface AgentServiceResult {
  readonly message: string
  readonly toolCalls: readonly ToolCallRecord[]
  readonly history: readonly ConversationMessage[]
}

export class AgentConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentConfigurationError'
  }
}

const MAX_CONTEXT_MESSAGES = 18
const SAFE_FALLBACK = 'I’m sorry, I wasn’t able to complete that request. Please try again.'

const DEFAULT_CHAT_MODEL = 'gemini-3.8-flash'

function toGeminiContents(input: readonly AgentInputItem[]): Content[] {
  return input.map((item): Content => {
    if (item.role === 'tool') {
      let response: unknown
      try { response = JSON.parse(item.content) } catch { response = { ok: false } }
      return { role: 'user', parts: [{ functionResponse: {
        id: item.tool_call_id,
        name: item.name,
        response: response as Record<string, unknown>,
      } }] }
    }
    if (item.role === 'model') return item.modelContent
    if (!('tool_calls' in item)) {
      return { role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] }
    }
    return {
      role: 'model',
      parts: item.tool_calls.map((call): Part => ({ functionCall: {
        id: call.id,
        name: call.function.name,
        args: JSON.parse(call.function.arguments) as Record<string, unknown>,
      } })),
    }
  })
}

class GeminiChatClient implements AgentModelClient {
  private readonly client: GoogleGenAI

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000 } })
  }

  async createResponse(request: AgentModelRequest): Promise<AgentModelResponse> {
    const response = await this.client.models.generateContent({
      model: request.model,
      contents: toGeminiContents(request.input),
      config: {
        systemInstruction: request.instructions,
        tools: [{ functionDeclarations: auraToolDefinitions }],
        toolConfig: { functionCallingConfig: { mode: request.toolChoice === 'none' ? FunctionCallingConfigMode.NONE : FunctionCallingConfigMode.AUTO } },
      },
    })
    const calls = response.functionCalls ?? []
    const outputText = (response.candidates ?? [])
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .filter((text): text is string => typeof text === 'string')
      .join('')

    return {
      id: response.responseId ?? '',
      outputText,
      modelContent: response.candidates?.[0]?.content ?? undefined,
      functionCalls: calls.map((call, index) => ({
        callId: call.id ?? `gemini-call-${index}`,
        name: call.name ?? '',
        arguments: JSON.stringify(call.args ?? {}),
      })),
    }
  }
}

function validatedArguments(name: string, rawArguments: string):
  | { readonly ok: true; readonly orderId?: string; readonly args: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly args: Readonly<Record<string, unknown>> } {
  try {
    const value: unknown = JSON.parse(rawArguments)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, args: {} }
    }

    const args = value as Record<string, unknown>
    if (name === orderLookupTool.name && Object.keys(args).length === 1 && typeof args.order_id === 'string') {
      return { ok: true, orderId: args.order_id, args: { order_id: args.order_id } }
    }
    if (name === productCatalogTool.name && Object.keys(args).length === 0) {
      return { ok: true, args: {} }
    }
    if (name !== orderLookupTool.name && name !== productCatalogTool.name) {
      return { ok: false, args }
    }
    return { ok: false, args }
  } catch {
    return { ok: false, args: {} }
  }
}

function approvedInstructions(): string {
  return `${ariaInstructions}\n\nApproved Aura Skincare brand and policy information (the only approved non-order facts):\n${JSON.stringify(brandPolicyInfo)}`
}

/**
 * Runs one text turn and at most one tool-result round trip. Conversation state
 * is supplied and returned by the caller; this service keeps no customer state.
 */
export async function agentService(input: AgentServiceInput): Promise<AgentServiceResult> {
  const message = input.message.trim()
  if (!message) throw new TypeError('A customer message is required.')

  const model = input.model?.trim() || DEFAULT_CHAT_MODEL

  let modelClient = input.modelClient
  if (!modelClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) throw new AgentConfigurationError('The AI service is not configured.')
    modelClient = new GeminiChatClient(apiKey)
  }

  const priorHistory = (input.history ?? []).slice(-MAX_CONTEXT_MESSAGES)
  const instructions = approvedInstructions()
  const turnInput: AgentInputItem[] = [...priorHistory, { role: 'user', content: message }]
  const firstResponse = await modelClient.createResponse({
    model,
    instructions,
    input: turnInput,
    toolChoice: 'auto',
  })

  const toolCalls: ToolCallRecord[] = []
  let finalMessage = firstResponse.outputText.trim()

  if (firstResponse.functionCalls.length > 0) {
    const toolOutputs: AgentInputItem[] = []

    for (const call of firstResponse.functionCalls) {
      const parsed = validatedArguments(call.name, call.arguments)
      let result: ToolCallRecord['result']

      if (!parsed.ok) {
        result = {
          ok: false,
          error: {
            code: 'INVALID_TOOL_ARGUMENTS',
            message: call.name === productCatalogTool.name
              ? 'The product catalog could not be returned because the tool request was invalid.'
              : 'The order lookup could not be completed because the tool request was invalid.',
          },
        }
      } else if (call.name === orderLookupTool.name) {
        result = get_order_details(parsed.orderId)
      } else if (call.name === productCatalogTool.name) {
        result = get_product_catalog()
      } else {
        result = {
          ok: false,
          error: {
            code: 'INVALID_TOOL_ARGUMENTS',
            message: 'The requested tool is not available.',
          },
        }
      }

      const args = parsed.ok ? parsed.args : {}
      toolCalls.push({ name: call.name, arguments: args, result })
      toolOutputs.push({
        role: 'tool',
        tool_call_id: call.callId,
        name: call.name,
        content: JSON.stringify(result),
      })
    }

    const finalResponse = await modelClient.createResponse({
      model,
      instructions,
      input: [
        ...turnInput,
        firstResponse.modelContent ? { role: 'model', modelContent: firstResponse.modelContent } : {
          role: 'assistant',
          content: null,
          tool_calls: firstResponse.functionCalls.map((call) => ({
            id: call.callId,
            type: 'function',
            function: { name: call.name, arguments: call.arguments },
          })),
        },
        ...toolOutputs,
      ],
      toolChoice: 'none',
    })
    finalMessage = finalResponse.outputText.trim()
  }

  if (!finalMessage) finalMessage = SAFE_FALLBACK

  return {
    message: finalMessage,
    toolCalls,
    history: [
      ...priorHistory,
      { role: 'user', content: message },
      { role: 'assistant', content: finalMessage },
    ],
  }
}
