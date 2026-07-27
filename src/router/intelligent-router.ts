import type { ModelEntry, FallbackChain, ModelHealthRecord } from '../types.js';
import { computeHealthScore } from '../health/scorer.js';
import { QualityTier } from '../types.js';

interface RouterOutput {
  provider: string;
  model: string;
  reason: string;
  confidence: number;
  switched: boolean;
}

const TIER_WEIGHT: Record<QualityTier, number> = {
  [QualityTier.BEST]: 1000,
  [QualityTier.GREAT]: 800,
  [QualityTier.GOOD]: 600,
  [QualityTier.BASIC]: 400,
};

function getEffectiveContextWindow(entry: ModelEntry): number {
  return entry.capability?.contextWindow ?? 0;
}

function getEffectiveParameters(entry: ModelEntry): number {
  return entry.capability?.parameters ?? 0;
}

function getTierWeight(entry: ModelEntry): number {
  if (entry.capability?.qualityTier) {
    return TIER_WEIGHT[entry.capability.qualityTier] ?? 400;
  }
  if (entry.isFree) {
    return 600;
  }
  return 400;
}

interface RankedEntry {
  entry: ModelEntry;
  healthScore: number;
  tierWeight: number;
  contextWindow: number;
  parameters: number;
}

function rankEntries(
  entries: ModelEntry[],
  scores: Map<string, number>,
  failedModels: Set<string>,
): RankedEntry[] {
  return entries
    .map((entry) => {
      const key = `${entry.provider}/${entry.model}`;
      return {
        entry,
        healthScore: scores.get(key) ?? 100,
        tierWeight: getTierWeight(entry),
        contextWindow: getEffectiveContextWindow(entry),
        parameters: getEffectiveParameters(entry),
      };
    })
    .filter((r) => !failedModels.has(`${r.entry.provider}/${r.entry.model}`))
    .sort((a, b) => {
      if (a.tierWeight !== b.tierWeight) return b.tierWeight - a.tierWeight;
      if (a.contextWindow !== b.contextWindow) return b.contextWindow - a.contextWindow;
      if (a.parameters !== b.parameters) return b.parameters - a.parameters;
      return b.healthScore - a.healthScore;
    });
}

export function makeIntelligentRoutingDecision(
  currentProvider: string,
  currentModel: string,
  failedModels: Set<string>,
  chain: FallbackChain,
  modelRecords: Map<string, ModelHealthRecord>,
): RouterOutput {
  const scores = new Map<string, number>();
  const now = Date.now();
  for (const [key, record] of modelRecords) {
    const health = computeHealthScore(record, now);
    scores.set(key, health.healthScore);
  }

  const currentKey = `${currentProvider}/${currentModel}`;
  const currentHealth = scores.get(currentKey) ?? 50;

  const currentRecord = modelRecords.get(currentKey);
  const currentModelIsOverloaded = (currentRecord?.consecutiveErrors ?? 0) >= 2;
  const currentModelIsNewlyFailing =
    (currentRecord?.consecutiveErrors ?? 0) >= 1 &&
    Date.now() - (currentRecord?.lastErrorAt ?? 0) < 60000;

  const ranked = rankEntries(chain.entries, scores, failedModels);
  const best = ranked.length > 0 ? ranked[0] : null;

  if (currentHealth < chain.minHealthScore || currentModelIsOverloaded || currentModelIsNewlyFailing) {
    if (best && best.healthScore > currentHealth + 20) {
      return {
        provider: best.entry.provider,
        model: best.entry.model,
        reason: `proactively-switching (tier: ${best.entry.capability?.qualityTier ?? 'unknown'}, score: ${best.healthScore} vs current ${currentHealth})`,
        confidence: best.healthScore / 100,
        switched: true,
      };
    }

    if (best && best.healthScore >= currentHealth) {
      return {
        provider: currentProvider,
        model: currentModel,
        reason: 'keep-current-degraded',
        confidence: 0.3,
        switched: false,
      };
    }
  }

  if (currentHealth >= chain.minHealthScore && !currentModelIsOverloaded) {
    return {
      provider: currentProvider,
      model: currentModel,
      reason: 'current-model-healthy',
      confidence: currentHealth / 100,
      switched: false,
    };
  }

  if (best && best.healthScore >= chain.minHealthScore) {
    return {
      provider: best.entry.provider,
      model: best.entry.model,
      reason: `fallback-to-healthy-model (tier: ${best.entry.capability?.qualityTier ?? 'unknown'}, score: ${best.healthScore})`,
      confidence: best.healthScore / 100,
      switched: true,
    };
  }

  return {
    provider: currentProvider,
    model: currentModel,
    reason: 'no-better-alternative',
    confidence: 0,
    switched: false,
  };
}

export function shouldSwitchModel(
  provider: string,
  model: string,
  modelRecords: Map<string, ModelHealthRecord>,
  chain: FallbackChain,
): { switch: boolean; reason: string; nextProvider?: string; nextModel?: string } {
  const key = `${provider}/${model}`;
  const record = modelRecords.get(key);

  if (!record) {
    return { switch: false, reason: 'no-history' };
  }

  if (record.consecutiveErrors >= 3) {
    const emptyScores = new Map<string, number>();
    const emptyFailed = new Set<string>();
    const ranked = rankEntries(chain.entries, emptyScores, emptyFailed);
    const fallback = ranked.find((r) => r.entry.provider !== provider || r.entry.model !== model);
    if (fallback) {
      return {
        switch: true,
        reason: `model-has-${record.consecutiveErrors}-consecutive-errors`,
        nextProvider: fallback.entry.provider,
        nextModel: fallback.entry.model,
      };
    }
  }

  return { switch: false, reason: 'model-acceptable' };
}

export function recordRoutingOutcome(
  modelRecords: Map<string, ModelHealthRecord>,
  provider: string,
  model: string,
  success: boolean,
  responseTimeMs: number,
): void {
  const key = `${provider}/${model}`;
  const record = modelRecords.get(key);
  const now = Date.now();

  if (!record) {
    modelRecords.set(key, {
      provider,
      model,
      requestCount: 1,
      errorCount: success ? 0 : 1,
      successCount: success ? 1 : 0,
      totalResponseTimeMs: responseTimeMs,
      lastUsedAt: now,
      lastSuccessAt: success ? now : 0,
      lastErrorAt: success ? 0 : now,
      consecutiveErrors: success ? 0 : 1,
      cooldownUntil: 0,
      estimatedCost: 0,
    });
    return;
  }

  modelRecords.set(key, {
    ...record,
    requestCount: record.requestCount + 1,
    totalResponseTimeMs: record.totalResponseTimeMs + responseTimeMs,
    lastUsedAt: now,
    successCount: record.successCount + (success ? 1 : 0),
    errorCount: record.errorCount + (success ? 0 : 1),
    lastSuccessAt: success ? now : record.lastSuccessAt,
    lastErrorAt: success ? record.lastErrorAt : now,
    consecutiveErrors: success ? 0 : record.consecutiveErrors + 1,
  });
}