// -----------------------------------------------------------------------------
// Scene triggers (SDK v0.14+, Gladys 5.1+).
//
// The Huawei cloud pushes nothing to a local Gladys: the events are derived
// from two consecutive snapshots. The rules that keep them honest:
//   - the first snapshot after a (re)start is a baseline, it never fires: a
//     restart must not replay last night's sleep or this morning's weigh-in;
//   - one event per new measurement (its Huawei timestamp changed) or per
//     threshold CROSSING, never one per poll while a value stays high;
//   - `data` is flat, and holds only the keys declared in the manifest
//     `fields` / `variables` of the trigger.
// -----------------------------------------------------------------------------

import { clockTime } from './health.js';

// Keys as declared in the manifest `scene_triggers` field: forever.
export const TRIGGERS = {
  SLEEP_RECORDED: 'sleep_recorded',
  STEP_GOAL_REACHED: 'step_goal_reached',
  HEART_RATE_ALERT: 'heart_rate_alert',
  SPO2_LOW: 'spo2_low',
  WEIGHT_MEASURED: 'weight_measured',
};

export const TRIGGER_KEYS = Object.values(TRIGGERS);

export class TriggerTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.previous = undefined;
    this.goalReachedDay = undefined;
  }

  /**
   * Compare a snapshot with the previous one and return the scene events to
   * publish: `[{ key, data }]`.
   */
  detect(values, { config }) {
    const previous = this.previous;
    this.previous = values;
    const events = [];

    const goalReached = typeof values.steps === 'number' && values.steps >= config.step_goal;
    if (previous === undefined) {
      // Baseline: a goal already reached before the restart is not news.
      if (goalReached) {
        this.goalReachedDay = values.day;
      }
      return events;
    }

    if (values.sleep_end && values.sleep_end !== previous.sleep_end) {
      events.push({
        key: TRIGGERS.SLEEP_RECORDED,
        data: {
          sleep_score: values.sleep_score ?? 0,
          sleep_minutes: values.sleep_total ?? 0,
          deep_sleep_minutes: values.sleep_deep ?? 0,
          wakeup_time: clockTime(values.sleep_end, config.timezone) ?? '',
        },
      });
    }

    if (goalReached && this.goalReachedDay !== values.day) {
      this.goalReachedDay = values.day;
      events.push({
        key: TRIGGERS.STEP_GOAL_REACHED,
        data: { steps: values.steps, step_goal: config.step_goal },
      });
    }

    const newHeartRate =
      typeof values.heart_rate === 'number' && values.heart_rate_time !== previous.heart_rate_time;
    if (newHeartRate) {
      const zone = heartRateZone(values.heart_rate, config);
      if (zone !== 'normal' && zone !== heartRateZone(previous.heart_rate, config)) {
        events.push({
          key: TRIGGERS.HEART_RATE_ALERT,
          data: { direction: zone, heart_rate: values.heart_rate },
        });
      }
    }

    const newSpo2 = typeof values.spo2 === 'number' && values.spo2_time !== previous.spo2_time;
    if (newSpo2 && values.spo2 < config.spo2_low && !(previous.spo2 < config.spo2_low)) {
      events.push({ key: TRIGGERS.SPO2_LOW, data: { spo2: values.spo2 } });
    }

    if (typeof values.weight === 'number' && values.weight_time !== previous.weight_time) {
      events.push({
        key: TRIGGERS.WEIGHT_MEASURED,
        data: {
          weight: values.weight,
          bmi: values.bmi ?? 0,
          body_fat_rate: values.body_fat_rate ?? 0,
        },
      });
    }
    return events;
  }
}

function heartRateZone(heartRate, config) {
  if (typeof heartRate !== 'number') {
    return 'normal';
  }
  if (heartRate >= config.heart_rate_high) {
    return 'high';
  }
  if (heartRate <= config.heart_rate_low) {
    return 'low';
  }
  return 'normal';
}
