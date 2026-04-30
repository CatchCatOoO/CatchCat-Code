import capitalize from 'lodash-es/capitalize.js'
import * as React from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useExitOnCtrlCDWithKeybindings } from 'src/hooks/useExitOnCtrlCDWithKeybindings.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import {
  FAST_MODE_MODEL_DISPLAY,
  isFastModeAvailable,
  isFastModeCooldown,
  isFastModeEnabled,
} from 'src/utils/fastMode.js'
import {
  getDisplayNameForMenuValue,
  getModelMenuOption,
  getModelMenuOptions,
} from 'src/utils/llm/modelMenu.js'
import { Box, Text } from '../ink.js'
import { useKeybindings } from '../keybindings/useKeybinding.js'
import { useAppState, useSetAppState } from '../state/AppState.js'
import {
  convertEffortValueToLevel,
  type EffortLevel,
  getDefaultEffortForModel,
  modelSupportsEffort,
  modelSupportsMaxEffort,
  resolvePickerEffortPersistence,
  toPersistableEffort,
} from '../utils/effort.js'
import type { ModelSetting } from '../utils/model/model.js'
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings.js'
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js'
import { Select } from './CustomSelect/index.js'
import { Byline } from './design-system/Byline.js'
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js'
import { Pane } from './design-system/Pane.js'
import { effortLevelToSymbol } from './EffortIndicator.js'

export type Props = {
  initial: string | null
  sessionModel?: ModelSetting
  onSelect: (model: string | null, effort: EffortLevel | undefined) => void
  onCancel?: () => void
  isStandaloneCommand?: boolean
  showFastModeNotice?: boolean
  /** Optional dim header line below "Select model". Omitted by default. */
  headerText?: string
  /**
   * When true, skip writing effortLevel to userSettings on selection.
   * Used by the assistant installer wizard where the model choice is
   * project-scoped and should not leak to the user's global ~/.claude/settings.
   */
  skipSettingsWrite?: boolean
}

function resolveOptionModel(value?: string | null): string | undefined {
  if (!value) return undefined
  const option = getModelMenuOption(value)
  return option?.kind === 'anthropic-model' ? option.model : undefined
}

function optionSupportsEffort(value?: string | null): boolean {
  const model = resolveOptionModel(value)
  return model ? modelSupportsEffort(model) : false
}

function optionSupportsMaxEffort(value?: string | null): boolean {
  const model = resolveOptionModel(value)
  return model ? modelSupportsMaxEffort(model) : false
}

function getDefaultEffortLevelForOption(value?: string | null): EffortLevel {
  const model = resolveOptionModel(value)
  if (!model) return 'high'
  const defaultValue = getDefaultEffortForModel(model)
  return defaultValue !== undefined ? convertEffortValueToLevel(defaultValue) : 'high'
}

function cycleEffortLevel(
  current: EffortLevel,
  direction: 'left' | 'right',
  includeMax: boolean,
): EffortLevel {
  const levels: EffortLevel[] = includeMax
    ? ['low', 'medium', 'high', 'max']
    : ['low', 'medium', 'high']
  const idx = levels.indexOf(current)
  const currentIndex = idx !== -1 ? idx : levels.indexOf('high')
  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!
  }
  return levels[(currentIndex - 1 + levels.length) % levels.length]!
}

function EffortLevelIndicator({ effort }: { effort?: EffortLevel }) {
  return <Text color={effort ? 'claude' : 'subtle'}>{effortLevelToSymbol(effort ?? 'low')}</Text>
}

export function ModelPicker({
  initial,
  sessionModel,
  onSelect,
  onCancel,
  isStandaloneCommand,
  showFastModeNotice,
  headerText,
  skipSettingsWrite,
}: Props) {
  const setAppState = useSetAppState()
  const exitState = useExitOnCtrlCDWithKeybindings()
  const effortValue = useAppState(s => s.effortValue)
  const [hasToggledEffort, setHasToggledEffort] = useState(false)
  const [effort, setEffort] = useState<EffortLevel | undefined>(
    effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined,
  )

  const modelOptions = useMemo(() => getModelMenuOptions(), [])
  const selectOptions = useMemo(
    () =>
      modelOptions.map(option => ({
        value: option.id,
        label: option.displayName,
      })),
    [modelOptions],
  )

  // Standalone /model must show exactly the fixed 8 entries. Do not append
  // the current model as an additional ninth entry when it is not present.
  const initialFocusValue = useMemo(() => {
    if (initial && selectOptions.some(option => option.value === initial)) {
      return initial
    }
    return selectOptions[0]?.value
  }, [initial, selectOptions])

  const [focusedValue, setFocusedValue] = useState<string | undefined>(initialFocusValue)
  const focusedOption = getModelMenuOption(focusedValue)
  const focusedModelName = focusedOption?.displayName ?? getDisplayNameForMenuValue(focusedValue)
  const focusedSupportsEffort = optionSupportsEffort(focusedValue)
  const focusedSupportsMax = optionSupportsMaxEffort(focusedValue)
  const focusedDefaultEffort = getDefaultEffortLevelForOption(focusedValue)
  const displayEffort = effort === 'max' && !focusedSupportsMax ? 'high' : effort
  const visibleEffort = displayEffort ?? focusedDefaultEffort
  const visibleCount = Math.min(10, selectOptions.length)
  const hiddenCount = Math.max(0, selectOptions.length - visibleCount)

  const handleFocus = useCallback(
    (value: string) => {
      setFocusedValue(value)
      if (!hasToggledEffort && effortValue === undefined) {
        setEffort(getDefaultEffortLevelForOption(value))
      }
    },
    [effortValue, hasToggledEffort],
  )

  const handleCycleEffort = useCallback(
    (direction: 'left' | 'right') => {
      if (!focusedSupportsEffort) return
      setEffort(prev =>
        cycleEffortLevel(prev ?? focusedDefaultEffort, direction, focusedSupportsMax),
      )
      setHasToggledEffort(true)
    },
    [focusedDefaultEffort, focusedSupportsEffort, focusedSupportsMax],
  )

  useKeybindings(
    {
      'modelPicker:decreaseEffort': () => handleCycleEffort('left'),
      'modelPicker:increaseEffort': () => handleCycleEffort('right'),
    },
    { context: 'ModelPicker' },
  )

  const handleSelect = useCallback(
    (value: string) => {
      const selectedModel = resolveOptionModel(value)
      const selectedSupportsEffort = selectedModel ? modelSupportsEffort(selectedModel) : false
      const selectedDefaultEffort = getDefaultEffortLevelForOption(value)
      const selectedEffort = hasToggledEffort && selectedSupportsEffort ? effort : undefined

      logEvent('tengu_model_command_menu_effort', {
        effort: effort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })

      // Provider rows are not Claude models and must never write Claude-only
      // effort settings or call Claude-only model helpers.
      if (!skipSettingsWrite && selectedModel) {
        const effortLevel = resolvePickerEffortPersistence(
          effort,
          selectedDefaultEffort,
          getSettingsForSource('userSettings')?.effortLevel,
          hasToggledEffort,
        )
        const persistable = toPersistableEffort(effortLevel)
        if (persistable !== undefined) {
          updateSettingsForSource('userSettings', {
            effortLevel: persistable,
          })
        }
        setAppState(prev => ({
          ...prev,
          effortValue: effortLevel,
        }))
      }

      onSelect(value, selectedEffort)
    },
    [effort, hasToggledEffort, onSelect, setAppState, skipSettingsWrite],
  )

  const content = (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color="remember" bold={true}>Select model</Text>
        {headerText ? <Text dimColor={true}>{headerText}</Text> : null}
        {sessionModel ? (
          <Text dimColor={true}>
            Currently using {String(sessionModel)} for this session (set by plan mode). Selecting a model will undo this.
          </Text>
        ) : null}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="column">
          <Select
            defaultValue={initialFocusValue}
            defaultFocusValue={initialFocusValue}
            options={selectOptions}
            onChange={handleSelect}
            onFocus={handleFocus}
            onCancel={onCancel ?? (() => {})}
            visibleOptionCount={visibleCount}
          />
        </Box>
        {hiddenCount > 0 ? (
          <Box paddingLeft={3}>
            <Text dimColor={true}>and {hiddenCount} more…</Text>
          </Box>
        ) : null}
      </Box>

      <Box marginBottom={1} flexDirection="column">
        {focusedSupportsEffort ? (
          <Text dimColor={true}>
            <EffortLevelIndicator effort={visibleEffort} />{' '}
            {capitalize(visibleEffort)} effort
            {visibleEffort === focusedDefaultEffort ? ' (default)' : ''}{' '}
            <Text color="subtle">← → to adjust</Text>
          </Text>
        ) : (
          <Text color="subtle">
            <EffortLevelIndicator effort={undefined} /> Effort not supported
            {focusedModelName ? ` for ${focusedModelName}` : ''}
          </Text>
        )}
      </Box>

      {isFastModeEnabled() ? (
        showFastModeNotice ? (
          <Box marginBottom={1}>
            <Text dimColor={true}>
              Fast mode is <Text bold={true}>ON</Text> and available with{' '}
              {FAST_MODE_MODEL_DISPLAY} only (/fast). Switching to other models turns off fast mode.
            </Text>
          </Box>
        ) : isFastModeAvailable() && !isFastModeCooldown() ? (
          <Box marginBottom={1}>
            <Text dimColor={true}>
              Use <Text bold={true}>/fast</Text> to turn on Fast mode ({FAST_MODE_MODEL_DISPLAY} only).
            </Text>
          </Box>
        ) : null
      ) : null}

      {isStandaloneCommand ? (
        <Text dimColor={true} italic={true}>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint action="select:cancel" context="Select" fallback="Esc" description="exit" />
            </Byline>
          )}
        </Text>
      ) : null}
    </Box>
  )

  if (!isStandaloneCommand) return content
  return <Pane color="permission">{content}</Pane>
}
