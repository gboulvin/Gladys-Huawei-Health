import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { DATA_GROUPS, mergeConfigUpdate, normalizeConfig } from '../src/config.js';
import { account } from '../src/devices/account.js';
import { clockTime, dayString, fieldValue, pointTime, utcOffset } from '../src/health.js';
import { HuaweiHealthClient } from '../src/huawei/client.js';
import { scopesFor } from '../src/huawei/dataTypes.js';
import { buildAuthorizeUrl, decodeIdToken, generateState, isExpired } from '../src/huawei/oauth.js';
import { LANGUAGES, MESSAGES, message } from '../src/i18n.js';
import { idToken } from './helpers/fakeHuawei.js';

test('normalizeConfig bounds the values and falls back on bad input', () => {
  const config = normalizeConfig({
    poll_frequency: '30',
    timezone: 'Mars/Olympus',
    data_groups: ['sleep', 'unknown', 'activity'],
    step_goal: 'abc',
  });
  assert.equal(config.poll_frequency, 300);
  assert.equal(config.timezone, 'Europe/Paris');
  assert.deepEqual(config.data_groups, ['activity', 'sleep']);
  assert.equal(config.step_goal, 10000);
  assert.deepEqual(normalizeConfig().data_groups, DATA_GROUPS);
});

test('a form update never drops the stored tokens', () => {
  const current = normalizeConfig({ client_id: 'a', refresh_token: 'r', account_id: 'x' });
  const merged = mergeConfigUpdate(current, { client_id: 'a', step_goal: 8000 });
  assert.equal(merged.refresh_token, 'r');
  assert.equal(merged.step_goal, 8000);
});

test('the authorize URL asks offline access with the scopes of the enabled groups', () => {
  const state = generateState();
  assert.match(state, /^[0-9a-f]{32}$/, 'the state stays in the alphabet Huawei documents');
  const url = new URL(
    buildAuthorizeUrl({ clientId: '1', redirectUri: 'https://r/cb', groups: ['sleep'], state }),
  );
  assert.equal(
    url.origin + url.pathname,
    'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize',
  );
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(
    url.searchParams.get('scope'),
    'openid profile https://www.huawei.com/healthkit/sleep.read',
  );
  assert.ok(
    scopesFor(DATA_GROUPS)
      .split(' ')
      .every((s) => s === 'openid' || s === 'profile' || s.endsWith('.read')),
  );
});

test('id tokens and expiries are read defensively', () => {
  assert.equal(decodeIdToken(idToken({ sub: 'x' })).sub, 'x');
  assert.deepEqual(decodeIdToken('garbage'), {});
  assert.deepEqual(decodeIdToken(undefined), {});
  assert.equal(isExpired(undefined), true);
  assert.equal(isExpired(Date.now() + 60_000), true, 'refreshed a little early');
  assert.equal(isExpired(Date.now() + 3600_000), false);
});

test('sample points: every numeric flavour, nanosecond times', () => {
  const point = {
    endTime: 1_700_000_000_000_000_000,
    value: [
      { fieldName: 'a', floatValue: 1.5 },
      { fieldName: 'b', integerValue: 2 },
      { fieldName: 'c', longValue: 3 },
    ],
  };
  assert.deepEqual(
    ['a', 'b', 'c', 'd'].map((f) => fieldValue(point, f)),
    [1.5, 2, 3, undefined],
  );
  assert.equal(pointTime(point), 1_700_000_000_000);
  assert.equal(pointTime(undefined), undefined);
});

test('days, offsets and clock times follow the configured time zone', () => {
  const summer = Date.UTC(2026, 6, 1, 22, 30);
  assert.equal(dayString(summer, 'Europe/Paris'), '20260702');
  assert.equal(dayString(summer, 'UTC'), '20260701');
  assert.equal(utcOffset(summer, 'Europe/Paris'), '+0200');
  assert.equal(utcOffset(Date.UTC(2026, 11, 1), 'Europe/Paris'), '+0100');
  assert.equal(utcOffset(summer, 'America/New_York'), '-0400');
  assert.equal(clockTime(summer, 'Europe/Paris'), '00:30');
});

test('the client never follows a site redirection outside Huawei', async () => {
  const calls = [];
  const client = new HuaweiHealthClient({
    getAccessToken: async () => 't',
    clientId: '1',
    fetchImpl: async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ error: { code: 121001 } }), {
        status: 403,
        headers: { location: 'https://evil.example/healthkit/v2/profile/privacyRecords' },
      });
    },
  });
  await assert.rejects(client.privacyRecords(), /403/);
  assert.equal(calls.length, 1);
});

test('the account device is accepted by Gladys, without any feature for a disabled group', async () => {
  const gladys = createFakeGladys({ selector: 'huawei-health' });
  const config = normalizeConfig({ data_groups: ['weight'] });
  const device = account.buildDevice(gladys, { accountId: 'abc', config });
  await gladys.publishDiscoveredDevices([device]);
  assert.deepEqual(
    device.features.map((f) => f.external_id),
    ['weight', 'bmi', 'body_fat_rate'].map((k) => `ext:huawei-health:account:abc:${k}`),
  );
  const states = account.buildStates(gladys, {
    accountId: 'abc',
    config,
    values: { weight: 70, bmi: undefined, steps: 10 },
  });
  assert.deepEqual(states, [
    { device_feature_external_id: 'ext:huawei-health:account:abc:weight', state: 70 },
  ]);
});

test('the full device is accepted by Gladys', async () => {
  const gladys = createFakeGladys({ selector: 'huawei-health' });
  const device = account.buildDevice(gladys, { accountId: 'abc', config: normalizeConfig() });
  const response = await gladys.publishDiscoveredDevices([device]);
  assert.equal(response.success, true);
  const temperatures = device.features.filter((f) => f.category === 'temperature-sensor');
  assert.ok(
    temperatures.every((f) => f.type === 'probe'),
    'body temperatures stay out of room averages',
  );
});

test('every message exists in the four languages, placeholders filled', () => {
  for (const [key, texts] of Object.entries(MESSAGES)) {
    assert.deepEqual(Object.keys(texts).sort(), [...LANGUAGES].sort(), key);
  }
  const filled = message('connectionOk', { devices: 'Watch' });
  for (const language of LANGUAGES) {
    assert.ok(filled[language].includes('Watch') && !filled[language].includes('{'));
  }
});
