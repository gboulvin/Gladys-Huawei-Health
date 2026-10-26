import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_TYPES } from '../src/huawei/dataTypes.js';
import { FEATURES } from '../src/devices/account.js';
import { REDIRECT_URI, SELECTOR, link, setup } from './helpers/setup.js';

const featureId = (service, key) => `ext:${SELECTOR}:account:${service.accountId}:${key}`;

test('without credentials, the status asks for the Huawei app', async () => {
  const { gladys, service } = await setup({ config: { client_id: '', client_secret: '' } });
  await service.sync();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /Client ID/);
  assert.deepEqual(gladys.fake.discoveredDevices, []);
  const ack = await gladys.fake.oauthAuthorizeUrl('huawei_account', REDIRECT_URI);
  assert.equal(ack.success, false, 'no authorize URL without a client id');
});

test('configured but not linked: the status asks to click Connect', async () => {
  const { gladys, service } = await setup();
  await service.sync();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Connecter/);
});

test('the Connect round trip stores the tokens and publishes the account device', async () => {
  const { gladys, huawei, service } = await setup();
  const ack = await link(gladys, huawei);
  service.stop();
  assert.equal(ack.success, true, ack.error);
  assert.equal(gladys.fake.config.refresh_token, 'refresh-1');
  assert.equal(gladys.fake.config.token_client_id, '101234567');
  assert.match(gladys.fake.config.account_id, /^[0-9a-f]{16}$/);
  assert.ok(!gladys.fake.config.account_id.includes('open-id'), 'the OpenID is never stored raw');
  assert.equal(gladys.fake.connectionStatus.connected, true);

  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.name, 'Huawei Health - Alex');
  assert.equal(device.features.length, FEATURES.length);
  assert.ok(device.features.every((f) => f.read_only));
});

test('a callback with an unknown state is refused', async () => {
  const { gladys } = await setup();
  const ack = await gladys.fake.oauthCallback('huawei_account', {
    code: 'good-code',
    state: 'forged',
    redirectUri: REDIRECT_URI,
  });
  assert.equal(ack.success, false);
  assert.equal(gladys.fake.config.refresh_token, undefined);
});

test('a sync publishes one state per measured metric', async () => {
  const { gladys, service } = await setup({ linked: true });
  const result = await service.sync();
  assert.deepEqual(result, { ok: true, failedGroups: [] });
  const expected = {
    steps: 8200,
    active_calories: 310,
    distance: 6101,
    heart_rate: 72,
    resting_heart_rate: 58,
    heart_rate_variability: 41,
    spo2: 97,
    stress: 35,
    body_temperature: 36.6,
    skin_temperature: 33.1,
    weight: 72.4,
    bmi: 23.1,
    body_fat_rate: 18.2,
    sleep_score: 81,
    sleep_total: 412,
    sleep_deep: 95,
    sleep_light: 230,
    sleep_rem: 87,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(gladys.fake.lastState(featureId(service, key)), value, key);
  }
});

test('a group without scope fails alone, the others are still read', async () => {
  const { gladys, huawei, service } = await setup({ linked: true });
  huawei.state.forbidden.add(DATA_TYPES.STRESS);
  const result = await service.sync();
  assert.equal(result.ok, true);
  assert.deepEqual(result.failedGroups, ['stress']);
  assert.equal(gladys.fake.lastState(featureId(service, 'stress')), undefined);
  assert.equal(gladys.fake.lastState(featureId(service, 'steps')), 8200);
  const ack = await gladys.fake.action('sync_now');
  assert.match(ack.data.message.en, /stress/);
});

test('an expired access token is refreshed once and saved', async () => {
  const { gladys, huawei, service } = await setup({ linked: true });
  huawei.state.now += 2 * 3600 * 1000;
  await service.sync();
  assert.equal(gladys.fake.config.access_token, 'access-2');
  assert.equal(gladys.fake.config.refresh_token, 'refresh-1', 'the refresh token is kept');
  const refreshes = huawei.state.calls.filter((c) => c.grant === 'refresh_token');
  assert.equal(refreshes.length, 1, 'concurrent requests share one refresh');
});

test('a token Huawei rejects early is refreshed and the request retried', async () => {
  const { gladys, huawei, service } = await setup({
    linked: true,
    config: { data_groups: ['spo2'] },
  });
  huawei.state.rejectNextAccessToken = true;
  const result = await service.sync();
  assert.equal(result.ok, true);
  assert.equal(gladys.fake.lastState(featureId(service, 'spo2')), 97);
});

test('a dead refresh token asks the user to reconnect', async () => {
  const { gladys, huawei, service } = await setup({ linked: true });
  huawei.state.now += 2 * 3600 * 1000;
  huawei.state.refreshFails = true;
  const result = await service.sync();
  assert.equal(result.ok, false);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /Connect again/);
});

test('the account on another Huawei site is followed and remembered', async () => {
  const { gladys, huawei, service } = await setup({
    linked: true,
    config: { data_groups: ['spo2'] },
  });
  huawei.state.site = 'https://health-api.cloud.huawei.eu';
  await service.sync();
  assert.equal(gladys.fake.config.api_base_url, 'https://health-api.cloud.huawei.eu');
  assert.equal(gladys.fake.lastState(featureId(service, 'spo2')), 97);
});

test('changing the client id unlinks the account', async () => {
  const { gladys, service } = await setup({ linked: true });
  await gladys.fake.configUpdated({ ...gladys.fake.config, client_id: '109999999' });
  service.stop();
  assert.equal(service.isLinked, false);
  assert.match(gladys.fake.connectionStatus.message.en, /Client ID changed/);
});

test('saving the form keeps the tokens and reshapes the device', async () => {
  const { gladys, service } = await setup({ linked: true });
  await gladys.fake.configUpdated({
    client_id: '101234567',
    client_secret: 'secret',
    data_groups: ['activity'],
  });
  service.stop();
  assert.equal(service.isLinked, true);
  const [device] = gladys.fake.discoveredDevices;
  assert.deepEqual(
    device.features.map((f) => f.external_id.split(':').pop()),
    ['steps', 'active_calories', 'distance'],
  );
});

test('test_connection lists the Huawei devices, or explains the privacy switch', async () => {
  const { gladys, huawei } = await setup({ linked: true });
  let ack = await gladys.fake.action('test_connection');
  assert.match(ack.data.message.en, /HUAWEI WATCH GT 5, HUAWEI Scale 3/);
  huawei.state.privacyOpinion = 2;
  ack = await gladys.fake.action('test_connection');
  assert.match(ack.data.message.en, /Privacy management/);
});

test('sign_out forgets the tokens', async () => {
  const { gladys, service } = await setup({ linked: true });
  const ack = await gladys.fake.action('sign_out');
  assert.match(ack.data.message.de, /Abgemeldet/);
  assert.equal(gladys.fake.config.refresh_token, '');
  assert.equal(service.isLinked, false);
});

test('scene events fire on new measurements, never on the first snapshot', async () => {
  const { gladys, huawei, service } = await setup({ linked: true });
  await service.sync();
  assert.equal(gladys.fake.sceneEvents.length, 0, 'baseline');

  const d = huawei.state.data;
  d.steps = 10400;
  d.heartRate = { bpm: 131, time: huawei.state.now + 60_000 };
  d.spo2 = { saturation: 89, time: huawei.state.now + 60_000 };
  d.weight = { ...d.weight, body_weight: 71.9, time: huawei.state.now + 60_000 };
  d.sleep = { ...d.sleep, wakeup_time: d.sleep.wakeup_time + 60_000 };
  await service.sync();

  const byKey = Object.fromEntries(gladys.fake.sceneEvents.map((e) => [e.key, e.data]));
  assert.deepEqual(byKey.step_goal_reached, { steps: 10400, step_goal: 10000 });
  assert.deepEqual(byKey.heart_rate_alert, { direction: 'high', heart_rate: 131 });
  assert.deepEqual(byKey.spo2_low, { spo2: 89 });
  assert.equal(byKey.weight_measured.weight, 71.9);
  assert.equal(byKey.sleep_recorded.sleep_score, 81);
  assert.match(byKey.sleep_recorded.wakeup_time, /^\d{2}:\d{2}$/);

  // Nothing new: nothing fires, the step goal fires once a day.
  const count = gladys.fake.sceneEvents.length;
  await service.sync();
  assert.equal(gladys.fake.sceneEvents.length, count);
});
