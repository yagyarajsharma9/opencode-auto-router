# opencode-auto-router — Agent Reference

## Project Overview

An OpenCode plugin that silently auto-routes LLM requests to fallback models when the current model hits rate limits, quota errors, or other failures. Uses quality tiers and capability-based fallback ordering.

## Key Files

- `src/index.ts` — Main plugin entry point with OpenCode hooks
- `src/types.ts` — All TypeScript type definitions including `QualityTier`, `ModelCapability`, `ModelEntry`
- `src/health/scorer.ts` — Health scoring engine, ranking, and routing decisions
- `src/discovery/auto-discover.ts` — Auto-discovery of free models with capability population
- `src/router/intelligent-router.ts` — Tier-based routing with capability fallback (quality → context → parameters → health)
- `src/state/store.ts` — Persistent state storage and serialization

## Architecture

The plugin uses OpenCode's plugin hook system:
- `session.error` — Detects failures and triggers failover logic
- `chat.params` — Tracks model usage per session
- `session.status` — Resets cooldown when session becomes idle
- `session.created` / `session.compacted` / `session.deleted` — Session lifecycle cleanup

## Quality Tier System

Models are categorized into 4 tiers for fallback ordering:
- `QualityTier.BEST` (weight 1000) — Top-tier models for large projects
- `QualityTier.GREAT` (weight 800) — Strong models, good context windows
- `QualityTier.GOOD` (weight 600) — Solid models for most tasks
- `QualityTier.BASIC` (weight 400) — Smaller/faster models

## Capability-Based Fallback Order

1. Quality Tier (BEST → GREAT → GOOD → BASIC)
2. Context Window (larger preferred)
3. Parameter Count (more capable preferred)
4. Health Score (highest wins within same tier)

## State Management

All session state is stored in a closure-based `Map<string, SessionRouterState>` inside the plugin function. Each session has its own fallback index and error tracking. Persistent state saved to `.opencode/auto-router-state.json`.

## Configuration

Set via `autoRouter` key in `opencode.json`:
- `fallbackChain` — Ordered list of models with optional `capability` field
- `maxRetriesPerSession` — Max retries before giving up (default 3)
- `cooldownMs` — Wait time between retries (default 5000)
- `silenceMode` — Suppress user notifications during failover (default true)
- `trackUsage` — Enable per-model usage tracking (default true)
- `healthCheckIntervalMs` — Health check interval in ms (default 30000)