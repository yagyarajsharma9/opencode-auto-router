import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import { QualityTier } from './types.js';
import type { FallbackChain } from './types.js';
import { getHealthReport } from './health/scorer.js';
import { discoverFreeModels, buildSmartFallbackChain, getFreeModelSuggestions } from './discovery/auto-discover.js';
import { loadState, saveState, serializeSessionState, deserializeSessionState } from './state/store.js';
import type { SessionState } from './types.js';

const DEFAULT_CONFIG: FallbackChain = {
  entries: [
    { provider: 'anthropic', model: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', isFree: true, capability: { contextWindow: 200000, parameters: 0, qualityTier: QualityTier.BEST, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192, inputCostPer1K: 0, outputCostPer1K: 0 } },
    { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', label: 'Claude Haiku', isFree: true, capability: { contextWindow: 200000, parameters: 0, qualityTier: QualityTier.GREAT, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 } },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Free)', isFree: true, capability: { contextWindow: 128000, parameters: 70000000000, qualityTier: QualityTier.GOOD, supportsVision: false, supportsTools: false, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 } },
    { provider: 'deepseek', model: 'deepseek-v3', label: 'DeepSeek V3 (Free)', isFree: true, capability: { contextWindow: 128000, parameters: 671000000000, qualityTier: QualityTier.GOOD, supportsVision: false, supportsTools: false, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0 } },
    { provider: 'google', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Free)', isFree: true, capability: { contextWindow: 1048576, parameters: 0, qualityTier: QualityTier.GREAT, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192, inputCostPer1K: 0, outputCostPer1K: 0 } },
    { provider: 'google', model: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Free)', isFree: true, capability: { contextWindow: 1048576, parameters: 0, qualityTier: QualityTier.BEST, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192, inputCostPer1K: 0, outputCostPer1K: 0 } },
    { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini', isFree: false, capability: { contextWindow: 128000, parameters: 0, qualityTier: QualityTier.GOOD, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0.15, outputCostPer1K: 0.6 } },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', label: 'GPT-4o Mini via OpenRouter', isFree: false, capability: { contextWindow: 128000, parameters: 0, qualityTier: QualityTier.GOOD, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096, inputCostPer1K: 0.15, outputCostPer1K: 0.6 } },
  ],
  maxRetriesPerSession: 3,
  cooldownMs: 5000,
  silenceMode: true,
  trackUsage: true,
  healthCheckIntervalMs: 30000,
  autoHeal: true,
  minHealthScore: 50,
};

function resolveConfig(options: Record<string, unknown> | undefined): { chain: FallbackChain } {
  if (!options) {
    return { chain: { ...DEFAULT_CONFIG, entries: [...DEFAULT_CONFIG.entries] } };
  }
  const pluginConfig = (options as Record<string, unknown>)['autoRouter'] as Record<string, unknown> | undefined;
  const chain = { ...DEFAULT_CONFIG, entries: [...DEFAULT_CONFIG.entries] };
  if (pluginConfig) {
    if (pluginConfig.fallbackChain) {
      chain.entries = pluginConfig.fallbackChain as { provider: string; model: string; label?: string; isFree?: boolean }[];
    }
    if (typeof pluginConfig.maxRetriesPerSession === 'number') {
      chain.maxRetriesPerSession = pluginConfig.maxRetriesPerSession;
    }
    if (typeof pluginConfig.cooldownMs === 'number') {
      chain.cooldownMs = pluginConfig.cooldownMs;
    }
    if (typeof pluginConfig.silenceMode === 'boolean') {
      chain.silenceMode = pluginConfig.silenceMode;
    }
    if (typeof pluginConfig.trackUsage === 'boolean') {
      chain.trackUsage = pluginConfig.trackUsage;
    }
    if (typeof pluginConfig.healthCheckIntervalMs === 'number') {
      chain.healthCheckIntervalMs = pluginConfig.healthCheckIntervalMs;
    }
    if (typeof pluginConfig.autoHeal === 'boolean') {
      chain.autoHeal = pluginConfig.autoHeal;
    }
    if (typeof pluginConfig.minHealthScore === 'number') {
      chain.minHealthScore = pluginConfig.minHealthScore;
    }
  }
  return { chain };
}

export const AutoRouter: Plugin = async (input: PluginInput, options?: Record<string, unknown>) => {
  const { chain } = resolveConfig(options);

  const stateFilePath = '.opencode/auto-router-state.json';
  let persistentState = await loadState(stateFilePath);

  const sessionStates = new Map<string, SessionState>();
  for (const [, serialized] of Object.entries(persistentState.sessions)) {
    const state = deserializeSessionState(serialized as any);
    sessionStates.set(state.sessionId, state);
  }

  const modelRecords = new Map<string, {
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
  }>();

  async function persistState() {
    const store: { sessions: Record<string, any>; globalHealth: Record<string, any>; version: number; lastUpdated: number } = {
      sessions: {},
      globalHealth: {},
      version: 2,
      lastUpdated: Date.now(),
    };
    for (const [, state] of sessionStates) {
      const modelUsage: Record<string, any> = {};
      for (const [key, record] of state.modelUsage) {
        modelUsage[key] = {
          provider: record.provider,
          model: record.model,
          requestCount: record.requestCount,
          errorCount: record.errorCount,
          successCount: record.successCount,
          totalResponseTimeMs: record.totalResponseTimeMs,
          lastUsedAt: record.lastUsedAt,
          lastSuccessAt: record.lastSuccessAt,
          lastErrorAt: record.lastErrorAt,
          consecutiveErrors: record.consecutiveErrors,
          cooldownUntil: record.cooldownUntil,
          estimatedCost: record.estimatedCost,
        };
      }
      store.sessions[state.sessionId] = {
        sessionId: state.sessionId,
        currentIndex: state.currentIndex,
        failedModels: Array.from(state.failedModels),
        errorCount: state.errorCount,
        lastError: state.lastError,
        lastErrorAt: state.lastErrorAt,
        modelUsage,
        cooldownActive: state.cooldownActive,
        cooldownUntil: state.cooldownUntil,
      };
    }
    await saveState(stateFilePath, store);
  }

  async function getOrCreateState(sessionId: string): Promise<SessionState> {
    if (!sessionStates.has(sessionId)) {
      const state: SessionState = {
        sessionId,
        currentIndex: 0,
        failedModels: new Set(),
        errorCount: 0,
        lastErrorAt: 0,
        modelUsage: new Map(),
        cooldownActive: false,
        cooldownUntil: 0,
      };
      sessionStates.set(sessionId, state);
      return state;
    }
    return sessionStates.get(sessionId)!;
  }

  return {
    event: async (_ctx) => {
      const evt = (_ctx as { event?: { type: string; properties: Record<string, unknown> } }).event;
      if (!evt || evt.type !== 'session.error') return;

      const sessionId = evt.properties.sessionID as string | undefined;
      if (!sessionId) return;

      const errorObj = evt.properties.error as { message?: string; statusCode?: number } | undefined;
      const message = errorObj?.message ?? String(evt.properties);
      const currentProvider = evt.properties.modelProvider as string | undefined;
      const currentModel = evt.properties.modelName as string | undefined;

      const state = await getOrCreateState(sessionId);
      state.lastError = message;
      state.lastErrorAt = Date.now();
      state.errorCount++;

      if (currentProvider && currentModel) {
        const currentKey = `${currentProvider}/${currentModel}`;
        state.failedModels.add(currentKey);
        const record = modelRecords.get(currentKey);
        if (record) {
          record.consecutiveErrors++;
          record.lastErrorAt = Date.now();
          record.errorCount++;
          record.requestCount++;
        }
      }

      await persistState();
    },

    'chat.params': async (inputParam: unknown) => {
      const inputObj = inputParam as { sessionID?: string; model?: { providerID?: string; id?: string; model?: string } };
      const sessionId = inputObj.sessionID;
      if (!sessionId) return;

      const provider = inputObj.model?.providerID ?? 'unknown';
      const model = inputObj.model?.id ?? inputObj.model?.model ?? 'unknown';
      const modelKey = `${provider}/${model}`;

      const state = await getOrCreateState(sessionId);
      if (!modelRecords.has(modelKey)) {
        modelRecords.set(modelKey, {
          provider,
          model,
          requestCount: 1,
          errorCount: 0,
          successCount: 0,
          totalResponseTimeMs: 0,
          lastUsedAt: Date.now(),
          lastSuccessAt: 0,
          lastErrorAt: 0,
          consecutiveErrors: 0,
          cooldownUntil: 0,
          estimatedCost: 0,
        });
      } else {
        const rec = modelRecords.get(modelKey)!;
        rec.requestCount++;
        rec.lastUsedAt = Date.now();
      }

      await persistState();
    },

    'session.status': async (inputParam: unknown) => {
      const inputObj = inputParam as { event?: { properties?: { sessionID?: string; status?: string } } };
      const evt = inputObj.event;
      if (!evt?.properties) return;
      const sessionId = evt.properties.sessionID as string | undefined;
      const status = evt.properties.status as string | undefined;
      if (!sessionId) return;

      const state = sessionStates.get(sessionId);
      if (!state) return;

      if (status === 'idle' || status === 'compact' || status === 'running') {
        state.cooldownActive = false;
        state.cooldownUntil = 0;
        state.failedModels.clear();
        state.currentIndex = 0;
      }

      await persistState();
    },

    'session.compacted': async (inputParam: unknown) => {
      const inputObj = inputParam as { event?: { properties?: { sessionID?: string } } };
      const sessionId = inputObj.event?.properties?.sessionID as string | undefined;
      if (sessionId) {
        sessionStates.delete(sessionId);
        await persistState();
      }
    },

    'session.deleted': async (inputParam: unknown) => {
      const inputObj = inputParam as { event?: { properties?: { sessionID?: string } } };
      const sessionId = inputObj.event?.properties?.sessionID as string | undefined;
      if (sessionId) {
        sessionStates.delete(sessionId);
        await persistState();
      }
    },

    tool: {
      getAutoRouterHealth: {
        description: 'Get the auto router health report for all models',
        args: {},
        async execute() {
          const report = getHealthReport(modelRecords);
          const lines: string[] = ['# Auto Router Health Report', ''];
          for (const [key, score] of report) {
            lines.push(`- \`${key}\`: health=${score}%`);
          }
          return lines.join('\n');
        },
      },
      getRouterStatus: {
        description: 'Get the auto router status including free model suggestions',
        args: {},
        async execute() {
          const discoveryResults = await discoverFreeModels(chain as unknown as Record<string, unknown>);
          const freeSuggestions = getFreeModelSuggestions(discoveryResults);
          return `Fallback chain length: ${chain.entries.length}\nFree model suggestions: ${freeSuggestions.join(', ')}\nAuto-heal: ${chain.autoHeal}\nMin health score: ${chain.minHealthScore}`;
        },
      },
    },

    dispose: async () => {
      await persistState();
    },
  };
};

export { DEFAULT_CONFIG, resolveConfig };