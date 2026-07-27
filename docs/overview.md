# Auto Router Plugin for OpenCode

A silent auto-failover plugin that automatically routes LLM requests to alternative models when free model limits are reached or errors occur.

## Overview

`opencode-auto-router` is an OpenCode plugin that monitors LLM requests and automatically fails over to backup models when the current model encounters rate limits, quota errors, or other failures. The failover is silent — users do not see error messages or model switches, they simply receive their AI response as expected.

## How It Works

```
User Request
    |
    v
Primary Model (e.g., Claude Haiku Free)
    |
    +-- Success --> User gets response
    |
    +-- Error (rate limit, quota, etc.)
            |
            v
    Plugin detects error automatically
            |
            v
    Selects next model in fallback chain
            |
            v
    Retry silently with fallback model
            |
            v
    User gets response (no error shown)
```

## Installation

### npm

```bash
npm install opencode-auto-router
```

### Manual

1. Clone this repository
2. Run `npm install && npm run build`
3. Add the built plugin to your OpenCode config

## Configuration

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-auto-router"],
  "autoRouter": {
    "fallbackChain": [
      { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
      { "provider": "openai", "model": "gpt-4o-mini" },
      { "provider": "groq", "model": "llama-3.3-70b-versatile" }
    ],
    "maxRetriesPerSession": 3,
    "cooldownMs": 5000,
    "silenceMode": true,
    "trackUsage": true
  }
}
```

## Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `fallbackChain` | Array | Built-in chain | Ordered list of {provider, model} entries |
| `maxRetriesPerSession` | Number | 3 | Max retries before showing error |
| `cooldownMs` | Number | 5000 | Delay between retries (ms) |
| `silenceMode` | Boolean | true | Suppress failover notifications |
| `trackUsage` | Boolean | true | Track per-model usage statistics |

## Supported Free Models

The plugin works with any OpenCode model. Recommended free-tier models:

| Provider | Free Model | Notes |
|---|---|---|
| Anthropic (Zen) | claude-sonnet-4 | Via OpenCode Zen free tier |
| Groq | llama-3.3-70b-versatile | Free tier API key |
| DeepSeek | deepseek-v3 | Free API key |
| OpenAI | gpt-4o-mini | Limited free tier |
| OpenRouter | openai/gpt-4o-mini | Pay-per-use, very cheap |

## Error Detection

The plugin automatically detects and handles these error types:

| Error Type | Example Triggers | Action |
|---|---|---|
| Rate Limit | 429, throttled, too many requests | Failover to next model |
| Quota Exceeded | quota exceeded, free tier limit, 403 | Failover to next model |
| Context Exceeded | context window, prompt too long | Failover to next model |
| Model Unavailable | 503, service unavailable, model down | Failover to next model |
| Overloaded | server overloaded, capacity exceeded | Failover to next model |
| Other Errors | Unrecognized errors | Surface to user (no retry) |

## API Reference

### Plugin Export

```typescript
import { AutoRouter } from 'opencode-auto-router';

// Use in opencode.json:
// { "plugin": ["opencode-auto-router"] }
```

### Types

```typescript
interface FallbackEntry {
  provider: string;
  model: string;
  label?: string;
}

interface RouterConfig {
  fallbackChain: FallbackEntry[];
  maxRetriesPerSession: number;
  cooldownMs: number;
  silenceMode: boolean;
  trackUsage: boolean;
}
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

# Test
npm test
```

## License

MIT