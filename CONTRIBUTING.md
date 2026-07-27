# Contributing to opencode-auto-router

Thank you for your interest in contributing! This plugin is free and open source, and we welcome everyone to help make it better.

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Git

### Setup

```bash
git clone https://github.com/yagyarajsharma9/opencode-auto-router.git
cd opencode-auto-router
npm install
```

### Verify Your Setup

```bash
npm run typecheck   # Ensure no TypeScript errors
npm run build       # Verify compilation
```

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/yagyarajsharma9/opencode-auto-router/issues)
2. If not, create a new issue with:
   - Clear title describing the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your OS, Node.js version, and OpenCode version
   - Any relevant logs or configuration

### Requesting Features

- Open a GitHub issue with a clear description of the feature
- Explain why it would be useful
- Include any relevant mockups or examples

### Submitting Code Changes

1. **Fork** the repository
2. **Create a branch** for your change: `git checkout -b feature/your-feature-name`
3. **Make your changes** with clear, focused commits
4. **Add tests** if your change adds new functionality
5. **Update documentation** if needed
6. **Run checks** before committing:
   ```bash
   npm run typecheck
   npm run build
   ```
7. **Commit** with a clear message:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```
8. **Push** your branch and open a Pull Request

## Code Style

- **TypeScript** — All source code is TypeScript
- **No comments** — Code should be self-documenting (no inline comments unless absolutely necessary)
- **Consistent formatting** — Follow the existing code style in the project
- **Meaningful names** — Use descriptive variable, function, and class names

## Project Structure

```
src/
  index.ts                  # Plugin entry point, OpenCode hooks
  types.ts                  # All TypeScript types (QualityTier, ModelCapability, etc.)
  health/
    scorer.ts               # Health scoring engine
  discovery/
    auto-discover.ts        # Model auto-discovery with capabilities
  router/
    intelligent-router.ts   # Tier-based routing fallback logic
  state/
    store.ts                # Persistent state management
```

## Key Concepts

### Quality Tiers
- `BEST` — Top models for large projects (200K+ context)
- `GREAT` — Strong models for daily development
- `GOOD` — Solid models for general tasks
- `BASIC` — Lightweight models for quick tasks

### Health Scoring
- 0–100 scale based on success rate, response time, error rate, freshness
- Scores >= 70 = Healthy, 40–69 = Degraded, < 40 = Unhealthy

### Fallback Order
1. Quality Tier (descending)
2. Context Window (descending)
3. Parameters (descending)
4. Health Score (descending)

## Pull Request Process

1. Ensure all tests pass and TypeScript compiles cleanly
2. Update the README if you add new features
3. Update CHANGELOG.md with your changes
4. Request review from maintainers
5. Address any feedback
6. Merge when approved

## Questions?

Feel free to open a GitHub Discussion or Issue if you have any questions.

## License

This project is licensed under the [MIT License](LICENSE). By contributing, you agree that your contributions will be licensed under the same license.