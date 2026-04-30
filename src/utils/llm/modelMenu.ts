export type LLMProviderId = 'anthropic' | 'openai' | 'deepseek' | 'zhipu' | 'custom'

export type ModelMenuOption = {
  id: string
  displayName: string
  kind: 'anthropic-model' | 'provider'
  provider: LLMProviderId
  model?: string
  context?: '1m' | 'default'
}

export const MODEL_MENU_OPTIONS: ModelMenuOption[] = [
  {
    id: 'anthropic:sonnet-1m',
    displayName: 'Sonnet (1M context)',
    kind: 'anthropic-model',
    provider: 'anthropic',
    model: 'sonnet[1m]',
    context: '1m',
  },
  {
    id: 'anthropic:opus',
    displayName: 'Opus',
    kind: 'anthropic-model',
    provider: 'anthropic',
    model: 'opus',
    context: 'default',
  },
  {
    id: 'anthropic:opus-1m',
    displayName: 'Opus (1M context)',
    kind: 'anthropic-model',
    provider: 'anthropic',
    model: 'opus[1m]',
    context: '1m',
  },
  {
    id: 'anthropic:haiku',
    displayName: 'Haiku',
    kind: 'anthropic-model',
    provider: 'anthropic',
    model: 'haiku',
    context: 'default',
  },
  {
    id: 'provider:openai',
    displayName: 'openai',
    kind: 'provider',
    provider: 'openai',
  },
  {
    id: 'provider:deepseek',
    displayName: 'deepseek',
    kind: 'provider',
    provider: 'deepseek',
  },
  {
    id: 'provider:zhipu',
    displayName: 'zhipu / glm',
    kind: 'provider',
    provider: 'zhipu',
  },
  {
    id: 'provider:custom',
    displayName: 'custom',
    kind: 'provider',
    provider: 'custom',
  },
]

export const PROVIDER_ALIASES = ['openai', 'deepseek', 'zhipu', 'glm', 'custom'] as const

export function getModelMenuOptions(): ModelMenuOption[] {
  return MODEL_MENU_OPTIONS
}

export function getModelMenuOption(id: string | null | undefined): ModelMenuOption | undefined {
  if (!id) return undefined
  return MODEL_MENU_OPTIONS.find(option => option.id === id)
}

export function isProviderAlias(value: string | null | undefined): boolean {
  if (!value) return false
  return (PROVIDER_ALIASES as readonly string[]).includes(value.toLowerCase().trim())
}

export function normalizeProviderAlias(value: string): LLMProviderId {
  const normalized = value.toLowerCase().trim()
  if (normalized === 'glm') return 'zhipu'
  if (normalized === 'openai' || normalized === 'deepseek' || normalized === 'zhipu' || normalized === 'custom') {
    return normalized
  }
  return 'anthropic'
}

export function getProviderMenuId(provider: LLMProviderId): string {
  return `provider:${provider}`
}

export function isProviderMenuValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('provider:')
}

export function getSelectionProvider(value: string | null | undefined): LLMProviderId {
  const option = getModelMenuOption(value)
  return option?.provider ?? 'anthropic'
}

export function getSelectionModel(value: string | null | undefined): string | null {
  const option = getModelMenuOption(value)
  if (!option) return value ?? null
  return option.kind === 'anthropic-model' ? option.model ?? null : null
}

export function getDisplayNameForMenuValue(value: string | null | undefined): string {
  const option = getModelMenuOption(value)
  if (option) return option.displayName
  if (!value) return 'default'
  return value
}

export function getModelMenuIdForSelection(selection: {
  provider?: LLMProviderId | string | null
  model?: string | null
}): string {
  const provider = selection.provider ?? 'anthropic'
  if (provider !== 'anthropic') {
    return getProviderMenuId(provider as LLMProviderId)
  }

  const model = selection.model?.toLowerCase().trim() ?? ''
  if (model.includes('sonnet') && model.includes('[1m]')) return 'anthropic:sonnet-1m'
  if (model.includes('opus') && model.includes('[1m]')) return 'anthropic:opus-1m'
  if (model.includes('opus')) return 'anthropic:opus'
  if (model.includes('haiku')) return 'anthropic:haiku'
  return 'anthropic:sonnet-1m'
}
