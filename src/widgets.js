// -----------------------------------------------------------------------------
// Dashboard widgets (SDK v0.14+, Gladys 5.1+).
//
// Three cards, declared in the manifest `widgets` field:
//   - health_overview : the day at a glance (steps, heart, SpO2, stress,
//                       sleep, weight) + account, last sync and devices;
//   - activity_today  : step goal gauge, calories, distance, 7-day steps chart;
//   - sleep_last_night: last night's score and phases + heart rate chart.
//
// The tiles are COMPUTED from the last snapshot rather than bound to device
// features: they work even when the user did not create the Gladys device.
// The service nudges every widget after each sync (refreshWidgets), the TTL is
// only a safety net. Texts are multi-language objects, picked by the core.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { account } from './devices/account.js';
import { clockTime } from './health.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = {
  OVERVIEW: 'health_overview',
  ACTIVITY: 'activity_today',
  SLEEP: 'sleep_last_night',
};

const REFRESH_ACTION = 'refresh';
const TTL_SECONDS = 900;

const L = {
  steps: { en: 'Steps', fr: 'Pas', de: 'Schritte', es: 'Pasos' },
  heartRate: {
    en: 'Heart rate',
    fr: 'Fréquence cardiaque',
    de: 'Herzfrequenz',
    es: 'Frecuencia cardiaca',
  },
  restingHeartRate: { en: 'Resting HR', fr: 'FC au repos', de: 'Ruhepuls', es: 'FC en reposo' },
  spo2: { en: 'SpO2', fr: 'SpO2', de: 'SpO2', es: 'SpO2' },
  stress: { en: 'Stress', fr: 'Stress', de: 'Stress', es: 'Estrés' },
  sleepScore: { en: 'Sleep score', fr: 'Score sommeil', de: 'Schlafwert', es: 'Puntuación sueño' },
  weight: { en: 'Weight', fr: 'Poids', de: 'Gewicht', es: 'Peso' },
  calories: {
    en: 'Active calories',
    fr: 'Calories actives',
    de: 'Aktivkalorien',
    es: 'Calorías activas',
  },
  distance: { en: 'Distance', fr: 'Distance', de: 'Strecke', es: 'Distancia' },
  goal: { en: 'Step goal', fr: 'Objectif de pas', de: 'Schrittziel', es: 'Objetivo de pasos' },
  totalSleep: { en: 'Total sleep', fr: 'Sommeil total', de: 'Schlafdauer', es: 'Sueño total' },
  deepSleep: { en: 'Deep sleep', fr: 'Sommeil profond', de: 'Tiefschlaf', es: 'Sueño profundo' },
  lightSleep: { en: 'Light sleep', fr: 'Sommeil léger', de: 'Leichtschlaf', es: 'Sueño ligero' },
  remSleep: { en: 'REM sleep', fr: 'Sommeil paradoxal', de: 'REM-Schlaf', es: 'Sueño REM' },
  fellAsleep: { en: 'Fell asleep', fr: 'Endormi à', de: 'Eingeschlafen', es: 'Se durmió' },
  wokeUp: { en: 'Woke up', fr: 'Réveillé à', de: 'Aufgewacht', es: 'Se despertó' },
  awakenings: { en: 'Awakenings', fr: 'Réveils', de: 'Wachphasen', es: 'Despertares' },
  account: { en: 'Account', fr: 'Compte', de: 'Konto', es: 'Cuenta' },
  lastSync: {
    en: 'Last sync',
    fr: 'Dernière synchro',
    de: 'Letzte Synchronisierung',
    es: 'Última sincronización',
  },
  devices: { en: 'Devices', fr: 'Appareils', de: 'Geräte', es: 'Dispositivos' },
  refresh: { en: 'Refresh', fr: 'Rafraîchir', de: 'Aktualisieren', es: 'Actualizar' },
  stepsWeek: {
    en: 'Steps, last 7 days',
    fr: 'Pas, 7 derniers jours',
    de: 'Schritte, 7 Tage',
    es: 'Pasos, 7 días',
  },
  heartRateNight: {
    en: 'Heart rate, 24 h',
    fr: 'Fréquence cardiaque, 24 h',
    de: 'Herzfrequenz, 24 h',
    es: 'Frecuencia cardiaca, 24 h',
  },
  never: { en: 'Never', fr: 'Jamais', de: 'Nie', es: 'Nunca' },
  noDevice: { en: 'None yet', fr: 'Aucun', de: 'Keine', es: 'Ninguno' },
  notLinked: {
    en: 'Link your Huawei account in the integration configuration to see your health data here.',
    fr: "Liez votre compte Huawei dans la configuration de l'intégration pour voir vos données de santé ici.",
    de: 'Verknüpfen Sie Ihr Huawei-Konto in der Integrationskonfiguration, um hier Ihre Gesundheitsdaten zu sehen.',
    es: 'Vincule su cuenta Huawei en la configuración de la integración para ver aquí sus datos de salud.',
  },
  noData: {
    en: 'Waiting for the first sync with the Huawei Health cloud.',
    fr: 'En attente de la première synchronisation avec le cloud Huawei Santé.',
    de: 'Warten auf die erste Synchronisierung mit der Huawei Health Cloud.',
    es: 'Esperando la primera sincronización con la nube de Huawei Salud.',
  },
  refreshed: {
    en: 'Data refreshed.',
    fr: 'Données rafraîchies.',
    de: 'Daten aktualisiert.',
    es: 'Datos actualizados.',
  },
  refreshFailed: {
    en: 'Huawei Health could not be read, see the integration status.',
    fr: "Huawei Santé n'a pas pu être lu, voir l'état de l'intégration.",
    de: 'Huawei Health konnte nicht gelesen werden, siehe Integrationsstatus.',
    es: 'No se pudo leer Huawei Salud, consulte el estado de la integración.',
  },
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// A tile for a number, or a short string such as "7h32"; none without value.
function tile(label, value, { unit, icon, color } = {}) {
  const present = isNumber(value) || (typeof value === 'string' && value.length > 0);
  return present ? { type: 'value', label, value, unit, icon, color } : undefined;
}

function minutesLabel(minutes) {
  if (!isNumber(minutes)) {
    return undefined;
  }
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

function refreshButton() {
  return {
    type: 'button',
    label: L.refresh,
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: REFRESH_ACTION },
  };
}

// The card shown when there is nothing to display yet.
function emptyState(service) {
  return {
    ttl_seconds: 60,
    components: [
      { type: 'text', variant: 'body', text: service.isLinked ? L.noData : L.notLinked },
      ...(service.isLinked ? [refreshButton()] : []),
    ],
  };
}

function heartRateColor(value, config) {
  if (value >= config.heart_rate_high || value <= config.heart_rate_low) {
    return WIDGET_COLORS.DANGER;
  }
  return WIDGET_COLORS.SUCCESS;
}

function stressColor(score) {
  if (score >= 80) return WIDGET_COLORS.DANGER;
  if (score >= 60) return WIDGET_COLORS.WARNING;
  return WIDGET_COLORS.SUCCESS;
}

async function overview(service) {
  const values = service.snapshot.values;
  const { config } = service;
  let devices = [];
  try {
    devices = await service.getHuaweiDevices();
  } catch (err) {
    logger.warn(`Device list unavailable: ${err.message}`);
  }
  const tiles = [
    tile(L.steps, values.steps, { icon: 'activity', color: WIDGET_COLORS.PRIMARY }),
    tile(L.heartRate, values.heart_rate, {
      unit: 'bpm',
      icon: 'heart',
      color: isNumber(values.heart_rate) ? heartRateColor(values.heart_rate, config) : undefined,
    }),
    tile(L.spo2, values.spo2, {
      unit: '%',
      icon: 'droplet',
      color: values.spo2 < config.spo2_low ? WIDGET_COLORS.DANGER : WIDGET_COLORS.INFO,
    }),
    tile(L.stress, values.stress, {
      icon: 'zap',
      color: isNumber(values.stress) ? stressColor(values.stress) : undefined,
    }),
    tile(L.sleepScore, values.sleep_score, { icon: 'moon', color: WIDGET_COLORS.INFO }),
    tile(L.weight, values.weight, { unit: 'kg', icon: 'user', color: WIDGET_COLORS.NEUTRAL }),
  ].filter(Boolean);
  return {
    ttl_seconds: TTL_SECONDS,
    components: [
      ...tiles,
      {
        type: 'status',
        items: [
          {
            label: L.account,
            icon: 'user-check',
            value: service.config.account_name || 'Huawei ID',
            color: WIDGET_COLORS.SUCCESS,
          },
          {
            label: L.lastSync,
            icon: 'clock',
            value: clockTime(service.snapshot.synced_at, config.timezone) ?? L.never,
            color: WIDGET_COLORS.NEUTRAL,
          },
          {
            label: L.devices,
            icon: 'watch',
            value:
              devices.length > 0
                ? devices
                    .map((d) => d.name)
                    .join(', ')
                    .slice(0, 40)
                : L.noDevice,
            color: devices.length > 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
          },
        ],
      },
      refreshButton(),
    ],
  };
}

function isoDay(day) {
  return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T12:00:00.000Z`;
}

function activity(service) {
  const values = service.snapshot.values;
  const { config } = service;
  const steps = values.steps ?? 0;
  const history = values.steps_history ?? [];
  return {
    ttl_seconds: TTL_SECONDS,
    components: [
      {
        type: 'gauge',
        label: L.goal,
        value: Math.min(steps, config.step_goal),
        min: 0,
        max: config.step_goal,
        color: steps >= config.step_goal ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.PRIMARY,
      },
      tile(L.steps, values.steps, { icon: 'activity', color: WIDGET_COLORS.PRIMARY }),
      tile(L.calories, values.active_calories, {
        unit: 'kcal',
        icon: 'sun',
        color: WIDGET_COLORS.WARNING,
      }),
      tile(
        L.distance,
        isNumber(values.distance) ? Math.round(values.distance / 100) / 10 : undefined,
        {
          unit: 'km',
          icon: 'map',
          color: WIDGET_COLORS.INFO,
        },
      ),
      ...(history.length > 0
        ? [
            {
              type: 'chart',
              chart_type: 'bar',
              title: L.stepsWeek,
              series: [
                { name: L.steps, points: history.map((d) => ({ t: isoDay(d.day), v: d.steps })) },
              ],
            },
          ]
        : []),
      refreshButton(),
    ].filter(Boolean),
  };
}

function sleep(service) {
  const values = service.snapshot.values;
  const { config } = service;
  const tiles = [
    tile(L.sleepScore, values.sleep_score, { icon: 'moon', color: WIDGET_COLORS.INFO }),
    tile(L.totalSleep, minutesLabel(values.sleep_total), {
      icon: 'clock',
      color: WIDGET_COLORS.PRIMARY,
    }),
    tile(L.deepSleep, minutesLabel(values.sleep_deep), {
      icon: 'battery',
      color: WIDGET_COLORS.SUCCESS,
    }),
    tile(L.remSleep, minutesLabel(values.sleep_rem), { icon: 'eye', color: WIDGET_COLORS.WARNING }),
  ].filter(Boolean);
  const statusItems = [
    values.sleep_start && {
      label: L.fellAsleep,
      icon: 'moon',
      value: clockTime(values.sleep_start, config.timezone),
    },
    values.sleep_end && {
      label: L.wokeUp,
      icon: 'sunrise',
      value: clockTime(values.sleep_end, config.timezone),
    },
    isNumber(values.sleep_wakeup_count) && {
      label: L.awakenings,
      icon: 'alert-circle',
      value: values.sleep_wakeup_count,
    },
    isNumber(values.sleep_light) && {
      label: L.lightSleep,
      icon: 'cloud',
      value: minutesLabel(values.sleep_light),
    },
  ]
    .filter(Boolean)
    .map((item) => ({ ...item, color: WIDGET_COLORS.NEUTRAL }));
  return {
    ttl_seconds: TTL_SECONDS,
    components: [
      ...tiles,
      ...(config.data_groups.includes('heart_rate') && service.accountId
        ? [
            {
              type: 'chart',
              chart_type: 'line',
              title: L.heartRateNight,
              device_features: [
                account.featureExternalId(service.gladys, service.accountId, 'heart_rate'),
              ],
              interval: 'last-day',
            },
          ]
        : []),
      ...(statusItems.length > 0 ? [{ type: 'status', items: statusItems }] : []),
    ],
  };
}

function guard(build) {
  return async (service) => {
    if (!service.isLinked || !service.snapshot) {
      return emptyState(service);
    }
    return build(service);
  };
}

async function refreshAction(service) {
  try {
    const result = await service.sync();
    return result.ok ? L.refreshed : L.refreshFailed;
  } catch (err) {
    logger.error('Widget refresh failed', err);
    return L.refreshFailed;
  }
}

function withRefresh(key, build) {
  return {
    get: guard(build),
    async action(service, { actionKey }) {
      logger.info(`onWidgetAction <- ${key}.${actionKey}`);
      if (actionKey === REFRESH_ACTION) {
        return refreshAction(service);
      }
      throw new Error(`Unknown widget action: ${actionKey}`);
    },
  };
}

export const WIDGETS = {
  [WIDGET_KEYS.OVERVIEW]: withRefresh(WIDGET_KEYS.OVERVIEW, overview),
  [WIDGET_KEYS.ACTIVITY]: withRefresh(WIDGET_KEYS.ACTIVITY, activity),
  [WIDGET_KEYS.SLEEP]: { get: guard(sleep) },
};

/** Ask the core to re-pull every widget now (after a sync, a config change). */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
