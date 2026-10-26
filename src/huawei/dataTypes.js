// -----------------------------------------------------------------------------
// Huawei Health Service Kit vocabulary: OAuth scopes and data type names.
//
// Source: the "Data Types" pages of the Health Service Kit cloud-side
// documentation (developer.huawei.com). Every scope must ALSO be granted to
// the app in the Huawei developer console, or the authorization fails.
// -----------------------------------------------------------------------------

const SCOPE_PREFIX = 'https://www.huawei.com/healthkit/';

// `openid` is mandatory for the Huawei ID authorization endpoint; it also
// yields the id_token whose `sub` identifies the account.
export const BASE_SCOPES = ['openid', 'profile'];

export const DATA_TYPES = {
  STEPS_DELTA: 'com.huawei.continuous.steps.delta',
  STEPS_TOTAL: 'com.huawei.continuous.steps.total',
  CALORIES_BURNT: 'com.huawei.continuous.calories.burnt',
  CALORIES_TOTAL: 'com.huawei.continuous.calories.burnt.total',
  DISTANCE_DELTA: 'com.huawei.continuous.distance.delta',
  DISTANCE_TOTAL: 'com.huawei.continuous.distance.total',
  HEART_RATE: 'com.huawei.instantaneous.heart_rate',
  RESTING_HEART_RATE: 'com.huawei.instantaneous.resting_heart_rate',
  HEART_RATE_VARIABILITY: 'com.huawei.heart_rate_variability',
  SPO2: 'com.huawei.instantaneous.spo2',
  STRESS: 'com.huawei.instantaneous.stress',
  BODY_TEMPERATURE: 'com.huawei.instantaneous.body.temperature',
  SKIN_TEMPERATURE: 'com.huawei.instantaneous.skin.temperature',
  BODY_WEIGHT: 'com.huawei.instantaneous.body_weight',
  SLEEP_RECORD: 'com.huawei.health.record.sleep',
  SLEEP_FRAGMENT: 'com.huawei.continuous.sleep.fragment',
};

// One entry per config data group (DATA_GROUPS in src/config.js).
export const GROUP_SCOPES = {
  activity: ['step.read', 'calories.read', 'distance.read'],
  heart_rate: ['heartrate.read'],
  spo2: ['oxygensaturation.read'],
  stress: ['stress.read'],
  body_temperature: ['bodytemperature.read'],
  weight: ['heightweight.read'],
  sleep: ['sleep.read'],
};

/**
 * The scopes to request for the enabled data groups, space-separated as the
 * Huawei ID authorization endpoint expects them.
 */
export function scopesFor(groups) {
  const healthScopes = groups.flatMap((group) => GROUP_SCOPES[group] ?? []);
  return [...BASE_SCOPES, ...healthScopes.map((scope) => `${SCOPE_PREFIX}${scope}`)].join(' ');
}
