import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { safeParseJSON } from '../json.js'
import type { LLMProviderId } from './modelMenu.js'

export type ProviderType = 'anthropic' | 'openai-compatible'

export type ProviderConfig = {
  type: ProviderType
  baseURL?: string
  apiKeyEnv?: string
  apiKeyEnvCandidates?: string[]
  model?: string
  defaultModel?: string
  headers?: Record<string, string>
  extraBody?: Record<string, unknown>
  enabled?: boolean
  displayName?: string
}

export type ProvidersFile = {
  activeProvider?: LLMProviderId
  providers?: Record<string, ProviderConfig>
}

export type ActiveLLMSelection = {
  provider: LLMProviderId
  model?: string
  baseURL?: string
  apiKeyEnv?: string
}

export const PROVIDER_PRESETS: Record<LLMProviderId, ProviderConfig> = {
  anthropic: {
    type: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  openai: {
    type: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  deepseek: {
    type: 'openai-compatible',
    baseURL: 'https://api.deepseek.com',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
  },
  zhipu: {
    type: 'openai-compatible',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    apiKeyEnvCandidates: ['ZAI_API_KEY', 'ZHIPUAI_API_KEY'],
    defaultModel: 'glm-4.5',
  },
  custom: {
    type: 'openai-compatible',
  },
}

export function getProvidersConfigPath(): string {
  return process.env.CLAUDE_CODE_PROVIDERS_CONFIG || join(homedir(), '.claude', 'providers.json')
}

export function readProvidersConfig(configPath = getProvidersConfigPath()): ProvidersFile {
  if (!existsSync(configPath)) return {}
  try {
    const parsed = safeParseJSON(readFileSync(configPath, 'utf8'), false)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ProvidersFile
    }
  } catch {
    // Keep provider resolution resilient; caller will surface missing config values.
  }
  return {}
}

export async function writeProvidersConfigAtomic(config: ProvidersFile, configPath = getProvidersConfigPath()): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true })
  const tmpPath = `${configPath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  renameSync(tmpPath, configPath)
}

export function getProviderIdFromEnv(): LLMProviderId | undefined {
  const value = process.env.CLAUDE_CODE_PROVIDER?.toLowerCase().trim()
  if (value === 'anthropic' || value === 'openai' || value === 'deepseek' || value === 'zhipu' || value === 'custom') {
    return value
  }
  if (value === 'glm') return 'zhipu'
  return undefined
}

export function getActiveProviderId(settingsProvider?: string | null): LLMProviderId {
  const envProvider = getProviderIdFromEnv()
  if (envProvider) return envProvider

  const normalizedSettingsProvider = settingsProvider?.toLowerCase().trim()
  if (
    normalizedSettingsProvider === 'anthropic' ||
    normalizedSettingsProvider === 'openai' ||
    normalizedSettingsProvider === 'deepseek' ||
    normalizedSettingsProvider === 'zhipu' ||
    normalizedSettingsProvider === 'custom'
  ) {
    return normalizedSettingsProvider
  }
  if (normalizedSettingsProvider === 'glm') return 'zhipu'

  const fileProvider = readProvidersConfig().activeProvider
  return fileProvider ?? 'anthropic'
}

function pickApiKeyEnv(config: ProviderConfig): string | undefined {
  if (config.apiKeyEnv) return config.apiKeyEnv
  const candidate = config.apiKeyEnvCandidates?.find(envName => !!process.env[envName])
  return candidate ?? config.apiKeyEnvCandidates?.[0]
}

export function resolveProviderConfig(provider: LLMProviderId, settingsModel?: string | null): ProviderConfig {
  const fileConfig = readProvidersConfig().providers?.[provider] ?? {}
  const preset = PROVIDER_PRESETS[provider]
  const merged: ProviderConfig = {
    ...preset,
    ...fileConfig,
    headers: {
      ...(preset.headers ?? {}),
      ...(fileConfig.headers ?? {}),
    },
    extraBody: {
      ...(preset.extraBody ?? {}),
      ...(fileConfig.extraBody ?? {}),
    },
  }

  if (provider === 'custom') {
    merged.baseURL = process.env.CLAUDE_CODE_BASE_URL || merged.baseURL
    merged.apiKeyEnv = process.env.CLAUDE_CODE_API_KEY_ENV || merged.apiKeyEnv
  }

  if (process.env.CLAUDE_CODE_EXTRA_BODY_JSON) {
    const parsed = safeParseJSON(process.env.CLAUDE_CODE_EXTRA_BODY_JSON, false)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      merged.extraBody = {
        ...(merged.extraBody ?? {}),
        ...(parsed as Record<string, unknown>),
      }
    }
  }

  merged.model = process.env.CLAUDE_CODE_MODEL || settingsModel || merged.model || merged.defaultModel
  merged.apiKeyEnv = process.env.CLAUDE_CODE_API_KEY_ENV || pickApiKeyEnv(merged)
  return merged
}

export function resolveActiveLLMSelection(settings?: {
  llmProvider?: string | null
  llmModel?: string | null
}): ActiveLLMSelection {
  const provider = getActiveProviderId(settings?.llmProvider)
  const config = resolveProviderConfig(provider, settings?.llmModel)
  return {
    provider,
    model: config.model,
    baseURL: config.baseURL,
    apiKeyEnv: config.apiKeyEnv,
  }
}

export function validateOpenAICompatibleConfig(provider: LLMProviderId, config: ProviderConfig): string | null {
  if (provider === 'anthropic') return null
  if (!config.baseURL) {
    return `Provider '${provider}' is missing baseURL. Set CLAUDE_CODE_BASE_URL or configure ${getProvidersConfigPath()}.`
  }
  if (!config.apiKeyEnv) {
    return `Provider '${provider}' is missing apiKeyEnv. Set CLAUDE_CODE_API_KEY_ENV or configure ${getProvidersConfigPath()}.`
  }
  if (!process.env[config.apiKeyEnv]) {
    return `Provider '${provider}' requires API key environment variable ${config.apiKeyEnv}.`
  }
  if (!config.model) {
    return `Provider '${provider}' is missing model. Set CLAUDE_CODE_MODEL or configure ${getProvidersConfigPath()}.`
  }
  return null
}

export function getChatCompletionsURL(baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`
}
