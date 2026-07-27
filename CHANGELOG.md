# Changelog

## [1.0.0] - 2026-07-28

### Added

- Quality Tier System — Models categorized into BEST, GREAT, GOOD, BASIC tiers
- Capability-Based Fallback — Descending order by tier → context window → parameters → health score
- Proactive Health Monitoring — Real-time health scoring (success rate, latency, error rate, freshness)
- Auto-Discovery — Scan configured providers for free and paid models with capabilities
- Intelligent Routing — Proactive switching before users encounter failures
- Self-Healing Configuration — Auto-update fallback chain based on performance
- Persistent State — Health scores survive OpenCode restarts (`.opencode/auto-router-state.json`)
- Silent Mode — Users never see failover notifications
- Multi-Provider Support — Anthropic (Zen), Groq, DeepSeek, Google Gemini, OpenRouter
- Model Capability Metadata — Context window, parameters, vision/tool/streaming support
- Built-in Tools — `/autoRouter` health dashboard, `/routerStatus`
- Comprehensive Documentation — Full README, CONTRIBUTING guide, VERSION file
- Cross-Platform Support — Works on Windows, Linux, and macOS
- Open Source — MIT License, free for everyone

### Changed

- Rewrote routing engine from static fallback chain to intelligent tier-based selection
- Added `ModelCapability` and `QualityTier` types
- Enhanced `ModelEntry` with optional `capability` field
- Updated auto-discovery to populate model capabilities