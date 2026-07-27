import type {
  StateStore,
  SerializedSessionState,
  SerializedModelHealthRecord,
} from '../types.js';
import type { SessionState, ModelHealthRecord } from '../types.js';
import { join } from 'path';

const STATE_VERSION = 2;
const STORE_FILENAME = 'auto-router-state.json';

export async function loadState(filePath: string): Promise<StateStore> {
  try {
    const fs = await import('fs');
    const data = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data) as StateStore;
    if (parsed.version !== STATE_VERSION) {
      return createFreshState();
    }
    return migrateState(parsed);
  } catch {
    return createFreshState();
  }
}

export async function saveState(
  filePath: string,
  store: StateStore,
): Promise<void> {
  try {
    const fs = await import('fs');
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dir && !(await exists(dir))) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    const data = JSON.stringify(store, null, 2);
    await fs.promises.writeFile(filePath, data, 'utf-8');
  } catch {
    // Silently fail if we can't persist state
  }
}

function createFreshState(): StateStore {
  return {
    sessions: {},
    globalHealth: {},
    version: STATE_VERSION,
    lastUpdated: Date.now(),
  };
}

function migrateState(store: StateStore): StateStore {
  store.version = STATE_VERSION;
  store.lastUpdated = Date.now();
  for (const [, session] of Object.entries(store.sessions)) {
    for (const [key, record] of Object.entries(session.modelUsage)) {
      if (typeof record.consecutiveErrors !== 'number') {
        record.consecutiveErrors = record.errorCount > 0 ? record.errorCount : 0;
      }
      if (typeof record.cooldownUntil !== 'number') {
        record.cooldownUntil = 0;
      }
      if (typeof record.estimatedCost !== 'number') {
        record.estimatedCost = 0;
      }
    }
  }
  return store;
}

function exists(path: string): Promise<boolean> {
  return import('fs').then((fs) => {
    return fs.promises
      .access(path)
      .then(() => true)
      .catch(() => false);
  });
}

export function serializeSessionState(
  session: SessionState,
): SerializedSessionState {
  const modelUsage: Record<string, SerializedModelHealthRecord> = {};
  for (const [key, record] of session.modelUsage) {
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
  return {
    sessionId: session.sessionId,
    currentIndex: session.currentIndex,
    failedModels: Array.from(session.failedModels),
    errorCount: session.errorCount,
    lastError: session.lastError,
    lastErrorAt: session.lastErrorAt,
    modelUsage,
    cooldownActive: session.cooldownActive,
    cooldownUntil: session.cooldownUntil,
  };
}

export function deserializeSessionState(
  serialized: SerializedSessionState,
): SessionState {
  const modelUsage = new Map<string, ModelHealthRecord>();
  for (const [key, record] of Object.entries(serialized.modelUsage)) {
    modelUsage.set(key, {
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
    });
  }
  return {
    sessionId: serialized.sessionId,
    currentIndex: serialized.currentIndex,
    failedModels: new Set(serialized.failedModels),
    errorCount: serialized.errorCount,
    lastError: serialized.lastError,
    lastErrorAt: serialized.lastErrorAt,
    modelUsage,
    cooldownActive: serialized.cooldownActive,
    cooldownUntil: serialized.cooldownUntil,
  };
}

export async function getStateFilePath(
  configDir: string,
): Promise<string> {
  return join(configDir, STORE_FILENAME);
}