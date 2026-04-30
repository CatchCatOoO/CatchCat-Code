# CatchCat Code

> This project is based on a modified version of the open-source Claude Code, and we kindly ask for your understanding if you don't like it. It is a terminal AI Agent tailored for CTF, target practice, and authorized security research scenarios. The project is built upon the ideas of the open-source community version of Claude Code, supporting DeepSeek, GLM/ZhiPu, OpenAI, and custom OpenAI-compatible interfaces. This project is modified from: https://github.com/claude-code-best/claude-code

## Overview

CatchCat Code is an AI coding and CTF assistant that runs in your terminal. It can inspect local project files, search code, analyze challenge artifacts, help write scripts, organize reasoning, and connect to different model providers through a switchable provider layer.

It is designed for:

- CTF challenge analysis, lab practice, vulnerability reproduction, and write-up drafting.
- Local code review, scripting, and debugging assistance.
- Multi-provider model access: DeepSeek, OpenAI, GLM / Zhipu, and custom OpenAI-compatible endpoints.
- Authorized CTF / lab workflows where some restrictions have been adjusted to better support challenge-solving tasks.

> This is not an official Anthropic / Claude Code project and is not affiliated with the official Claude Code product. Make sure you comply with the licenses of any upstream projects and dependencies you use.

## Legal and Responsible Use

Use this tool only in environments where you have explicit authorization, such as:

- CTF competitions.
- Local labs, Docker labs, and virtual-machine ranges.
- Systems you own or are authorized to test.
- Course labs, internal security exercises, and vulnerability reproduction environments.

Do not use this tool for unauthorized activity, including but not limited to:

- Unauthorized access, scanning, exploitation, or intrusion against real third-party systems.
- Stealing accounts, cookies, tokens, API keys, private data, or business data.
- Deploying backdoors, persistence, malware, ransomware, DDoS tooling, or destructive actions.
- Bypassing access control, risk-control systems, or security boundaries that you are not allowed to test.

Any CTF-oriented relaxation in this project is meant for legal challenge and lab environments only. It does not grant permission for illegal, harmful, or unauthorized use. Users are responsible for their own legal and compliance obligations.

## Requirements

Recommended environment:

- Bun `>= 1.2.0`
- Git
- Windows PowerShell 7+, Windows Terminal, macOS Terminal, or a Linux shell
- Optional CTF utilities: `ripgrep`, `python3`, `node`, `go`, `rust`, `docker`, `file`, `strings`, `binwalk`, `gdb`, and similar tools

This project uses Bun as its runtime and build tool. Do not run the TypeScript entrypoint directly with plain Node.js.

## Installation and Usage

```bash
git clone <your-repo-url>
cd CatchCat-code
bun install
```

Run in development mode:

```bash
bun run dev
```

Build:

```bash
bun run build
```

The default build output is:

```text
dist/cli.js
```

If you keep the default `bin` field in `package.json`, the command may be:

```bash
claude-js
```

If you have renamed or aliased the command to `claude`, you can run:

```bash
claude
```

You can also run the development entrypoint directly from the project directory:

```bash
bun run src/entrypoints/cli.tsx
```

Pipe mode example:

```bash
echo "hello" | bun run src/entrypoints/cli.tsx -p
```

## Common Scripts

| Command | Description |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Run the CLI entrypoint with Bun |
| `bun run build` | Build `dist/cli.js` |
| `bun test` | Run tests |
| `bun run lint` | Run Biome lint |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run format` | Format source files |
| `bun run health` | Run the project health check |
| `bun run docs:dev` | Start the documentation development server |

## Model Providers

The `/model` menu supports the following entries:

1. Sonnet (1M context)
2. Opus
3. Opus (1M context)
4. Haiku
5. openai
6. deepseek
7. zhipu / glm
8. custom

Non-Anthropic providers use an OpenAI-compatible `/chat/completions` style API. Tool calling, streaming, and reasoning-content support depend on the selected model and endpoint.

### Common Provider Environment Variables

| Variable | Description |
| --- | --- |
| `CLAUDE_CODE_PROVIDER` | Active provider. Supported values include `openai`, `deepseek`, `zhipu`, `glm`, and `custom` |
| `CLAUDE_CODE_MODEL` | Active model name |
| `CLAUDE_CODE_BASE_URL` | Base URL for the custom provider |
| `CLAUDE_CODE_API_KEY_ENV` | Name of the environment variable that stores the API key for the custom provider |
| `CLAUDE_CODE_PROVIDERS_CONFIG` | Custom path for `providers.json` |
| `CLAUDE_CODE_EXTRA_BODY_JSON` | JSON string to merge into the request body |

> Do not commit real API keys to the repository, screenshots, issues, or `providers.json`. Use environment variables for secrets.

## DeepSeek Setup

### Temporary setup: current PowerShell only

Run this in the current PowerShell session:

```powershell
$env:DEEPSEEK_API_KEY="your DeepSeek API Key"
$env:CLAUDE_CODE_PROVIDER="deepseek"
$env:CLAUDE_CODE_MODEL="deepseek-chat"
```

Then restart Claude Code, or type this in the interactive UI:

```text
/model
```

Select:

```text
deepseek
```

You can also try:

```text
/model deepseek
```

### Persistent setup: recommended

Run in PowerShell:

```powershell
[Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", "your DeepSeek API Key", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_PROVIDER", "deepseek", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_MODEL", "deepseek-chat", "User")
```

Close the current terminal, open a new one, and start Claude Code again.

## OpenAI Setup

### Temporary setup: current PowerShell only

```powershell
$env:OPENAI_API_KEY="your OpenAI API Key"
$env:CLAUDE_CODE_PROVIDER="openai"
$env:CLAUDE_CODE_MODEL="gpt-4.1"
```

Start Claude Code:

```powershell
claude
```

In the interactive UI, type:

```text
/model
```

Select:

```text
openai
```

Or directly run:

```text
/model openai
```

### Persistent setup: recommended

```powershell
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "your OpenAI API Key", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_PROVIDER", "openai", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_MODEL", "gpt-4.1", "User")
```

Close the current terminal and open a new PowerShell session.

## GLM / Zhipu Setup

The project supports `zhipu` and also accepts `glm` as an alias. It is compatible with Zhipu's OpenAI-compatible API.

### Temporary setup: current PowerShell only

```powershell
$env:ZAI_API_KEY="your Zhipu API Key"
$env:CLAUDE_CODE_PROVIDER="zhipu"
$env:CLAUDE_CODE_MODEL="glm-4.5"
```

If you use the older variable name, you can also try:

```powershell
$env:ZHIPUAI_API_KEY="your Zhipu API Key"
$env:CLAUDE_CODE_PROVIDER="glm"
$env:CLAUDE_CODE_MODEL="glm-4.5"
```

After startup, type:

```text
/model glm
```

or:

```text
/model zhipu
```

### Persistent setup: recommended

```powershell
[Environment]::SetEnvironmentVariable("ZAI_API_KEY", "your Zhipu API Key", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_PROVIDER", "zhipu", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_MODEL", "glm-4.5", "User")
```

Close the current terminal and open a new PowerShell session.

## Custom OpenAI-compatible Setup

Use the `custom` provider if your endpoint is compatible with OpenAI `/chat/completions`. The example below uses Zhipu's OpenAI-compatible endpoint.

### Temporary setup: current PowerShell only

```powershell
$env:CLAUDE_CODE_PROVIDER="custom"
$env:CLAUDE_CODE_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
$env:CLAUDE_CODE_MODEL="the model name that works in Cherry Studio"
$env:CLAUDE_CODE_API_KEY_ENV="ZHIPU_CUSTOM_API_KEY"
$env:ZHIPU_CUSTOM_API_KEY="your real API Key"
```

The key lines are:

```powershell
$env:CLAUDE_CODE_API_KEY_ENV="ZHIPU_CUSTOM_API_KEY"
$env:ZHIPU_CUSTOM_API_KEY="your real API Key"
```

The first line tells the program which environment variable contains the real key. The second line stores the real key.

After starting Claude Code, type:

```text
/model custom
```

### Persistent setup: recommended

```powershell
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_PROVIDER", "custom", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_BASE_URL", "https://open.bigmodel.cn/api/paas/v4", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_MODEL", "the model name that works in Cherry Studio", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_API_KEY_ENV", "ZHIPU_CUSTOM_API_KEY", "User")
[Environment]::SetEnvironmentVariable("ZHIPU_CUSTOM_API_KEY", "your real API Key", "User")
```

Close the current terminal and open a new PowerShell session.

## Using `providers.json`

You can also configure providers with:

```text
~/.claude/providers.json
```

Example:

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

Only store environment variable names in the config file. Do not store plaintext API keys there.



## 使用截图

![img](https://cdn.jsdelivr.net/gh/CatchCatOoO/blogs-images@master/Gemini3.1pro%E6%8E%A5%E5%85%A5.png)

![img](https://cdn.jsdelivr.net/gh/CatchCatOoO/blogs-images@master/deepseekv4pro%E6%8E%A5%E5%85%A5.png)

![img](https://cdn.jsdelivr.net/gh/CatchCatOoO/blogs-images@master/%E5%85%8D%E6%9D%80.png)

## Recommended CTF Workflow

Enter a challenge directory:

```bash
cd ./challenge
claude
```

Start with read-only analysis:

```text
Analyze the current directory structure, challenge type, and likely solving paths first. Do not run destructive commands and do not attack real targets.
```

Common tasks:

- Inspect challenge files, README files, Dockerfiles, source code, and attachments.
- Identify challenge category: Web, Pwn, Reverse, Crypto, Forensics, or Misc.
- Generate local solve scripts or validation scripts.
- Analyze logs, binary metadata, protocol flows, and cryptographic logic.
- Draft solution notes and final write-ups.

Run untrusted challenge files in Docker, a virtual machine, or a temporary directory. Avoid running them directly on your main machine, production environment, or directories containing sensitive data.

## Troubleshooting

### Provider does not appear in `/model`

Check your environment variables:

```powershell
echo $env:CLAUDE_CODE_PROVIDER
echo $env:CLAUDE_CODE_MODEL
```

Persistent environment variables only take effect in newly opened terminals.

### Missing API key error

Check whether the real key variable exists:

```powershell
echo $env:OPENAI_API_KEY
echo $env:DEEPSEEK_API_KEY
echo $env:ZAI_API_KEY
echo $env:ZHIPU_CUSTOM_API_KEY
```

For the `custom` provider, also check:

```powershell
echo $env:CLAUDE_CODE_API_KEY_ENV
```

`CLAUDE_CODE_API_KEY_ENV` should contain the variable name, not the real key.

### Custom Base URL does not work

Make sure the Base URL points to the provider's OpenAI-compatible root path. The program appends `/chat/completions` automatically, so you usually do not need to include it manually.

Example:

```text
https://open.bigmodel.cn/api/paas/v4
```

### `claude` command not found

If the `claude` command is not configured, use:

```bash
bun run dev
```

or:

```bash
bun run src/entrypoints/cli.tsx
```

If you use the default built `bin`, the command may be:

```bash
claude-js
```

## Security Tips

- Never commit API keys to Git.
- Do not run the agent directly in directories containing production secrets, private data, or sensitive configs.
- Use Docker, a VM, or a sandbox before running untrusted artifacts.
- Review shell commands carefully, especially deletion, overwrite, network access, or privilege-escalation commands.
- Clean up temporary tokens, logs, samples, and generated output after finishing a challenge.

## License

Add an appropriate `LICENSE` file based on your upstream project, your modifications, and your dependencies. This README is not legal advice. Before publishing, make sure you have the right to distribute the relevant code and assets.
