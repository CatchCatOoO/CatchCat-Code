# CatchCat Code

> 本项目基于Claude Code意外开源版魔改而来，不喜勿喷，面向 CTF、靶场与授权安全研究场景的终端 AI Agent。项目基于 Claude Code 开源社区版思路改造，支持 DeepSeek、GLM / 智谱、OpenAI 与自定义 OpenAI-compatible 接口。本项目魔改自：https://github.com/claude-code-best/claude-code

## 项目简介

CatchCat Code 是一个运行在终端中的 AI 编程与 CTF 辅助 Agent。它可以在本地项目目录中读取文件、搜索代码、分析题目线索、辅助编写脚本、整理思路，并通过可切换的模型 Provider 连接不同的大模型服务。

本项目重点面向以下场景：

- CTF 题目分析、靶场练习、漏洞复现与 Write-up 整理。
- 本地代码审计、脚本编写、调试辅助。
- 多模型 API 接入：DeepSeek、OpenAI、GLM / 智谱，以及任意 OpenAI-compatible 自定义接口。
- 在合法授权范围内，对 CTF / 靶场任务的限制做了更适合比赛场景的调整，便于完成题目分析与自动化辅助。

> 本项目不是 Anthropic / Claude Code 官方项目，与官方 Claude Code 无直接从属关系。请遵守你所使用上游项目与依赖项的许可证要求。

## 合法与负责任使用声明

本工具只能用于你拥有明确授权的环境，例如：

- CTF 比赛题目。
- 本地靶场、Docker 靶场、虚拟机实验环境。
- 你本人拥有或被授权测试的系统。
- 课程实验、公司内部授权安全测试、漏洞复现环境。

禁止将本工具用于任何未授权活动，包括但不限于：

- 未授权访问、扫描、入侵、利用真实第三方系统。
- 窃取账号、Cookie、Token、密钥、隐私数据或商业数据。
- 部署后门、持久化控制、恶意软件、勒索、DDoS 或破坏性操作。
- 绕过你无权绕过的访问控制、风控系统或安全边界。

项目针对 CTF / 靶场做出的限制调整，不代表允许违法、侵权或破坏性使用。使用者需要自行承担使用本工具带来的法律与合规责任。

## 环境要求

推荐环境：

- Bun `>= 1.2.0`
- Git
- Windows PowerShell 7+、Windows Terminal、macOS Terminal 或 Linux shell
- 可选工具：`ripgrep`、`python3`、`node`、`go`、`rust`、`docker`、`file`、`strings`、`binwalk`、`gdb` 等 CTF 常用工具

本项目使用 Bun 作为运行时和构建工具。不要用普通 Node.js 直接运行入口文件。

## 安装与运行

```bash
git clone <your-repo-url>
cd CatchCat-code
bun install
```

开发模式运行：

```bash
bun run dev
```

构建：

```bash
bun run build
```

构建产物默认输出到：

```text
dist/cli.js
```

如果你保留了 `package.json` 中的默认 `bin` 配置，命令名可能是：

```bash
claude-js
```

如果你已经将命令别名或包名改成 `claude`，则可以直接运行：

```bash
claude
```

也可以在项目目录中直接使用开发入口：

```bash
bun run src/entrypoints/cli.tsx
```

管道模式示例：

```bash
echo "hello" | bun run src/entrypoints/cli.tsx -p
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `bun install` | 安装依赖 |
| `bun run dev` | 以 Bun 直接运行 CLI 入口 |
| `bun run build` | 构建 `dist/cli.js` |
| `bun test` | 运行测试 |
| `bun run lint` | 运行 Biome lint |
| `bun run lint:fix` | 自动修复 lint 问题 |
| `bun run format` | 格式化源码 |
| `bun run health` | 运行项目健康检查 |
| `bun run docs:dev` | 启动文档开发服务 |

## 模型 Provider 说明

`/model` 菜单支持以下 Provider / 模型入口：

1. Sonnet (1M context)
2. Opus
3. Opus (1M context)
4. Haiku
5. openai
6. deepseek
7. zhipu / glm
8. custom

非 Anthropic Provider 使用 OpenAI-compatible `/chat/completions` 风格接口。不同模型的工具调用、流式输出、推理内容字段支持情况取决于具体服务商。

### Provider 通用环境变量

| 变量 | 说明 |
| --- | --- |
| `CLAUDE_CODE_PROVIDER` | 当前 Provider，可选 `openai`、`deepseek`、`zhipu`、`glm`、`custom` |
| `CLAUDE_CODE_MODEL` | 当前模型名 |
| `CLAUDE_CODE_BASE_URL` | 自定义 Provider 的 Base URL |
| `CLAUDE_CODE_API_KEY_ENV` | 自定义 Provider 使用的 API Key 环境变量名 |
| `CLAUDE_CODE_PROVIDERS_CONFIG` | 自定义 `providers.json` 路径 |
| `CLAUDE_CODE_EXTRA_BODY_JSON` | 需要追加到请求体的 JSON 字符串 |

> 不要把真实 API Key 写进仓库、截图、Issue 或 `providers.json`。推荐使用环境变量保存密钥。

## DeepSeek 接入

### 临时设置：只对当前 PowerShell 有效

在当前 PowerShell 中执行：

```powershell
$env:DEEPSEEK_API_KEY="你的DeepSeek API Key"
$env:CLAUDE_CODE_PROVIDER="deepseek"
$env:CLAUDE_CODE_MODEL="deepseek-chat"
```

然后重新运行 Claude Code，或在交互界面中输入：

```text
/model
```

选择：

```text
deepseek
```

也可以直接尝试：

```text
/model deepseek
```

### 永久设置：推荐

PowerShell 执行：

```powershell
[Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", "你的DeepSeek API Key", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_PROVIDER", "deepseek", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_MODEL", "deepseek-chat", "User")
```

然后关闭当前终端，重新打开一个新终端，再启动 Claude Code。

## OpenAI 接入

### 临时设置：只对当前 PowerShell 有效

```powershell
$env:OPENAI_API_KEY="你的 OpenAI API Key"
$env:CLAUDE_CODE_PROVIDER="openai"
$env:CLAUDE_CODE_MODEL="gpt-4.1"
```

然后启动 Claude Code：

```powershell
claude
```

进入后输入：

```text
/model
```

选择：

```text
openai
```

或者直接：

```text
/model openai
```

### 永久设置：推荐

```powershell
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "你的 OpenAI API Key", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_PROVIDER", "openai", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_MODEL", "gpt-4.1", "User")
```

然后关闭当前终端，重新打开 PowerShell。

## GLM / 智谱接入

项目支持 `zhipu`，并接受 `glm` 作为别名。默认兼容智谱 OpenAI-compatible 接口。

### 临时设置：只对当前 PowerShell 有效

```powershell
$env:ZAI_API_KEY="你的智谱 API Key"
$env:CLAUDE_CODE_PROVIDER="zhipu"
$env:CLAUDE_CODE_MODEL="glm-4.5"
```

如果你使用的是旧变量名，也可以尝试：

```powershell
$env:ZHIPUAI_API_KEY="你的智谱 API Key"
$env:CLAUDE_CODE_PROVIDER="glm"
$env:CLAUDE_CODE_MODEL="glm-4.5"
```

启动后可输入：

```text
/model glm
```

或：

```text
/model zhipu
```

### 永久设置：推荐

```powershell
[Environment]::SetEnvironmentVariable("ZAI_API_KEY", "你的智谱 API Key", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_PROVIDER", "zhipu", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_MODEL", "glm-4.5", "User")
```

然后关闭当前终端，重新打开 PowerShell。

## Custom OpenAI-compatible 接入

如果你的接口兼容 OpenAI `/chat/completions`，可以使用 `custom` Provider。下面以智谱 / Zhipu 的 OpenAI-compatible 接口为例。

### 临时设置：只对当前 PowerShell 有效

```powershell
$env:CLAUDE_CODE_PROVIDER="custom"
$env:CLAUDE_CODE_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
$env:CLAUDE_CODE_MODEL="你在 Cherry Studio 里能用的模型名"
$env:CLAUDE_CODE_API_KEY_ENV="ZHIPU_CUSTOM_API_KEY"
$env:ZHIPU_CUSTOM_API_KEY="你的真实 API Key"
```

重点是这两行：

```powershell
$env:CLAUDE_CODE_API_KEY_ENV="ZHIPU_CUSTOM_API_KEY"
$env:ZHIPU_CUSTOM_API_KEY="你的真实 API Key"
```

第一行指定“真实 Key 存在哪个环境变量里”，第二行才是真实 Key。

启动 Claude Code 后输入：

```text
/model custom
```

### 永久设置：推荐

```powershell
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_PROVIDER", "custom", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_BASE_URL", "https://open.bigmodel.cn/api/paas/v4", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_MODEL", "你在 Cherry Studio 里能用的模型名", "User")
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_API_KEY_ENV", "ZHIPU_CUSTOM_API_KEY", "User")
[Environment]::SetEnvironmentVariable("ZHIPU_CUSTOM_API_KEY", "你的真实 API Key", "User")
```

关闭当前终端，重新打开 PowerShell 后生效。

## 使用 `providers.json` 配置 Provider

除了环境变量，也可以使用配置文件：

```text
~/.claude/providers.json
```

示例：

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

配置文件中只保存环境变量名，不要保存明文 API Key。

## 使用截图

![img](https://cdn.jsdelivr.net/gh/CatchCatOoO/blogs-images@master/Gemini3.1pro%E6%8E%A5%E5%85%A5.png)

![img](https://cdn.jsdelivr.net/gh/CatchCatOoO/blogs-images@master/deepseekv4pro%E6%8E%A5%E5%85%A5.png)

![img](https://cdn.jsdelivr.net/gh/CatchCatOoO/blogs-images@master/%E5%85%8D%E6%9D%80.png)

## CTF 推荐工作流

进入题目目录：

```bash
cd ./challenge
claude
```

建议先让 Agent 做只读分析：

```text
先分析当前目录的文件结构、题目类型和可能方向。不要执行破坏性命令，不要联网攻击真实目标。
```

常见任务：

- 查看题目文件、README、Dockerfile、源码和附件。
- 判断题型：Web、Pwn、Reverse、Crypto、Forensics、Misc。
- 生成本地解题脚本或验证脚本。
- 分析报错日志、二进制信息、协议交互或加密流程。
- 整理解题步骤和 Write-up。

建议在 Docker、虚拟机或临时目录中运行不可信题目文件，不要在主力系统、生产环境或包含敏感数据的目录中直接运行。

## 故障排查

### `/model` 看不到 Provider

确认环境变量已经设置：

```powershell
echo $env:CLAUDE_CODE_PROVIDER
echo $env:CLAUDE_CODE_MODEL
```

永久环境变量设置后，需要关闭当前终端并重新打开。

### 提示缺少 API Key

检查真实 Key 所在变量是否存在：

```powershell
echo $env:OPENAI_API_KEY
echo $env:DEEPSEEK_API_KEY
echo $env:ZAI_API_KEY
echo $env:ZHIPU_CUSTOM_API_KEY
```

如果是 `custom` Provider，还要检查：

```powershell
echo $env:CLAUDE_CODE_API_KEY_ENV
```

`CLAUDE_CODE_API_KEY_ENV` 的值应该是变量名，而不是真实 Key。

### Custom Base URL 不工作

确认 Base URL 是服务商的 OpenAI-compatible 根路径。程序会自动拼接 `/chat/completions`，通常不需要手动写到最后。

例如：

```text
https://open.bigmodel.cn/api/paas/v4
```

### 命令 `claude` 不存在

如果没有配置 `claude` 命令，可以先使用：

```bash
bun run dev
```

或：

```bash
bun run src/entrypoints/cli.tsx
```

如果构建后使用默认 `bin`，命令可能是：

```bash
claude-js
```

## 安全建议

- 不要把 API Key 提交到 Git。
- 不要在包含真实业务密钥、隐私数据、生产配置的目录中直接运行 Agent。
- 运行不可信附件前，优先使用 Docker、虚拟机或沙箱。
- 对 Shell 命令保持审查，尤其是删除、覆盖、网络访问、权限提升类命令。
- CTF 题目结束后，及时清理临时 Token、日志、样本和输出文件。

## 许可证

请根据你的上游项目、修改内容和依赖项补充合适的 `LICENSE` 文件。本 README 不构成法律意见。发布前请确认你有权分发相关代码与资源。
