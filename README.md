# opencode-auto-router

Advanced silent auto LLM routing plugin for OpenCode. Intelligently fails over to alternative models when free model limits are reached, errors occur, or models degrade — without user intervention.

## Features

### Advanced Capabilities

- **Proactive Health Monitoring** — Continuously tracks model health scores based on success rate, response time, error rate, and recent performance
- **Quality Tier System** — Models categorized into BEST, GREAT, GOOD, BASIC tiers so large projects automatically get the most capable model available
- **Capability-Based Fallback** — When a model is unavailable, fallback follows descending order by quality tier → context window size → parameter count → health score
- **Auto-Discovery** — Automatically scans configured providers to identify free-tier and paid models
- **Intelligent Routing** — AI-powered decision engine that proactively switches models before users encounter failures
- **Self-Healing Configuration** — Automatically updates fallback chain based on observed model performance
- **Persistent State** — Health scores and model history survive OpenCode restarts (saved to `.opencode/auto-router-state.json`)
- **Silent Failover** — Users never see error messages or model switches
- **Multi-Provider Support** — Works with 75+ OpenCode providers through Models.dev

### How It Works

The plugin operates on three levels:

1. **Reactive** — When a model returns an error (rate limit, quota, etc.), it detects the error and retries with the next healthy model
2. **Proactive** — Before a request reaches a degraded model, it proactively switches to a healthier alternative
3. **Predictive** — Tracks model trends over time and predicts which models are likely to fail next

### Quality Tier System

Every model is assigned a quality tier that determines fallback priority:

| Tier | Description | Examples |
|---|---|---|
| **BEST** | Top-tier reasoning, largest context windows | Claude Sonnet 4, Gemini 2.5 Pro |
| **GREAT** | Strong performance, good context windows | Claude Haiku, Gemini 2.5 Flash |
| **GOOD** | Solid models for most tasks | Llama 3.3 70B, DeepSeek V3 |
| **BASIC** | Smaller/faster models for simple tasks | Gemma, Qwen Coder |

### Capability-Based Fallback Order

When a model fails or degrades, the router falls back in this descending order:

1. **Quality Tier** — BEST before GREAT before GOOD before BASIC
2. **Context Window** — Larger context preferred for large projects (200K tokens > 128K > 32K)
3. **Parameter Count** — More capable models preferred when context is equal
4. **Health Score** — Among same-tier models, healthiest wins

This means: if Claude Sonnet 4 (BEST, 200K context) is rate-limited, it falls back to Gemini 2.5 Pro (BEST, 1M context) before falling back to Claude Haiku (GREAT, 200K context).

### Health Scoring System

Each model gets a health score (0–100) based on:

| Factor | Weight | Description |
|---|---|---|
| Success Rate | 35% | Ratio of successful responses to total requests |
| Response Time | 20% | Average response latency |
| Error Rate | 20% | Ratio of errors to total requests |
| Consecutive Errors | 10% | Penalty for repeated failures |
| Freshness | 10% | How recently the model was successful |
| Cooldown Penalty | 5% | Penalty if model is in cooldown |

- **Healthy**: Score ≥ 70
- **Degraded**: Score 40–69
- **Unhealthy**: Score < 40

## Configuration

```json
{
  "plugin": ["opencode-auto-router"],
  "autoRouter": {
    "fallbackChain": [
      { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4", "isFree": true },
      { "provider": "anthropic", "model": "claude-3-5-haiku-20241022", "label": "Claude Haiku", "isFree": true },
      { "provider": "groq", "model": "llama-3.3-70b-versatile", "label": "Llama 3.3 70B (Free)", "isFree": true },
      { "provider": "deepseek", "model": "deepseek-v3", "label": "DeepSeek V3 (Free)", "isFree": true },
      { "provider": "google", "model": "gemini-2.5-flash", "label": "Gemini 2.5 Flash (Free)", "isFree": true },
      { "provider": "google", "model": "gemini-2.5-pro", "label": "Gemini 2.5 Pro (Free)", "isFree": true },
      { "provider": "openai", "model": "gpt-4o-mini", "label": "GPT-4o Mini", "isFree": false },
      { "provider": "openrouter", "model": "openai/gpt-4o-mini", "label": "GPT-4o Mini via OpenRouter", "isFree": false }
    ],
    "maxRetriesPerSession": 3,
    "cooldownMs": 5000,
    "silenceMode": true,
    "trackUsage": true,
    "healthCheckIntervalMs": 30000,
    "autoHeal": true,
    "minHealthScore": 50
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `fallbackChain` | Array | Built-in | Ordered list of models with health tracking |
| `maxRetriesPerSession` | Number | 3 | Max retries before showing error |
| `cooldownMs` | Number | 5000 | Delay between retries (ms) |
| `silenceMode` | Boolean | true | Suppress user notifications during failover |
| `trackUsage` | Boolean | true | Track per-model usage statistics |
| `healthCheckIntervalMs` | Number | 30000 | Health check interval (ms) |
| `autoHeal` | Boolean | true | Auto-update fallback chain based on performance |
| `minHealthScore` | Number | 50 | Minimum health score for proactive switching |

## Built-in Free Model Detection

The plugin automatically recognizes free-tier models for these providers:

| Provider | Free Models | Quality Tier | Context Window |
|---|---|---|---|
| Anthropic (Zen) | Claude Sonnet 4, Claude Haiku | BEST / GREAT | 200K tokens |
| Groq | Llama 3.3 70B, Mixtral | GOOD | 128K tokens |
| DeepSeek | DeepSeek V3, DeepSeek Chat | GOOD | 128K tokens |
| Google | Gemini 2.5 Flash, Gemini 2.5 Pro, Gemma | GREAT / BEST | 1M tokens |
| OpenRouter | Various | Varies | Varies |

## Built-in Tools

### `/autoRouter` — Health Report
Check health scores for all tracked models:
```
!autoRouter
```
Output:
```
# Auto Router Health Report

- `anthropic/claude-sonnet-4-20250514`: tier=BEST health=85%
- `google/gemini-2.5-pro`: tier=BEST health=91%
- `groq/llama-3.3-70b-versatile`: tier=GOOD health=92%
```

### `/routerStatus` — Router Status
Check routing configuration and free model suggestions:
```
!routerStatus
```

## Architecture

```
src/
├── index.ts                   # Main plugin entry point with OpenCode hooks
├── types.ts                   # Types: QualityTier, ModelCapability, ModelEntry, etc.
├── health/
│   └── scorer.ts              # Health scoring engine, ranking, and decisions
├── discovery/
│   └── auto-discover.ts       # Auto-discovery with capability populating
├── router/
│   └── intelligent-router.ts  # Tier-based routing with capability fallback
└── state/
    └── store.ts               # Persistent state storage and serialization
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run build

# Lint
npm run lint
```

## Requirements

- Node.js >= 20.0.0
- OpenCode >= 1.0.0

## License

MIT