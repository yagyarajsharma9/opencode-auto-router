import type { DiscoveryResult, ModelCapability } from '../types.js';
import { QualityTier } from '../types.js';

const FREE_TIER_PROVIDERS = new Set([
  'anthropic',
  'groq',
  'deepseek',
  'google',
  'fireworks',
  'nvidia',
  'openrouter',
  'together-ai',
]);

const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'claude-sonnet-4-20250514': { contextWindow: 200000, parameters: 0, qualityTier: QualityTier.BEST, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192, inputCostPer1K: 0, outputCostPer1K: 0 },
  'claude-3-5-haiku-20241022': { contextWindow: 200000, parameters: 0, qualityTier: QualityTier.GREAT, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 },
  'claude-3-haiku-20240307': { contextWindow: 200000, parameters: 0, qualityTier: QualityTier.GREAT, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 },
  'llama-3.3-70b-versatile': { contextWindow: 128000, parameters: 70000000000, qualityTier: QualityTier.GOOD, supportsVision: false, supportsTools: false, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 },
  'mixtral-8x7b-32768': { contextWindow: 32768, parameters: 87000000000, qualityTier: QualityTier.GOOD, supportsVision: false, supportsTools: false, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 },
  'deepseek-v3': { contextWindow: 128000, parameters: 671000000000, qualityTier: QualityTier.GOOD, supportsVision: false, supportsTools: false, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 },
  'deepseek-chat': { contextWindow: 128000, parameters: 671000000000, qualityTier: QualityTier.GOOD, supportsVision: false, supportsTools: false, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 },
  'gpt-4o-mini': { contextWindow: 128000, parameters: 0, qualityTier: QualityTier.GOOD, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0.15, outputCostPer1K: 0.6 },
  'gemini-2.0-flash': { contextWindow: 1048576, parameters: 0, qualityTier: QualityTier.GREAT, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192, inputCostPer1K: 0, outputCostPer1K: 0 },
  'gemini-2.5-flash': { contextWindow: 1048576, parameters: 0, qualityTier: QualityTier.GREAT, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192, inputCostPer1K: 0, outputCostPer1K: 0 },
  'gemini-2.5-pro': { contextWindow: 1048576, parameters: 0, qualityTier: QualityTier.BEST, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192, inputCostPer1K: 0, outputCostPer1K: 0 },
};

const KNOWN_FREE_MODELS = new Map<string, { provider: string; free: boolean; limit?: string }>([
  ['claude-sonnet-4-20250514', { provider: 'anthropic', free: true, limit: 'via OpenCode Zen' }],
  ['claude-3-5-haiku-20241022', { provider: 'anthropic', free: true, limit: 'via OpenCode Zen' }],
  ['claude-3-haiku-20240307', { provider: 'anthropic', free: true, limit: 'via OpenCode Zen' }],
  ['llama-3.3-70b-versatile', { provider: 'groq', free: true, limit: '30 req/min' }],
  ['mixtral-8x7b-32768', { provider: 'groq', free: true, limit: '30 req/min' }],
  ['deepseek-v3', { provider: 'deepseek', free: true, limit: 'free tier' }],
  ['deepseek-chat', { provider: 'deepseek', free: true, limit: 'free tier' }],
  ['gpt-4o-mini', { provider: 'openai', free: false, limit: 'paid (very cheap)' }],
  ['gemini-2.0-flash', { provider: 'google', free: true, limit: 'Generous free tier' }],
  ['gemini-2.5-flash', { provider: 'google', free: true, limit: 'Generous free tier' }],
]);

const PROVIDER_FREE_MODEL_KEYWORDS = [
  { pattern: /claude-3-5-haiku|claude-haiku/i, provider: 'anthropic', free: true },
  { pattern: /claude-sonnet-4/i, provider: 'anthropic', free: true },
  { pattern: /llama.*versatile|llama.*70b|mixtral/i, provider: 'groq', free: true },
  { pattern: /deepseek/i, provider: 'deepseek', free: true },
  { pattern: /gemini.*flash/i, provider: 'google', free: true },
  { pattern: /gemma/i, provider: 'google', free: true },
  { pattern: /qwen.*coder/i, provider: 'alibaba', free: true },
  { pattern: /yq-\d+y\b/i, provider: 'qwen', free: true },
  { pattern: /llama-\d+.*instruct/i, provider: 'meta', free: true },
];

export async function discoverFreeModels(
  configuredProviders: Record<string, unknown>,
  authStorage?: Record<string, unknown>,
): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];
  const providerKeys = Object.keys(configuredProviders);

  for (const providerKey of providerKeys) {
    const providerConfig = configuredProviders[providerKey] as Record<string, unknown> | undefined;
    if (!providerConfig) continue;

    const hasApiKey = checkProviderAuth(providerKey, authStorage);
    const models = (providerConfig as { models?: Record<string, unknown> })?.models as Record<string, unknown> | undefined;

if (models) {
      for (const modelKey of Object.keys(models)) {
        const isFree = isModelLikelyFree(providerKey, modelKey);
        const capability = MODEL_CAPABILITIES[modelKey];
        results.push({
          provider: providerKey,
          model: modelKey,
          isFreeTier: isFree,
          hasApiKey,
          configured: true,
          capability,
        });
      }
    } else {
      const knownModel = KNOWN_FREE_MODELS.get(providerKey);
      if (knownModel) {
        const capability = MODEL_CAPABILITIES[providerKey];
        results.push({
          provider: providerKey,
          model: knownModel.provider,
          isFreeTier: knownModel.free,
          hasApiKey,
          configured: true,
          estimatedFreeLimit: knownModel.limit,
          capability,
        });
      }
    }
  }

  return results;
}

function checkProviderAuth(
  provider: string,
  authStorage?: Record<string, unknown>,
): boolean {
  if (!authStorage) return false;
  const providerAuth = authStorage[provider] as Record<string, unknown> | undefined;
  if (!providerAuth) return false;
  return !!providerAuth.apiKey || !!providerAuth.key;
}

function isModelLikelyFree(provider: string, model: string): boolean {
  if (!FREE_TIER_PROVIDERS.has(provider)) return false;

  for (const { pattern, provider: p, free } of PROVIDER_FREE_MODEL_KEYWORDS) {
    if (pattern.test(model) && p === provider) {
      return free;
    }
  }

  const freeModelPatterns = [
    /haiku/i,
    /flash/i,
    /gpt-4o-mini/i,
    /gemini.*flash/i,
    /llama-\d+.*instruct/i,
    /qwen.*coder/i,
    /deepseek/i,
  ];

  return freeModelPatterns.some((p) => p.test(model));
}

export function filterFreeTierModels(
  models: DiscoveryResult[],
): DiscoveryResult[] {
  return models.filter((m) => m.isFreeTier);
}

export function filterPaidModels(
  models: DiscoveryResult[],
): DiscoveryResult[] {
  return models.filter((m) => !m.isFreeTier);
}

export function getFreeModelSuggestions(
  discoveryResults: DiscoveryResult[],
): string[] {
  const freeModels = filterFreeTierModels(discoveryResults);
  return freeModels.map((m) => `${m.provider}/${m.model}`);
}

export function buildSmartFallbackChain(
  discoveryResults: DiscoveryResult[],
  preferredOrder?: string[],
): string[] {
  const freeModels = filterFreeTierModels(discoveryResults);
  const paidModels = filterPaidModels(discoveryResults);

  const tierOrder: Record<string, number> = {
    [QualityTier.BEST]: 0,
    [QualityTier.GREAT]: 1,
    [QualityTier.GOOD]: 2,
    [QualityTier.BASIC]: 3,
  };

  const sortKey = (m: DiscoveryResult): string => {
    const cap = m.capability;
    const tier = cap?.qualityTier ?? QualityTier.GOOD;
    const ctx = cap?.contextWindow ?? 0;
    const params = cap?.parameters ?? 0;
    return `${tierOrder[tier]}-${ctx}-${params}-${m.provider}/${m.model}`;
  };

  freeModels.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const chain: string[] = [];

  if (preferredOrder) {
    const ordered = preferredOrder.filter((m) => {
      const found = discoveryResults.some(
        (d) => `${d.provider}/${d.model}` === m,
      );
      if (found) {
        chain.push(m);
        return false;
      }
      return true;
    });
  }

  for (const model of freeModels) {
    const key = `${model.provider}/${model.model}`;
    if (!chain.includes(key)) {
      chain.push(key);
    }
  }

  for (const model of paidModels) {
    const key = `${model.provider}/${model.model}`;
    if (!chain.includes(key) && !key.includes('gpt-4o-mini')) {
      chain.push(key);
    }
  }

  for (const model of paidModels) {
    const key = `${model.provider}/${model.model}`;
    if (!chain.includes(key)) {
      chain.push(key);
    }
  }

  return chain;
}