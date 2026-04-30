# Model Provider Selection

`/model` now shows a fixed eight-item menu:

1. Sonnet (1M context)
2. Opus
3. Opus (1M context)
4. Haiku
5. openai
6. deepseek
7. zhipu / glm
8. custom

The menu intentionally does not show the old Default row, ordinary Sonnet row,
price descriptions, or the long explanatory header.

## Environment variables

### OpenAI

```sh
export CLAUDE_CODE_PROVIDER=openai
export OPENAI_API_KEY=sk-...
export CLAUDE_CODE_MODEL=gpt-4.1
```

### DeepSeek

```sh
export CLAUDE_CODE_PROVIDER=deepseek
export DEEPSEEK_API_KEY=sk-...
export CLAUDE_CODE_MODEL=deepseek-chat
```

### Zhipu / GLM

```sh
export CLAUDE_CODE_PROVIDER=zhipu
export ZAI_API_KEY=...
export CLAUDE_CODE_MODEL=glm-4.5
```

`ZHIPUAI_API_KEY` is also accepted when `ZAI_API_KEY` is not set.

### Custom OpenAI-compatible endpoint

```sh
export CLAUDE_CODE_PROVIDER=custom
export CLAUDE_CODE_BASE_URL=http://localhost:8000/v1
export CLAUDE_CODE_API_KEY_ENV=LOCAL_LLM_API_KEY
export LOCAL_LLM_API_KEY=dummy
export CLAUDE_CODE_MODEL=qwen3-coder
```

## providers.json

You can also configure providers in `~/.claude/providers.json`:

```json
{
  "activeProvider": "custom",
  "providers": {
    "openai": {
      "type": "openai-compatible",
      "baseURL": "https://api.openai.com/v1",
      "apiKeyEnv": "OPENAI_API_KEY",
      "model": "gpt-4.1"
    },
    "deepseek": {
      "type": "openai-compatible",
      "baseURL": "https://api.deepseek.com",
      "apiKeyEnv": "DEEPSEEK_API_KEY",
      "model": "deepseek-chat"
    },
    "zhipu": {
      "type": "openai-compatible",
      "baseURL": "https://open.bigmodel.cn/api/paas/v4/",
      "apiKeyEnv": "ZAI_API_KEY",
      "model": "glm-4.5"
    },
    "custom": {
      "type": "openai-compatible",
      "baseURL": "http://localhost:8000/v1",
      "apiKeyEnv": "LOCAL_LLM_API_KEY",
      "model": "qwen3-coder",
      "headers": {},
      "extraBody": {}
    }
  }
}
```

Only environment variable names are saved. Do not put plaintext API keys in this file.

## Notes

- OpenAI, DeepSeek, Zhipu / GLM, and custom endpoints use the OpenAI-compatible `/chat/completions` API.
- Tool calling support depends on the selected model and endpoint.
- `reasoning_content` is parsed when present.
- Claude-native features such as prompt caching, adaptive thinking, or 1M context betas remain Anthropic-provider-specific.
