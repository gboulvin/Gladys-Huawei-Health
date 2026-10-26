// -----------------------------------------------------------------------------
// Scene actions (SDK v0.14+, Gladys 5.1+).
//
// Each action is declared in the manifest `scene_actions` field and handled
// here, keyed by that same `key`; index.js registers every entry with
// `gladys.onSceneAction(key, ...)`. A handler resolves the declared scalar
// `outputs`, readable by the following actions of the scene.
//
// A scene action is never a condition: when Huawei cannot be read, the
// action resolves `synced: false` and the scene author gates on it.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { clockTime } from './health.js';

const logger = createLogger({ name: 'scenes' });

// Outputs of `get_health_summary`, as declared in the manifest. A metric the
// account does not measure reads 0: scene outputs are scalars, never null.
export const SUMMARY_OUTPUTS = [
  'steps',
  'active_calories',
  'distance',
  'heart_rate',
  'resting_heart_rate',
  'spo2',
  'stress',
  'weight',
  'sleep_score',
  'sleep_minutes',
];

function summaryOf(service) {
  const values = service.snapshot?.values ?? {};
  const outputs = Object.fromEntries(
    SUMMARY_OUTPUTS.map((key) => {
      const value = key === 'sleep_minutes' ? values.sleep_total : values[key];
      return [key, typeof value === 'number' ? value : 0];
    }),
  );
  outputs.synced_at = service.snapshot
    ? (clockTime(service.snapshot.synced_at, service.config.timezone) ?? '')
    : '';
  return outputs;
}

export const SCENE_ACTIONS = {
  async refresh_data(service) {
    logger.info('Scene action refresh_data');
    try {
      const result = await service.sync();
      return { synced: result.ok };
    } catch (err) {
      logger.error('Scene refresh failed', err);
      return { synced: false };
    }
  },

  async get_health_summary(service, { fields }) {
    logger.info('Scene action get_health_summary');
    let synced = Boolean(service.snapshot);
    if (fields.refresh === true || !service.snapshot) {
      try {
        synced = (await service.sync()).ok;
      } catch (err) {
        logger.error('Scene refresh failed', err);
        synced = false;
      }
    }
    return { ...summaryOf(service), synced };
  },
};
