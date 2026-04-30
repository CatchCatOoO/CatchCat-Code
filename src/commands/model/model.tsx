import chalk from 'chalk'
import * as React from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import { ModelPicker } from '../../components/ModelPicker.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { useAppState, useSetAppState } from '../../state/AppState.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import type { EffortLevel } from '../../utils/effort.js'
import { isBilledAsExtraUsage } from '../../utils/extraUsage.js'
import {
  clearFastModeCooldown,
  isFastModeAvailable,
  isFastModeEnabled,
  isFastModeSupportedByModel,
} from '../../utils/fastMode.js'
import {
  getModelMenuIdForSelection,
  getModelMenuOption,
  getSelectionModel,
  isProviderAlias,
  normalizeProviderAlias,
  type LLMProviderId,
} from '../../utils/llm/modelMenu.js'
import {
  resolveProviderConfig,
  validateOpenAICompatibleConfig,
} from '../../utils/llm/providers.js'
import { MODEL_ALIASES } from '../../utils/model/aliases.js'
import {
  checkOpus1mAccess,
  checkSonnet1mAccess,
} from '../../utils/model/check1mAccess.js'
import {
  getDefaultMainLoopModelSetting,
  isOpus1mMergeEnabled,
  renderDefaultModelSetting,
} from '../../utils/model/model.js'
import { isModelAllowed } from '../../utils/model/modelAllowlist.js'
import { validateModel } from '../../utils/model/validateModel.js'
import { updateSettingsForSource } from '../../utils/settings/settings.js'

type ActiveLLMSelection = {
  provider: LLMProviderId
  model?: string
  baseURL?: string
  apiKeyEnv?: string
}

function getProviderFromState(stateProvider?: string | null): LLMProviderId {
  if (
    stateProvider === 'anthropic' ||
    stateProvider === 'openai' ||
    stateProvider === 'deepseek' ||
    stateProvider === 'zhipu' ||
    stateProvider === 'custom'
  ) {
    return stateProvider
  }
  return 'anthropic'
}

function getProviderDisplay(provider: LLMProviderId, model?: string | null): string {
  if (provider === 'zhipu') return model ? `zhipu / glm (${model})` : 'zhipu / glm'
  if (provider === 'anthropic') return model ? renderModelLabel(model) : renderModelLabel(null)
  return model ? `${provider} (${model})` : provider
}

function persistLLMSelection(selection: ActiveLLMSelection): void {
  updateSettingsForSource('userSettings', {
    llmProvider: selection.provider,
    ...(selection.model ? { llmModel: selection.model } : {}),
  })
}

function ModelPickerWrapper({
  onDone,
}: {
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}): React.ReactNode {
  const mainLoopModel = useAppState(s => s.mainLoopModel)
  const mainLoopModelForSession = useAppState(s => s.mainLoopModelForSession)
  const stateProvider = useAppState(s => s.llmProvider ?? s.activeLLMSelection?.provider)
  const stateLLMModel = useAppState(s => s.llmModel ?? s.activeLLMSelection?.model)
  const isFastMode = useAppState(s => s.fastMode)
  const setAppState = useSetAppState()

  const provider = getProviderFromState(stateProvider)
  const initialMenuValue = getModelMenuIdForSelection({
    provider,
    model: provider === 'anthropic' ? mainLoopModel : stateLLMModel,
  })

  const handleCancel = React.useCallback(() => {
    logEvent('tengu_model_command_menu', {
      action: 'cancel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    onDone(`Kept model as ${chalk.bold(getProviderDisplay(provider, provider === 'anthropic' ? mainLoopModel : stateLLMModel))}`, {
      display: 'system',
    })
  }, [mainLoopModel, onDone, provider, stateLLMModel])

  const handleSelect = React.useCallback(
    (menuValue: string | null, effort: EffortLevel | undefined) => {
      const option = getModelMenuOption(menuValue)
      if (!option) {
        onDone(`Unknown model option: ${menuValue ?? 'default'}`, { display: 'system' })
        return
      }

      logEvent('tengu_model_command_menu', {
        action: option.id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        from_model: mainLoopModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        to_model: (option.model ?? option.provider) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })

      if (option.kind === 'provider') {
        const config = resolveProviderConfig(option.provider)
        const validationMessage = validateOpenAICompatibleConfig(option.provider, config)
        const selection: ActiveLLMSelection = {
          provider: option.provider,
          model: config.model,
          baseURL: config.baseURL,
          apiKeyEnv: config.apiKeyEnv,
        }
        persistLLMSelection(selection)
        setAppState(prev => ({
          ...prev,
          llmProvider: selection.provider,
          llmModel: selection.model,
          llmBaseURL: selection.baseURL,
          llmApiKeyEnv: selection.apiKeyEnv,
          activeLLMSelection: selection,
          mainLoopModelForSession: null,
          fastMode: false,
        }))

        const warning = validationMessage ? ` · ${validationMessage}` : ''
        onDone(`Set provider to ${chalk.bold(getProviderDisplay(selection.provider, selection.model))}${warning}`)
        return
      }

      const model = getSelectionModel(option.id)
      setAppState(prev => ({
        ...prev,
        llmProvider: 'anthropic',
        llmModel: model ?? undefined,
        activeLLMSelection: {
          provider: 'anthropic',
          model: model ?? undefined,
        },
        mainLoopModel: model,
        mainLoopModelForSession: null,
      }))
      persistLLMSelection({ provider: 'anthropic', model: model ?? undefined })

      let message = `Set model to ${chalk.bold(renderModelLabel(model))}`
      if (effort !== undefined) {
        message = `${message} with ${chalk.bold(effort)} effort`
      }

      let wasFastModeToggledOn: boolean | undefined = undefined
      if (isFastModeEnabled()) {
        clearFastModeCooldown()
        if (!isFastModeSupportedByModel(model) && isFastMode) {
          setAppState(prev => ({ ...prev, fastMode: false }))
          wasFastModeToggledOn = false
        } else if (isFastModeSupportedByModel(model) && isFastModeAvailable() && isFastMode) {
          message += ' · Fast mode ON'
          wasFastModeToggledOn = true
        }
      }
      if (isBilledAsExtraUsage(model, wasFastModeToggledOn === true, isOpus1mMergeEnabled())) {
        message += ' · Billed as extra usage'
      }
      if (wasFastModeToggledOn === false) {
        message += ' · Fast mode OFF'
      }
      onDone(message)
    },
    [isFastMode, mainLoopModel, onDone, setAppState],
  )

  const showFastModeNotice =
    provider === 'anthropic' &&
    isFastModeEnabled() &&
    isFastMode &&
    isFastModeSupportedByModel(mainLoopModel) &&
    isFastModeAvailable()

  return (
    <ModelPicker
      initial={initialMenuValue}
      sessionModel={mainLoopModelForSession}
      onSelect={handleSelect}
      onCancel={handleCancel}
      isStandaloneCommand={true}
      showFastModeNotice={showFastModeNotice}
    />
  )
}

function SetModelAndClose({
  args,
  onDone,
}: {
  args: string
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}): React.ReactNode {
  const isFastMode = useAppState(s => s.fastMode)
  const stateProvider = useAppState(s => s.llmProvider ?? s.activeLLMSelection?.provider)
  const setAppState = useSetAppState()
  const requested = args.trim()
  const model = requested === 'default' ? null : requested
  const currentProvider = getProviderFromState(stateProvider)

  React.useEffect(() => {
    async function handleModelChange(): Promise<void> {
      if (model && isProviderAlias(model)) {
        setProvider(normalizeProviderAlias(model))
        return
      }

      if (model && currentProvider !== 'anthropic') {
        const config = resolveProviderConfig(currentProvider, model)
        const selection: ActiveLLMSelection = {
          provider: currentProvider,
          model,
          baseURL: config.baseURL,
          apiKeyEnv: config.apiKeyEnv,
        }
        persistLLMSelection(selection)
        setAppState(prev => ({
          ...prev,
          llmProvider: selection.provider,
          llmModel: model,
          llmBaseURL: selection.baseURL,
          llmApiKeyEnv: selection.apiKeyEnv,
          activeLLMSelection: selection,
        }))
        onDone(`Set ${chalk.bold(currentProvider)} model to ${chalk.bold(model)}`)
        return
      }

      if (model && !isModelAllowed(model)) {
        onDone(`Model '${model}' is not available. Your organization restricts model selection.`, {
          display: 'system',
        })
        return
      }

      if (model && isOpus1mUnavailable(model)) {
        onDone('Opus 4.6 with 1M context is not available for your account. Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m', {
          display: 'system',
        })
        return
      }
      if (model && isSonnet1mUnavailable(model)) {
        onDone('Sonnet 4.6 with 1M context is not available for your account. Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m', {
          display: 'system',
        })
        return
      }

      if (!model) {
        setAnthropicModel(null)
        return
      }

      if (isKnownAlias(model)) {
        setAnthropicModel(model)
        return
      }

      try {
        const { valid, error } = await validateModel(model)
        if (valid) {
          setAnthropicModel(model)
        } else {
          onDone(error || `Model '${model}' not found`, { display: 'system' })
        }
      } catch (error) {
        onDone(`Failed to validate model: ${(error as Error).message}`, {
          display: 'system',
        })
      }
    }

    function setProvider(provider: LLMProviderId): void {
      const config = resolveProviderConfig(provider)
      const validationMessage = validateOpenAICompatibleConfig(provider, config)
      const selection: ActiveLLMSelection = {
        provider,
        model: config.model,
        baseURL: config.baseURL,
        apiKeyEnv: config.apiKeyEnv,
      }
      persistLLMSelection(selection)
      setAppState(prev => ({
        ...prev,
        llmProvider: provider,
        llmModel: config.model,
        llmBaseURL: config.baseURL,
        llmApiKeyEnv: config.apiKeyEnv,
        activeLLMSelection: selection,
        fastMode: false,
      }))
      const warning = validationMessage ? ` · ${validationMessage}` : ''
      onDone(`Set provider to ${chalk.bold(getProviderDisplay(provider, config.model))}${warning}`)
    }

    function setAnthropicModel(modelValue: string | null): void {
      setAppState(prev => ({
        ...prev,
        llmProvider: 'anthropic',
        llmModel: modelValue ?? undefined,
        activeLLMSelection: {
          provider: 'anthropic',
          model: modelValue ?? undefined,
        },
        mainLoopModel: modelValue,
        mainLoopModelForSession: null,
      }))
      persistLLMSelection({ provider: 'anthropic', model: modelValue ?? undefined })

      let message = `Set model to ${chalk.bold(renderModelLabel(modelValue))}`
      let wasFastModeToggledOn: boolean | undefined = undefined
      if (isFastModeEnabled()) {
        clearFastModeCooldown()
        if (!isFastModeSupportedByModel(modelValue) && isFastMode) {
          setAppState(prev => ({ ...prev, fastMode: false }))
          wasFastModeToggledOn = false
        } else if (isFastModeSupportedByModel(modelValue) && isFastMode) {
          message += ' · Fast mode ON'
          wasFastModeToggledOn = true
        }
      }
      if (isBilledAsExtraUsage(modelValue, wasFastModeToggledOn === true, isOpus1mMergeEnabled())) {
        message += ' · Billed as extra usage'
      }
      if (wasFastModeToggledOn === false) {
        message += ' · Fast mode OFF'
      }
      onDone(message)
    }

    void handleModelChange()
  }, [currentProvider, isFastMode, model, onDone, setAppState])
  return null
}

function isKnownAlias(model: string): boolean {
  return (MODEL_ALIASES as readonly string[]).includes(model.toLowerCase().trim())
}

function isOpus1mUnavailable(model: string): boolean {
  const m = model.toLowerCase()
  return !checkOpus1mAccess() && !isOpus1mMergeEnabled() && m.includes('opus') && m.includes('[1m]')
}

function isSonnet1mUnavailable(model: string): boolean {
  const m = model.toLowerCase()
  return !checkSonnet1mAccess() && (m.includes('sonnet[1m]') || m.includes('sonnet-4-6[1m]'))
}

function ShowModelAndClose({
  onDone,
}: {
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}): React.ReactNode {
  const mainLoopModel = useAppState(s => s.mainLoopModel)
  const mainLoopModelForSession = useAppState(s => s.mainLoopModelForSession)
  const effortValue = useAppState(s => s.effortValue)
  const provider = getProviderFromState(useAppState(s => s.llmProvider ?? s.activeLLMSelection?.provider))
  const llmModel = useAppState(s => s.llmModel ?? s.activeLLMSelection?.model)

  if (provider !== 'anthropic') {
    onDone(`Current provider: ${chalk.bold(getProviderDisplay(provider, llmModel))}`)
    return null
  }

  const displayModel = renderModelLabel(mainLoopModel)
  const effortInfo = effortValue !== undefined ? ` (effort: ${effortValue})` : ''
  if (mainLoopModelForSession) {
    onDone(`Current model: ${chalk.bold(renderModelLabel(mainLoopModelForSession))} (session override from plan mode)\nBase model: ${displayModel}${effortInfo}`)
  } else {
    onDone(`Current model: ${displayModel}${effortInfo}`)
  }
  return null
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  args = args?.trim() || ''
  if (COMMON_INFO_ARGS.includes(args)) {
    logEvent('tengu_model_command_inline_help', {
      args: args as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return <ShowModelAndClose onDone={onDone} />
  }
  if (COMMON_HELP_ARGS.includes(args)) {
    onDone('Run /model to open the model/provider selection menu, or /model [modelName|provider] to set it.', {
      display: 'system',
    })
    return
  }
  if (args) {
    logEvent('tengu_model_command_inline', {
      args: args as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return <SetModelAndClose args={args} onDone={onDone} />
  }
  return <ModelPickerWrapper onDone={onDone} />
}

function renderModelLabel(model: string | null): string {
  const rendered = renderDefaultModelSetting(model ?? getDefaultMainLoopModelSetting())
  return model === null ? `${rendered} (default)` : rendered
}
