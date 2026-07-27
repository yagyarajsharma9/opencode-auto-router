import type {
  HealthScore,
  ModelHealthRecord,
  ModelEntry,
} from '../types.js';

const WEIGHTS = {
  successRate: 0.35,
  responseTime: 0.2,
  errorRate: 0.2,
  consecutiveErrors: 0.1,
  freshness: 0.1,
  cooldownPenalty: 0.05,
};

const HEALTHY_THRESHOLD = 70;
const DEGRADED_THRESHOLD = 40;
const OVERLOADED_THRESHOLD = 20;

export function computeHealthScore(
  record: ModelHealthRecord,
  now: number,
): HealthScore {
  const totalRequests = record.requestCount;
  const totalErrors = record.errorCount;
  const successCount = record.successCount;
  const totalResponseTime = record.totalResponseTimeMs;
  const consecutiveErrors = record.consecutiveErrors;

  const successRate = totalRequests > 0 ? successCount / totalRequests : 1;
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
  const avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;

  const timeSinceLastSuccess = now - record.lastSuccessAt;
  const timeSinceLastError = now - record.lastErrorAt;
  const freshness = timeSinceLastSuccess < 60000 ? 1 : timeSinceLastSuccess < 300000 ? 0.8 : timeSinceLastSuccess < 600000 ? 0.5 : 0.2;

  const consecutivePenalty = Math.min(consecutiveErrors / 5, 1);
  const cooldownPenalty = record.cooldownUntil > now ? 0.1 : 0;

  const responseTimeScore = avgResponseTime < 1000 ? 1 : avgResponseTime < 3000 ? 0.8 : avgResponseTime < 10000 ? 0.5 : 0.2;

  const rawScore =
    successRate * WEIGHTS.successRate +
    responseTimeScore * WEIGHTS.responseTime +
    (1 - errorRate) * WEIGHTS.errorRate +
    (1 - consecutivePenalty) * WEIGHTS.consecutiveErrors +
    freshness * WEIGHTS.freshness -
    cooldownPenalty * WEIGHTS.cooldownPenalty;

  const healthScore = Math.round(Math.max(0, Math.min(100, rawScore * 100)));

  const isOverloaded = consecutiveErrors >= 3 || errorRate > 0.5;

  return {
    modelKey: `${record.provider}/${record.model}`,
    provider: record.provider,
    model: record.model,
    isFree: false,
    healthScore,
    successRate: Math.round(successRate * 100),
    avgResponseTimeMs: Math.round(avgResponseTime),
    errorRate: Math.round(errorRate * 100),
    totalRequests,
    totalErrors,
    consecutiveErrors,
    lastSuccessAt: record.lastSuccessAt,
    lastErrorAt: record.lastErrorAt,
    cooldownUntil: record.cooldownUntil,
    isOverloaded,
    estimatedCostPerRequest: record.estimatedCost / Math.max(totalRequests, 1),
  };
}

export function rankModels(
  scores: Map<string, HealthScore>,
  entries: ModelEntry[],
): string[] {
  return entries
    .map((entry) => {
      const key = `${entry.provider}/${entry.model}`;
      const score = scores.get(key);
      return { key, score: score?.healthScore ?? 100, entry };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.key);
}

export function isModelHealthy(score: HealthScore): boolean {
  return score.healthScore >= HEALTHY_THRESHOLD && !score.isOverloaded;
}

export function isModelDegraded(score: HealthScore): boolean {
  return score.healthScore >= DEGRADED_THRESHOLD && score.healthScore < HEALTHY_THRESHOLD;
}

export function isModelUnhealthy(score: HealthScore): boolean {
  return score.healthScore < DEGRADED_THRESHOLD || score.isOverloaded;
}

export function findBestModel(
  scores: Map<string, number>,
  entries: ModelEntry[],
  failedModels: Set<string>,
): { entry: ModelEntry; score: number; reason: string } | null {
  const ranked = entries
    .map((entry) => {
      const key = `${entry.provider}/${entry.model}`;
      const score = scores.get(key) ?? 100;
      return { key, score, entry };
    })
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (failedModels.has(item.key)) continue;

    if (item.score >= 70) {
      return {
        entry: item.entry,
        score: item.score,
        reason: 'healthy',
      };
    }

    if (item.score >= 40) {
      return {
        entry: item.entry,
        score: item.score,
        reason: 'degraded',
      };
    }
  }

  for (const item of ranked) {
    if (failedModels.has(item.key)) continue;
    return {
      entry: item.entry,
      score: item.score,
      reason: 'unhealthy-last-resort',
    };
  }

  return null;
}

export function computeRoutingDecision(
  scores: Map<string, HealthScore>,
  entries: ModelEntry[],
  failedModels: Set<string>,
  config: { minHealthScore: number; freeTierPriority: boolean },
): { provider: string; model: string; reason: string; confidence: number; healthScore: number } | null {
  const ranked = rankModels(scores, entries);

  for (const key of ranked) {
    if (failedModels.has(key)) continue;
    const score = scores.get(key);
    if (!score) continue;

    const shouldUseFree = config.freeTierPriority && score.isFree && score.healthScore >= config.minHealthScore;
    const shouldUsePaid = !config.freeTierPriority && score.healthScore >= config.minHealthScore;

    if (shouldUseFree || shouldUsePaid) {
      return {
        provider: score.provider,
        model: score.model,
        reason: shouldUseFree ? 'free-tier-healthy' : 'model-healthy',
        confidence: score.healthScore / 100,
        healthScore: score.healthScore,
      };
    }
  }

  const fallback = ranked.find((key) => !failedModels.has(key) && scores.has(key));
  if (fallback) {
    const score = scores.get(fallback)!;
    return {
      provider: score.provider,
      model: score.model,
      reason: 'all-others-unhealthy',
      confidence: score.healthScore / 100,
      healthScore: score.healthScore,
    };
  }

  return null;
}

export function updateModelHealth(
  record: ModelHealthRecord,
  responseTimeMs: number,
  success: boolean,
): ModelHealthRecord {
  const now = Date.now();
  return {
    ...record,
    requestCount: record.requestCount + 1,
    totalResponseTimeMs: record.totalResponseTimeMs + responseTimeMs,
    lastUsedAt: now,
    successCount: record.successCount + (success ? 1 : 0),
    errorCount: record.errorCount + (success ? 0 : 1),
    lastSuccessAt: success ? now : record.lastSuccessAt,
    lastErrorAt: success ? record.lastErrorAt : now,
    consecutiveErrors: success ? 0 : record.consecutiveErrors + 1,
    estimatedCost: record.estimatedCost + (success ? computeEstimatedCost(record.provider, record.model) : 0),
  };
}

function computeEstimatedCost(provider: string, model: string): number {
  const costMap: Record<string, number> = {
    'anthropic': 0.003,
    'openai': 0.0015,
    'groq': 0.0001,
    'deepseek': 0.0003,
    'openrouter': 0.002,
    'google': 0.0025,
    'fireworks': 0.002,
  };
  const baseCost = costMap[provider] ?? 0.001;
  return baseCost;
}

export function getHealthReport(modelRecords: Map<string, ModelHealthRecord>): Map<string, HealthScore> {
  const scores = new Map<string, HealthScore>();
  const now = Date.now();
  for (const [key, record] of modelRecords) {
    const health = computeHealthScore(record, now);
    scores.set(key, health);
  }
  return scores;
}