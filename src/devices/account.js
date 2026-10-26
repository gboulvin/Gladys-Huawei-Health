// -----------------------------------------------------------------------------
// Device type: HUAWEI HEALTH ACCOUNT
//
// The Huawei Health cloud does not expose a watch, a band or a scale as such:
// every paired device writes into the user's account, and Huawei merges their
// data. One Gladys device therefore stands for the account, with one read-only
// feature per health metric of the enabled data groups. The physical devices
// are listed by the `health_overview` widget and the `test_connection` action.
//
// Gladys has no health category: the metrics use the closest standard
// categories, and the feature name carries the unit Gladys cannot express
// (bpm, kcal, kg).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

const DEVICE_TYPE = 'account';

const C = DEVICE_FEATURE_CATEGORIES;
const T = DEVICE_FEATURE_TYPES;
const U = DEVICE_FEATURE_UNITS;

// Feature keys are forever: they end the feature external ids.
export const FEATURES = [
  {
    key: 'steps',
    group: 'activity',
    name: 'Steps today',
    category: C.COUNTER_SENSOR,
    type: T.SENSOR.INTEGER,
    min: 0,
    max: 200000,
  },
  {
    key: 'active_calories',
    group: 'activity',
    name: 'Active calories today (kcal)',
    category: C.COUNTER_SENSOR,
    type: T.SENSOR.INTEGER,
    min: 0,
    max: 20000,
  },
  {
    key: 'distance',
    group: 'activity',
    name: 'Distance today',
    category: C.DISTANCE_SENSOR,
    type: T.SENSOR.INTEGER,
    unit: U.M,
    min: 0,
    max: 500000,
  },
  {
    key: 'heart_rate',
    group: 'heart_rate',
    name: 'Heart rate (bpm)',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    min: 0,
    max: 255,
  },
  {
    key: 'resting_heart_rate',
    group: 'heart_rate',
    name: 'Resting heart rate (bpm)',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    min: 0,
    max: 255,
  },
  {
    key: 'heart_rate_variability',
    group: 'heart_rate',
    name: 'Heart rate variability',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.MILLISECONDS,
    min: 0,
    max: 200,
  },
  {
    key: 'spo2',
    group: 'spo2',
    name: 'Blood oxygen (SpO2)',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    unit: U.PERCENT,
    min: 0,
    max: 100,
  },
  {
    key: 'stress',
    group: 'stress',
    name: 'Stress score',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    min: 0,
    max: 99,
  },
  // `probe`, not `decimal`: a body temperature must never count in the room average.
  {
    key: 'body_temperature',
    group: 'body_temperature',
    name: 'Body temperature',
    category: C.TEMPERATURE_SENSOR,
    type: T.TEMPERATURE_SENSOR.PROBE,
    unit: U.CELSIUS,
    min: 30,
    max: 45,
  },
  {
    key: 'skin_temperature',
    group: 'body_temperature',
    name: 'Skin temperature',
    category: C.TEMPERATURE_SENSOR,
    type: T.TEMPERATURE_SENSOR.PROBE,
    unit: U.CELSIUS,
    min: 20,
    max: 45,
  },
  {
    key: 'weight',
    group: 'weight',
    name: 'Weight (kg)',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    min: 0,
    max: 300,
  },
  {
    key: 'bmi',
    group: 'weight',
    name: 'Body mass index',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    min: 0,
    max: 200,
  },
  {
    key: 'body_fat_rate',
    group: 'weight',
    name: 'Body fat',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    unit: U.PERCENT,
    min: 0,
    max: 100,
  },
  {
    key: 'sleep_score',
    group: 'sleep',
    name: 'Sleep score',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    min: 0,
    max: 100,
  },
  {
    key: 'sleep_total',
    group: 'sleep',
    name: 'Sleep duration',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.MINUTES,
    min: 0,
    max: 1440,
  },
  {
    key: 'sleep_deep',
    group: 'sleep',
    name: 'Deep sleep',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.MINUTES,
    min: 0,
    max: 1440,
  },
  {
    key: 'sleep_light',
    group: 'sleep',
    name: 'Light sleep',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.MINUTES,
    min: 0,
    max: 1440,
  },
  {
    key: 'sleep_rem',
    group: 'sleep',
    name: 'REM sleep',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.MINUTES,
    min: 0,
    max: 1440,
  },
];

export function enabledFeatures(config) {
  return FEATURES.filter((feature) => config.data_groups.includes(feature.group));
}

export const account = {
  key: DEVICE_TYPE,

  ids(gladys, accountId) {
    return gladys.externalIds(DEVICE_TYPE, accountId);
  },

  deviceExternalId(gladys, accountId) {
    return this.ids(gladys, accountId).device;
  },

  featureExternalId(gladys, accountId, featureKey) {
    return this.ids(gladys, accountId).feature(featureKey);
  },

  buildDevice(gladys, { accountId, accountName, config }) {
    const ids = this.ids(gladys, accountId);
    return {
      name: accountName ? `Huawei Health - ${accountName}` : 'Huawei Health',
      external_id: ids.device,
      model: 'Huawei Health',
      features: enabledFeatures(config).map((feature) => ({
        name: feature.name,
        external_id: ids.feature(feature.key),
        category: feature.category,
        type: feature.type,
        unit: feature.unit,
        min: feature.min,
        max: feature.max,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      })),
    };
  },

  /**
   * States of a snapshot: one per enabled feature that has a value. A metric
   * the account never measured stays without state rather than reading 0.
   */
  buildStates(gladys, { accountId, config, values }) {
    const ids = this.ids(gladys, accountId);
    return enabledFeatures(config)
      .filter(
        (feature) =>
          typeof values[feature.key] === 'number' && Number.isFinite(values[feature.key]),
      )
      .map((feature) => ({
        device_feature_external_id: ids.feature(feature.key),
        state: values[feature.key],
      }));
  },
};
