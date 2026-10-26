// -----------------------------------------------------------------------------
// In-memory Huawei cloud for the tests: the Huawei ID token endpoint and the
// Health Service Kit endpoints the integration reads, behind a `fetch`
// replacement. Tests never touch the network.
// -----------------------------------------------------------------------------

import { DATA_TYPES } from '../../src/huawei/dataTypes.js';

const NS = 1_000_000;

export function idToken(claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(claims)}.signature`;
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const point = (dataTypeName, time, fields) => ({
  startTime: time * NS,
  endTime: time * NS,
  dataTypeName,
  value: Object.entries(fields).map(([fieldName, value]) =>
    Number.isInteger(value) ? { fieldName, integerValue: value } : { fieldName, floatValue: value },
  ),
});

export function createFakeHuawei({ now = Date.UTC(2026, 9, 26, 10, 0, 0) } = {}) {
  const state = {
    now,
    calls: [],
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    tokenCounter: 1,
    // Data types answering 403 (scope not granted).
    forbidden: new Set(),
    // The site holding the account: requests to another one answer 121001.
    site: 'https://health-api.cloud.huawei.com',
    refreshFails: false,
    rejectNextAccessToken: false,
    privacyOpinion: 1,
    data: {
      steps: 8200,
      calories: 310.4,
      distance: 6100.6,
      heartRate: { bpm: 72, time: now - 10 * 60 * 1000 },
      restingHeartRate: 58,
      hrv: 41,
      spo2: { saturation: 97, time: now - 30 * 60 * 1000 },
      stress: { score: 35, grade: 2, time: now - 20 * 60 * 1000 },
      bodyTemperature: 36.6,
      skinTemperature: 33.1,
      weight: { body_weight: 72.4, bmi: 23.1, body_fat_rate: 18.2, time: now - 3600 * 1000 },
      sleep: {
        fall_asleep_time: now - 10 * 3600 * 1000,
        wakeup_time: now - 3 * 3600 * 1000,
        all_sleep_time: 412,
        deep_sleep_time: 95,
        light_sleep_time: 230,
        dream_time: 87,
        wakeup_count: 2,
        sleep_score: 81,
      },
    },
  };

  function checkAuth(request) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${state.accessToken}` || state.rejectNextAccessToken) {
      state.rejectNextAccessToken = false;
      return json(401, { error: { code: 401, message: 'Invalid Credentials' } });
    }
    return undefined;
  }

  async function tokenEndpoint(request) {
    const params = new URLSearchParams(await request.text());
    state.calls.push({ path: 'token', grant: params.get('grant_type') });
    if (params.get('client_secret') !== 'secret') {
      return json(400, {
        error: 1101,
        sub_error: 12304,
        error_description: 'invalid client_secret',
      });
    }
    if (params.get('grant_type') === 'authorization_code') {
      if (params.get('code') !== 'good-code') {
        return json(400, { error: 1101, sub_error: 20155, error_description: 'invalid code' });
      }
      return json(200, {
        access_token: state.accessToken,
        refresh_token: state.refreshToken,
        expires_in: 3600,
        id_token: idToken({ sub: 'open-id-of-user', display_name: 'Alex' }),
        token_type: 'Bearer',
      });
    }
    if (state.refreshFails || params.get('refresh_token') !== state.refreshToken) {
      return json(400, {
        error: 1203,
        sub_error: 11205,
        error_description: 'refresh token expired',
      });
    }
    state.tokenCounter += 1;
    state.accessToken = `access-${state.tokenCounter}`;
    return json(200, { access_token: state.accessToken, expires_in: 3600, token_type: 'Bearer' });
  }

  const forbidden = () => json(403, { error: { code: 403, message: 'Insufficient Permission' } });

  async function healthEndpoint(request, url) {
    const path = url.pathname.replace('/healthkit/v2', '');
    state.calls.push({ path, origin: url.origin });
    if (url.origin !== state.site) {
      return json(
        403,
        { error: { code: 121001, message: 'request forbidden due to site cross' } },
        { location: `${state.site}${url.pathname}` },
      );
    }
    const unauthorized = checkAuth(request);
    if (unauthorized) return unauthorized;
    const d = state.data;

    if (path === '/sampleSets/latestSamplePoint') {
      const types = url.searchParams.getAll('dataType');
      if (types.some((type) => state.forbidden.has(type))) return forbidden();
      const all = {
        [DATA_TYPES.HEART_RATE]: point(DATA_TYPES.HEART_RATE, d.heartRate.time, {
          bpm: d.heartRate.bpm + 0.4,
        }),
        [DATA_TYPES.HEART_RATE_VARIABILITY]: point(DATA_TYPES.HEART_RATE_VARIABILITY, now, {
          heartRateVariabilityRMSSD: d.hrv,
        }),
        [DATA_TYPES.SPO2]: point(DATA_TYPES.SPO2, d.spo2.time, {
          saturation: d.spo2.saturation + 0.2,
        }),
        [DATA_TYPES.STRESS]: point(DATA_TYPES.STRESS, d.stress.time, {
          score: d.stress.score,
          grade: d.stress.grade,
        }),
        [DATA_TYPES.BODY_TEMPERATURE]: point(DATA_TYPES.BODY_TEMPERATURE, now, {
          temperature: d.bodyTemperature,
        }),
        [DATA_TYPES.SKIN_TEMPERATURE]: point(DATA_TYPES.SKIN_TEMPERATURE, now, {
          temperature: d.skinTemperature,
        }),
        [DATA_TYPES.BODY_WEIGHT]: point(DATA_TYPES.BODY_WEIGHT, d.weight.time, {
          body_weight: d.weight.body_weight + 0.01,
          bmi: d.weight.bmi,
          body_fat_rate: d.weight.body_fat_rate,
        }),
      };
      return json(200, {
        samplePoints: Object.fromEntries(
          types.filter((type) => all[type]).map((type) => [type, all[type]]),
        ),
      });
    }

    if (path === '/sampleSet:dailyPolymerize') {
      const body = await request.json();
      const [type] = body.dataTypes;
      if (state.forbidden.has(type)) return forbidden();
      const totals = {
        [DATA_TYPES.STEPS_DELTA]: [DATA_TYPES.STEPS_TOTAL, 'steps', d.steps],
        [DATA_TYPES.CALORIES_BURNT]: [DATA_TYPES.CALORIES_TOTAL, 'calories_total', d.calories],
        [DATA_TYPES.DISTANCE_DELTA]: [DATA_TYPES.DISTANCE_TOTAL, 'distance', d.distance],
      }[type];
      // Two days: yesterday (half the value) and today (Europe/Paris, +0100 in late October).
      const todayStart = Date.UTC(2026, 9, 25, 23, 0, 0);
      const group = (start, value) => ({
        startTime: start,
        endTime: start + 86_399_999,
        sampleSet: [{ samplePoints: [point(totals[0], start + 3600_000, { [totals[1]]: value })] }],
      });
      return json(200, {
        group: [
          group(todayStart - 86_400_000, Math.round(totals[2] / 2)),
          group(todayStart, totals[2]),
        ],
      });
    }

    if (path === '/sampleSet:polymerize') {
      const body = await request.json();
      const types = body.polymerizeWith.map((rule) => rule.dataTypeName);
      if (types.some((type) => state.forbidden.has(type))) return forbidden();
      return json(200, {
        group: [
          {
            sampleSet: [
              {
                samplePoints: [
                  point(DATA_TYPES.RESTING_HEART_RATE, now - 2 * 86_400_000, { bpm: 61 }),
                  point(DATA_TYPES.RESTING_HEART_RATE, now - 3600_000, { bpm: d.restingHeartRate }),
                ],
              },
            ],
          },
        ],
      });
    }

    if (path === '/healthRecords') {
      if (state.forbidden.has(DATA_TYPES.SLEEP_RECORD)) return forbidden();
      const s = d.sleep;
      return json(200, {
        healthRecords: [
          {
            startTime: s.fall_asleep_time * NS,
            endTime: s.wakeup_time * NS,
            dataTypeName: DATA_TYPES.SLEEP_RECORD,
            value: [
              ...Object.entries(s).map(([fieldName, value]) =>
                fieldName.endsWith('_time') && value > 1e12
                  ? { fieldName, longValue: value }
                  : { fieldName, integerValue: value },
              ),
              { fieldName: 'sleep_type', integerValue: 1 },
            ],
          },
          {
            // A nap: never the night.
            startTime: (now - 2 * 3600_000) * NS,
            endTime: (now - 3600_000) * NS,
            dataTypeName: DATA_TYPES.SLEEP_RECORD,
            value: [
              { fieldName: 'all_sleep_time', integerValue: 40 },
              { fieldName: 'sleep_type', integerValue: 3 },
            ],
          },
        ],
      });
    }

    if (path === '/dataCollectors') {
      const collector = (uniqueId, modelNum, devType) => ({
        collectorId: `raw:${uniqueId}`,
        deviceInfo: { uniqueId, devType, modelNum, manufacturer: 'HUAWEI' },
      });
      return json(200, {
        dataCollector: [
          collector('watch-1', 'HUAWEI WATCH GT 5', 'Watch'),
          collector('watch-1', 'HUAWEI WATCH GT 5', 'Watch'),
          collector('scale-1', 'HUAWEI Scale 3', 'Scale'),
        ],
      });
    }

    if (path === '/profile/privacyRecords') {
      return json(200, [{ opinion: state.privacyOpinion }]);
    }
    return json(404, { error: { code: 404, message: 'not found' } });
  }

  async function fetchImpl(input, init = {}) {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === 'oauth-login.cloud.huawei.com' && url.pathname === '/oauth2/v3/token') {
      return tokenEndpoint(request);
    }
    if (url.hostname.startsWith('health-api.cloud.huawei.')) {
      return healthEndpoint(request, url);
    }
    throw new Error(`Unexpected request to ${url}`);
  }

  return { state, fetchImpl };
}
