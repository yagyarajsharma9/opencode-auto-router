export interface HealthScore {
  modelKey: string;
  provider: string;
  model: string;
  isFree: boolean;
  healthScore: number;
  successRate: number;
  avgResponseTimeMs: number;
  errorRate: number;
  totalRequests: number;
  totalErrors: number;
  consecutiveErrors: number;
  lastSuccessAt: number;
  lastErrorAt: number;
  cooldownUntil: number;
  isOverloaded: boolean;
  estimatedCostPerRequest: number;
}

export enum QualityTier {
  BEST = 'best',
  GREAT = 'great',
  GOOD = 'good',
  BASIC = 'basic',
}

export interface ModelCapability {
  contextWindow: number;
  parameters: number;
  qualityTier: QualityTier;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  maxOutputTokens: number;
  inputCostPer1K: number;
  outputCostPer1K: number;
}

export interface ModelEntry {
  provider: string;
  model: string;
  label?: string;
  isFree?: boolean;
  capability?: ModelCapability;
}

export interface FallbackChain {
  entries: ModelEntry[];
  maxRetriesPerSession: number;
  cooldownMs: number;
  silenceMode: boolean;
  trackUsage: boolean;
  healthCheckIntervalMs: number;
  autoHeal: boolean;
  minHealthScore: number;
}

export interface SessionState {
  sessionId: string;
  currentIndex: number;
  failedModels: Set<string>;
  errorCount: number;
  lastError?: string;
  lastErrorAt: number;
  modelUsage: Map<string, ModelHealthRecord>;
  cooldownActive: boolean;
  cooldownUntil: number;
}

export interface ModelHealthRecord {
  provider: string;
  model: string;
  requestCount: number;
  errorCount: number;
  successCount: number;
  totalResponseTimeMs: number;
  lastUsedAt: number;
  lastSuccessAt: number;
  lastErrorAt: number;
  consecutiveErrors: number;
  cooldownUntil: number;
  estimatedCost: number;
}

export interface HealthSnapshot {
  timestamp: number;
  modelKeys: string[];
  scores: Map<string, HealthScore>;
}

export interface DiscoveryResult {
  provider: string;
  model: string;
  isFreeTier: boolean;
  hasApiKey: boolean;
  configured: boolean;
  estimatedFreeLimit?: string;
  capability?: ModelCapability;
}

export interface RoutingDecision {
  provider: string;
  model: string;
  reason: string;
  confidence: number;
  healthScore: number;
}

export interface StateStore {
  sessions: Record<string, SerializedSessionState>;
  globalHealth: Record<string, SerializedHealthRecord>;
  version: number;
  lastUpdated: number;
}

export interface SerializedSessionState {
  sessionId: string;
  currentIndex: number;
  failedModels: string[];
  errorCount: number;
  lastError?: string;
  lastErrorAt: number;
  modelUsage: Record<string, SerializedModelHealthRecord>;
  cooldownActive: boolean;
  cooldownUntil: number;
}

export interface SerializedModelHealthRecord {
  provider: string;
  model: string;
  requestCount: number;
  errorCount: number;
  successCount: number;
  totalResponseTimeMs: number;
  lastUsedAt: number;
  lastSuccessAt: number;
  lastErrorAt: number;
  consecutiveErrors: number;
  cooldownUntil: number;
  estimatedCost: number;
}

export interface SerializedHealthRecord {
  provider: string;
  model: string;
  healthScore: number;
  successRate: number;
  avgResponseTimeMs: number;
  errorRate: number;
  totalRequests: number;
  totalErrors: number;
  consecutiveErrors: number;
  lastSuccessAt: number;
  lastErrorAt: number;
  cooldownUntil: number;
  isOverloaded: boolean;
}