// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. The SDK fetches it for you
// (`gladys.getConfig()`) and notifies you of every change through
// `gladys.onConfigUpdated()`.
//
// The OAuth tokens live in the same store, under keys that are NOT part of the
// config_schema (see TOKEN_KEYS): never shown in the UI, never sent through the
// frontend.
// -----------------------------------------------------------------------------

// Groups of Huawei Health data the user can enable. Each group maps to one
// Huawei OAuth scope family (see src/huawei/dataTypes.js): the user only asks
// Huawei for the scopes they applied for in the developer console.
export const DATA_GROUPS = [
  'activity',
  'heart_rate',
  'spo2',
  'stress',
  'body_temperature',
  'weight',
  'sleep',
];

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  client_id: '',
  client_secret: '',
  data_groups: [...DATA_GROUPS],
  // Seconds between two reads of the Huawei Health cloud. Huawei refreshes most
  // data "in hours" or "in 10 minutes": polling faster only burns the quota.
  poll_frequency: 900,
  step_goal: 10000,
  heart_rate_high: 120,
  heart_rate_low: 40,
  spo2_low: 92,
  timezone: 'Europe/Paris',
};

// Off-schema keys written by the integration itself (setConfig).
export const TOKEN_KEYS = [
  'access_token',
  'refresh_token',
  'token_expires_at',
  'token_client_id',
  'account_id',
  'account_name',
  'api_base_url',
];

const MIN_POLL_FREQUENCY = 300;
const MAX_POLL_FREQUENCY = 3600;

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toGroups(value) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CONFIG.data_groups];
  }
  return DATA_GROUPS.filter((group) => value.includes(group));
}

function isValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const timezone = typeof raw.timezone === 'string' ? raw.timezone.trim() : '';
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    client_id: String(raw.client_id ?? '').trim(),
    client_secret: String(raw.client_secret ?? '').trim(),
    data_groups: toGroups(raw.data_groups),
    poll_frequency: Math.min(
      MAX_POLL_FREQUENCY,
      Math.max(MIN_POLL_FREQUENCY, toNumber(raw.poll_frequency, DEFAULT_CONFIG.poll_frequency)),
    ),
    step_goal: toNumber(raw.step_goal, DEFAULT_CONFIG.step_goal),
    heart_rate_high: toNumber(raw.heart_rate_high, DEFAULT_CONFIG.heart_rate_high),
    heart_rate_low: toNumber(raw.heart_rate_low, DEFAULT_CONFIG.heart_rate_low),
    spo2_low: toNumber(raw.spo2_low, DEFAULT_CONFIG.spo2_low),
    timezone: timezone && isValidTimezone(timezone) ? timezone : DEFAULT_CONFIG.timezone,
  };
}

/**
 * Keep the tokens of the current config when the user saves the form: the
 * form only carries the config_schema keys, and a partial update must never
 * log the user out.
 */
export function mergeConfigUpdate(current, update = {}) {
  const tokens = Object.fromEntries(
    TOKEN_KEYS.filter((key) => current[key] !== undefined && update[key] === undefined).map(
      (key) => [key, current[key]],
    ),
  );
  return normalizeConfig({ ...tokens, ...update });
}
