// -----------------------------------------------------------------------------
// Read a snapshot of the user's health data from the Huawei Health cloud.
//
// Every data group is read independently: a scope the user did not grant, or a
// data type their watch does not measure, must not hide the others. A group
// that fails lands in `errors` and its values stay undefined.
//
// All the watches, bands and scales paired with the Huawei Health app write to
// the same account: the snapshot is the account's view, merged by Huawei.
// -----------------------------------------------------------------------------

import { DATA_TYPES } from './huawei/dataTypes.js';

const NS_PER_MS = 1_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

// How far back a "latest" value is still worth showing.
const SLEEP_LOOKBACK_MS = 36 * 60 * 60 * 1000;
const RESTING_HEART_RATE_LOOKBACK_MS = 3 * DAY_MS;
export const ACTIVITY_HISTORY_DAYS = 7;

/** Value of one field of a sample point, whatever its numeric flavour. */
export function fieldValue(point, fieldName) {
  const field = point?.value?.find((entry) => entry.fieldName === fieldName);
  if (!field) {
    return undefined;
  }
  const value = field.floatValue ?? field.integerValue ?? field.longValue ?? field.stringValue;
  return value === undefined || value === null ? undefined : value;
}

/** End time of a sample point, in milliseconds (Huawei sends nanoseconds). */
export function pointTime(point) {
  const time = Number(point?.endTime ?? point?.startTime);
  return Number.isFinite(time) ? Math.round(time / NS_PER_MS) : undefined;
}

function round(value, digits = 1) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return undefined;
  }
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

/** `yyyyMMdd` of an instant, in a time zone. */
export function dayString(time, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}${get('month')}${get('day')}`;
}

/** `+0100`-style offset of a time zone at an instant, as Huawei expects it. */
export function utcOffset(time, timeZone) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(time))
    .find((part) => part.type === 'timeZoneName').value;
  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : '+0000';
}

/** `HH:mm` of an instant, in a time zone. */
export function clockTime(time, timeZone) {
  if (!time) {
    return undefined;
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(time));
}

function allPoints(response) {
  return (response?.group ?? []).flatMap((group) =>
    (group.sampleSet ?? []).flatMap((set) => set.samplePoints ?? []),
  );
}

function latestPoint(points) {
  return points.reduce(
    (latest, point) =>
      latest === undefined || (pointTime(point) ?? 0) > (pointTime(latest) ?? 0) ? point : latest,
    undefined,
  );
}

// --- Activity ----------------------------------------------------------------

async function readActivity(client, { now, timeZone }) {
  const endDay = dayString(now, timeZone);
  const startDay = dayString(now - (ACTIVITY_HISTORY_DAYS - 1) * DAY_MS, timeZone);
  const query = (dataType) =>
    client.dailyPolymerize({
      dataTypes: [dataType],
      startDay,
      endDay,
      timeZone: utcOffset(now, timeZone),
    });
  // One request per type: Huawei refuses the whole request when one type is
  // not supported for the account.
  const [steps, calories, distance] = await Promise.all([
    query(DATA_TYPES.STEPS_DELTA),
    query(DATA_TYPES.CALORIES_BURNT),
    query(DATA_TYPES.DISTANCE_DELTA),
  ]);

  const perDay = (response, fieldName) => {
    const days = new Map();
    for (const group of response?.group ?? []) {
      const day = dayString(Number(group.startTime), timeZone);
      const total = (group.sampleSet ?? [])
        .flatMap((set) => set.samplePoints ?? [])
        .reduce((sum, point) => sum + Number(fieldValue(point, fieldName) ?? 0), 0);
      days.set(day, (days.get(day) ?? 0) + total);
    }
    return days;
  };
  const stepsPerDay = perDay(steps, 'steps');
  const caloriesPerDay = perDay(calories, 'calories_total');
  const distancePerDay = perDay(distance, 'distance');

  const history = [];
  for (let i = ACTIVITY_HISTORY_DAYS - 1; i >= 0; i -= 1) {
    const day = dayString(now - i * DAY_MS, timeZone);
    history.push({ day, steps: Math.round(stepsPerDay.get(day) ?? 0) });
  }
  return {
    day: endDay,
    steps: Math.round(stepsPerDay.get(endDay) ?? 0),
    active_calories: Math.round(caloriesPerDay.get(endDay) ?? 0),
    distance: Math.round(distancePerDay.get(endDay) ?? 0),
    steps_history: history,
  };
}

// --- Latest instantaneous values ---------------------------------------------

async function readLatest(client, dataTypes) {
  const response = await client.latestSamplePoints(dataTypes);
  return response?.samplePoints ?? {};
}

async function readHeartRate(client, { now }) {
  const [latest, resting] = await Promise.all([
    readLatest(client, [DATA_TYPES.HEART_RATE, DATA_TYPES.HEART_RATE_VARIABILITY]),
    // The resting heart rate is not served by the "latest" endpoint: read the
    // last days of details and keep the newest point.
    client.polymerize({
      dataTypes: [DATA_TYPES.RESTING_HEART_RATE],
      startTime: now - RESTING_HEART_RATE_LOOKBACK_MS,
      endTime: now,
    }),
  ]);
  const heartRate = latest[DATA_TYPES.HEART_RATE];
  const hrv = latest[DATA_TYPES.HEART_RATE_VARIABILITY];
  const restingPoint = latestPoint(allPoints(resting));
  return {
    heart_rate: round(fieldValue(heartRate, 'bpm'), 0),
    heart_rate_time: pointTime(heartRate),
    resting_heart_rate: round(fieldValue(restingPoint, 'bpm'), 0),
    heart_rate_variability: round(fieldValue(hrv, 'heartRateVariabilityRMSSD'), 0),
  };
}

async function readSpo2(client) {
  const point = (await readLatest(client, [DATA_TYPES.SPO2]))[DATA_TYPES.SPO2];
  return { spo2: round(fieldValue(point, 'saturation'), 0), spo2_time: pointTime(point) };
}

async function readStress(client) {
  const point = (await readLatest(client, [DATA_TYPES.STRESS]))[DATA_TYPES.STRESS];
  return {
    stress: round(fieldValue(point, 'score'), 0),
    stress_grade: fieldValue(point, 'grade'),
    stress_time: pointTime(point),
  };
}

async function readBodyTemperature(client) {
  const latest = await readLatest(client, [
    DATA_TYPES.BODY_TEMPERATURE,
    DATA_TYPES.SKIN_TEMPERATURE,
  ]);
  return {
    body_temperature: round(fieldValue(latest[DATA_TYPES.BODY_TEMPERATURE], 'temperature')),
    skin_temperature: round(fieldValue(latest[DATA_TYPES.SKIN_TEMPERATURE], 'temperature')),
  };
}

async function readWeight(client) {
  const point = (await readLatest(client, [DATA_TYPES.BODY_WEIGHT]))[DATA_TYPES.BODY_WEIGHT];
  return {
    weight: round(fieldValue(point, 'body_weight')),
    bmi: round(fieldValue(point, 'bmi')),
    body_fat_rate: round(fieldValue(point, 'body_fat_rate')),
    weight_time: pointTime(point),
  };
}

// --- Sleep -------------------------------------------------------------------

async function readSleep(client, { now }) {
  const response = await client.healthRecords({
    dataType: DATA_TYPES.SLEEP_RECORD,
    startTimeNs: (now - SLEEP_LOOKBACK_MS) * NS_PER_MS,
    endTimeNs: now * NS_PER_MS,
  });
  // Naps are records too (sleep_type 3): the night is the longest record.
  const records = (response?.healthRecords ?? []).filter(
    (record) => record.dataTypeName === DATA_TYPES.SLEEP_RECORD,
  );
  const night = records
    .filter((record) => Number(fieldValue(record, 'sleep_type')) !== 3)
    .sort((a, b) => (pointTime(b) ?? 0) - (pointTime(a) ?? 0))[0];
  if (!night) {
    return {};
  }
  const wakeup = Number(fieldValue(night, 'wakeup_time')) || pointTime(night);
  return {
    sleep_score: fieldValue(night, 'sleep_score'),
    sleep_total: fieldValue(night, 'all_sleep_time'),
    sleep_deep: fieldValue(night, 'deep_sleep_time'),
    sleep_light: fieldValue(night, 'light_sleep_time'),
    sleep_rem: fieldValue(night, 'dream_time'),
    sleep_wakeup_count: fieldValue(night, 'wakeup_count'),
    sleep_start: Number(fieldValue(night, 'fall_asleep_time')) || undefined,
    sleep_end: wakeup,
  };
}

const READERS = {
  activity: readActivity,
  heart_rate: readHeartRate,
  spo2: readSpo2,
  stress: readStress,
  body_temperature: readBodyTemperature,
  weight: readWeight,
  sleep: readSleep,
};

/**
 * Read every enabled data group. Resolves `{ values, errors, synced_at }`:
 * `errors` maps a group to the error that prevented reading it.
 */
export async function fetchSnapshot(client, config, now = Date.now()) {
  const groups = config.data_groups.filter((group) => READERS[group]);
  const results = await Promise.allSettled(
    groups.map((group) => READERS[group](client, { now, timeZone: config.timezone })),
  );
  const values = {};
  const errors = {};
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      Object.assign(values, result.value);
    } else {
      errors[groups[index]] = result.reason;
    }
  });
  return { values, errors, synced_at: now };
}

/**
 * The devices that write to the account (watches, bands, scales, phone), from
 * the data collectors: `[{ id, name, type, manufacturer }]`, one per device.
 */
export async function fetchDevices(client) {
  const response = await client.dataCollectors();
  const devices = new Map();
  for (const collector of response?.dataCollector ?? []) {
    const info = collector.deviceInfo ?? {};
    const id = info.uniqueId ?? `${info.manufacturer}-${info.modelNum}`;
    if (!info.modelNum || devices.has(id)) {
      continue;
    }
    devices.set(id, {
      id,
      name: info.modelNum,
      type: info.devType ?? 'Unknown',
      manufacturer: info.manufacturer ?? '',
    });
  }
  return [...devices.values()];
}
