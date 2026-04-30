import { randomUUID } from 'crypto'
import type { BetaUsage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { Tool, Tools } from '../../Tool.js'
import type {
  AssistantMessage,
  Message,
  MessageContent,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../types/message.js'
import type { SystemPrompt } from '../../utils/systemPromptType.js'
import type { ThinkingConfig } from '../../utils/thinking.js'
import { getSettingsForSource } from '../../utils/settings/settings.js'
import {
  getActiveProviderId,
  getChatCompletionsURL,
  resolveProviderConfig,
  validateOpenAICompatibleConfig,
} from '../../utils/llm/providers.js'
import type { Options } from './claude.js'

export type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

type OpenAIChatCompletionChunk = {
  id?: string
  model?: string
  choices?: Array<{
    delta?: {
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: Array<{
        index?: number
        id?: string
        type?: 'function'
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: OpenAIUsage
}

type OpenAIUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
}

type OpenAIChatCompletion = {
  id?: string
  model?: string
  choices?: Array<{
    message?: {
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: {
          name: string
          arguments: string
        }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: OpenAIUsage
}

type BuiltRequest = {
  provider: ReturnType<typeof getActiveProviderId>
  config: ReturnType<typeof resolveProviderConfig>
  body: Record<string, unknown>
}

function getSettingsLLM(): { llmProvider?: string | null; llmModel?: string | null } {
  const settings = getSettingsForSource('userSettings') ?? {}
  return {
    llmProvider: settings.llmProvider,
    llmModel: settings.llmModel,
  }
}

export function shouldUseOpenAICompatibleProvider(): boolean {
  const settings = getSettingsLLM()
  return getActiveProviderId(settings.llmProvider) !== 'anthropic'
}

function getActiveOpenAICompatibleConfig(settingsModel?: string | null): BuiltRequest['config'] {
  const settings = getSettingsLLM()
  const provider = getActiveProviderId(settings.llmProvider)
  const config = resolveProviderConfig(provider, settingsModel ?? settings.llmModel)
  const validationMessage = validateOpenAICompatibleConfig(provider, config)
  if (validationMessage) {
    throw new Error(validationMessage)
  }
  return config
}

function systemPromptToText(systemPrompt: SystemPrompt): string {
  if (Array.isArray(systemPrompt)) return systemPrompt.filter(Boolean).join('\n\n')
  if (typeof systemPrompt === 'string') return systemPrompt
  return String(systemPrompt ?? '')
}

function stringifyToolResultContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '')
        return JSON.stringify(part)
      })
      .join('\n')
  }
  if (content == null) return ''
  return JSON.stringify(content)
}

function contentBlocksToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return stringifyToolResultContent(content)
  return content
    .filter(block => block && typeof block === 'object')
    .map(block => {
      const b = block as Record<string, unknown>
      if (b.type === 'text') return String(b.text ?? '')
      if (b.type === 'thinking') return String(b.thinking ?? '')
      if ('text' in b) return String(b.text ?? '')
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function messagesToOpenAI(messages: Message[]): OpenAIChatMessage[] {
  const result: OpenAIChatMessage[] = []
  for (const message of messages) {
    const msg = (message as any).message ?? message
    const role = msg.role ?? (message as any).type
    const content = msg.content

    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') continue
        if ((block as any).type === 'tool_result') {
          result.push({
            role: 'tool',
            tool_call_id: String((block as any).tool_use_id ?? (block as any).tool_call_id ?? ''),
            content: stringifyToolResultContent((block as any).content),
          })
        }
      }
    }

    if (role === 'assistant' || (message as any).type === 'assistant') {
      const tool_calls = Array.isArray(content)
        ? content
            .filter(block => block && typeof block === 'object' && (block as any).type === 'tool_use')
            .map(block => ({
              id: String((block as any).id),
              type: 'function' as const,
              function: {
                name: String((block as any).name),
                arguments: JSON.stringify((block as any).input ?? {}),
              },
            }))
        : []
      result.push({
        role: 'assistant',
        content: contentBlocksToText(content) || null,
        ...(tool_calls.length > 0 ? { tool_calls } : {}),
      })
      continue
    }

    if (role === 'user' || (message as any).type === 'user') {
      const text = contentBlocksToText(content)
      if (text) result.push({ role: 'user', content: text })
    }
  }
  return result
}

function normalizeOpenAIJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return {
      type: 'object',
      properties: {},
    }
  }

  const normalized: Record<string, unknown> = { ...(schema as Record<string, unknown>) }

  if (!normalized.type) {
    normalized.type = 'object'
  }

  if (normalized.type === 'object') {
    if (
      !normalized.properties ||
      typeof normalized.properties !== 'object' ||
      Array.isArray(normalized.properties)
    ) {
      normalized.properties = {}
    }

    if (normalized.required !== undefined && !Array.isArray(normalized.required)) {
      delete normalized.required
    }

    const properties = normalized.properties as Record<string, unknown>
    for (const [key, value] of Object.entries(properties)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        properties[key] = normalizeNestedJsonSchema(value)
      }
    }
  }

  return normalized
}

function normalizeNestedJsonSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return schema
  }

  const normalized: Record<string, unknown> = { ...(schema as Record<string, unknown>) }

  if (normalized.type === 'object') {
    if (
      !normalized.properties ||
      typeof normalized.properties !== 'object' ||
      Array.isArray(normalized.properties)
    ) {
      normalized.properties = {}
    }

    const properties = normalized.properties as Record<string, unknown>
    for (const [key, value] of Object.entries(properties)) {
      properties[key] = normalizeNestedJsonSchema(value)
    }
  }

  if (normalized.items) {
    normalized.items = normalizeNestedJsonSchema(normalized.items)
  }

  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (Array.isArray(normalized[key])) {
      normalized[key] = (normalized[key] as unknown[]).map(normalizeNestedJsonSchema)
    }
  }

  return normalized
}

function toolToOpenAITool(tool: Tool): Record<string, unknown> | null {
  const anyTool = tool as any
  const name = anyTool.name
  if (!name) return null

  const rawParameters =
    anyTool.input_schema ??
    anyTool.inputSchema ??
    anyTool.inputJSONSchema ??
    {
      type: 'object',
      properties: {},
    }

  return {
    type: 'function',
    function: {
      name,
      description: anyTool.description ?? '',
      parameters: normalizeOpenAIJsonSchema(rawParameters),
    },
  }
}


function toolsToOpenAI(tools: Tools): Record<string, unknown>[] {
  if (process.env.CLAUDE_CODE_ENABLE_TOOLS === 'false') return []
  const values = Array.isArray(tools) ? tools : Object.values(tools ?? {})
  return values.map(tool => toolToOpenAITool(tool as Tool)).filter(Boolean) as Record<string, unknown>[]
}

function mapUsage(usage?: OpenAIUsage): BetaUsage {
  return {
    input_tokens: usage?.prompt_tokens ?? usage?.input_tokens ?? 0,
    output_tokens: usage?.completion_tokens ?? usage?.output_tokens ?? 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  } as BetaUsage
}

function toolCallsToBlocks(toolCalls: NonNullable<OpenAIChatCompletion['choices']>[number]['message'] extends infer M ? M extends { tool_calls?: infer T } ? T : never : never): MessageContent {
  if (!Array.isArray(toolCalls)) return [] as unknown as MessageContent
  return toolCalls.map(toolCall => {
    let input: unknown = {}
    try {
      input = JSON.parse(toolCall.function.arguments || '{}')
    } catch {
      input = { _raw: toolCall.function.arguments || '' }
    }
    return {
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall.function.name,
      input,
    }
  }) as unknown as MessageContent
}

function buildAssistantMessageFromCompletion(
  completion: OpenAIChatCompletion,
  fallbackModel: string,
  requestId?: string | null,
): AssistantMessage {
  const choice = completion.choices?.[0]
  const message = choice?.message
  const content: unknown[] = []
  if (message?.reasoning_content) {
    content.push({ type: 'thinking', thinking: message.reasoning_content, signature: '' })
  }
  if (message?.content) {
    content.push({ type: 'text', text: message.content })
  }
  const toolBlocks = toolCallsToBlocks(message?.tool_calls as any) as unknown as unknown[]
  content.push(...toolBlocks)

  return {
    message: {
      id: completion.id ?? randomUUID(),
      type: 'message',
      role: 'assistant',
      model: completion.model ?? fallbackModel,
      content: content as MessageContent,
      stop_reason: mapFinishReason(choice?.finish_reason),
      stop_sequence: null,
      usage: mapUsage(completion.usage),
    },
    requestId: requestId ?? completion.id,
    type: 'assistant',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
  } as AssistantMessage
}

function mapFinishReason(reason?: string | null): string | null {
  if (!reason) return null
  if (reason === 'tool_calls') return 'tool_use'
  if (reason === 'length') return 'max_tokens'
  if (reason === 'stop') return 'end_turn'
  return reason
}

function buildRequest({
  messages,
  systemPrompt,
  thinkingConfig,
  tools,
  options,
  stream,
}: {
  messages: Message[]
  systemPrompt: SystemPrompt
  thinkingConfig: ThinkingConfig
  tools: Tools
  options: Options
  stream: boolean
}): BuiltRequest {
  const settings = getSettingsLLM()
  const provider = getActiveProviderId(settings.llmProvider)
  const config = getActiveOpenAICompatibleConfig(settings.llmModel)
  const system = systemPromptToText(systemPrompt)
  const openAIMessages: OpenAIChatMessage[] = []
  if (system) openAIMessages.push({ role: 'system', content: system })
  openAIMessages.push(...messagesToOpenAI(messages))

  const openAITools = toolsToOpenAI(tools)
  const body: Record<string, unknown> = {
    model: config.model,
    messages: openAIMessages,
    stream,
    max_tokens: options.maxOutputTokensOverride,
    ...(thinkingConfig.type !== 'disabled' && !process.env.CLAUDE_CODE_DISABLE_THINKING
      ? { reasoning_effort: (config.extraBody as any)?.reasoning_effort }
      : {}),
    ...(openAITools.length > 0 ? { tools: openAITools, tool_choice: 'auto' } : {}),
    ...(options.temperatureOverride !== undefined ? { temperature: options.temperatureOverride } : {}),
    ...(config.extraBody ?? {}),
  }

  Object.keys(body).forEach(key => {
    if (body[key] === undefined) delete body[key]
  })

  return { provider, config, body }
}

async function postChatCompletions(
  request: BuiltRequest,
  signal: AbortSignal,
): Promise<Response> {
  const apiKeyEnv = request.config.apiKeyEnv
  const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : undefined
  if (!request.config.baseURL) throw new Error(`Provider '${request.provider}' is missing baseURL`)
  if (!apiKeyEnv) throw new Error(`Provider '${request.provider}' is missing apiKeyEnv`)
  if (!apiKey) throw new Error(`Provider '${request.provider}' requires API key environment variable ${apiKeyEnv}`)

  const response = await fetch(getChatCompletionsURL(request.config.baseURL), {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      ...(request.config.headers ?? {}),
    },
    body: JSON.stringify(request.body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Provider '${request.provider}' request failed (${response.status} ${response.statusText}) for model '${request.config.model}': ${text.slice(0, 1000)}`,
    )
  }
  return response
}

export async function queryOpenAICompatibleWithoutStreaming({
  messages,
  systemPrompt,
  thinkingConfig,
  tools,
  signal,
  options,
}: {
  messages: Message[]
  systemPrompt: SystemPrompt
  thinkingConfig: ThinkingConfig
  tools: Tools
  signal: AbortSignal
  options: Options
}): Promise<AssistantMessage> {
  const request = buildRequest({ messages, systemPrompt, thinkingConfig, tools, options, stream: false })
  const response = await postChatCompletions(request, signal)
  const json = (await response.json()) as OpenAIChatCompletion
  return buildAssistantMessageFromCompletion(json, request.config.model ?? options.model, response.headers.get('x-request-id'))
}

function parseSSELine(line: string): OpenAIChatCompletionChunk | null | 'done' {
  if (!line.startsWith('data:')) return null
  const data = line.slice('data:'.length).trim()
  if (!data) return null
  if (data === '[DONE]') return 'done'
  try {
    return JSON.parse(data) as OpenAIChatCompletionChunk
  } catch (error) {
    throw new Error(`StreamParseError: failed to parse OpenAI-compatible SSE event: ${data.slice(0, 500)}; ${(error as Error).message}`)
  }
}

export async function* queryOpenAICompatibleWithStreaming({
  messages,
  systemPrompt,
  thinkingConfig,
  tools,
  signal,
  options,
}: {
  messages: Message[]
  systemPrompt: SystemPrompt
  thinkingConfig: ThinkingConfig
  tools: Tools
  signal: AbortSignal
  options: Options
}): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const request = buildRequest({ messages, systemPrompt, thinkingConfig, tools, options, stream: true })
  const response = await postChatCompletions(request, signal)
  const requestId = response.headers.get('x-request-id')
  const reader = response.body?.getReader()
  if (!reader) throw new Error(`Provider '${request.provider}' returned no response body for streaming request`)

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let reasoning = ''
  let model = request.config.model ?? options.model
  let id = requestId ?? randomUUID()
  let stopReason: string | null = null
  let usage: OpenAIUsage | undefined
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>()
  let textBlockStarted = false
  let textBlockIndex = 0

  const startTextBlockIfNeeded = function* () {
    if (textBlockStarted) return
    textBlockStarted = true
    yield {
      type: 'stream_event',
      event: {
        type: 'message_start',
        message: {
          id,
          type: 'message',
          role: 'assistant',
          model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: mapUsage(),
        },
      },
    } as StreamEvent
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: textBlockIndex,
        content_block: { type: 'text', text: '' },
      },
    } as StreamEvent
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const parsed = parseSSELine(line)
      if (!parsed) continue
      if (parsed === 'done') break
      id = parsed.id ?? id
      model = parsed.model ?? model
      usage = parsed.usage ?? usage
      const choice = parsed.choices?.[0]
      const delta = choice?.delta
      if (choice?.finish_reason) stopReason = mapFinishReason(choice.finish_reason)
      if (!delta) continue

      if (delta.reasoning_content) {
        reasoning += delta.reasoning_content
      }

      if (delta.content) {
        for (const event of startTextBlockIfNeeded()) yield event
        text += delta.content
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: textBlockIndex,
            delta: { type: 'text_delta', text: delta.content },
          },
        } as StreamEvent
      }

      for (const toolCallDelta of delta.tool_calls ?? []) {
        const index = toolCallDelta.index ?? 0
        const existing = toolCalls.get(index) ?? { id: '', name: '', arguments: '' }
        toolCalls.set(index, {
          id: toolCallDelta.id ?? existing.id,
          name: toolCallDelta.function?.name ?? existing.name,
          arguments: existing.arguments + (toolCallDelta.function?.arguments ?? ''),
        })
      }
    }
  }

  if (textBlockStarted) {
    yield {
      type: 'stream_event',
      event: { type: 'content_block_stop', index: textBlockIndex },
    } as StreamEvent
  }

  const content: unknown[] = []
  if (reasoning) content.push({ type: 'thinking', thinking: reasoning, signature: '' })
  if (text) content.push({ type: 'text', text })
  for (const toolCall of toolCalls.values()) {
    let input: unknown = {}
    try {
      input = JSON.parse(toolCall.arguments || '{}')
    } catch {
      input = { _raw: toolCall.arguments }
    }
    content.push({
      type: 'tool_use',
      id: toolCall.id || randomUUID(),
      name: toolCall.name,
      input,
    })
  }

  const assistant: AssistantMessage = {
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model,
      content: content as MessageContent,
      stop_reason: stopReason ?? (toolCalls.size > 0 ? 'tool_use' : 'end_turn'),
      stop_sequence: null,
      usage: mapUsage(usage),
    },
    requestId,
    type: 'assistant',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
  } as AssistantMessage

  yield {
    type: 'stream_event',
    event: {
      type: 'message_delta',
      delta: { stop_reason: assistant.message.stop_reason, stop_sequence: null },
      usage: assistant.message.usage,
    },
  } as StreamEvent
  yield { type: 'stream_event', event: { type: 'message_stop' } } as StreamEvent
  yield assistant
}
