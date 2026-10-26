import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup } from './helpers/setup.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const declared = (key, list) =>
  manifest[list]
    .find((entry) => entry.key === key)
    [list === 'scene_actions' ? 'outputs' : 'variables'].map((v) => v.key);

test('get_health_summary returns the declared outputs, synchronizing when asked', async () => {
  const { gladys } = await setup({ linked: true });
  const ack = await gladys.fake.sceneAction('get_health_summary', { refresh: true });
  assert.equal(ack.success, true, ack.error);
  const { outputs } = ack.data;
  assert.deepEqual(
    Object.keys(outputs).sort(),
    declared('get_health_summary', 'scene_actions').sort(),
  );
  assert.equal(outputs.synced, true);
  assert.equal(outputs.steps, 8200);
  assert.equal(outputs.sleep_minutes, 412);
  for (const value of Object.values(outputs)) {
    assert.ok(['number', 'string', 'boolean'].includes(typeof value), 'scalars only');
  }
});

test('refresh_data reports a failed sync as an output, not an error', async () => {
  const { gladys, huawei } = await setup({ linked: true });
  huawei.state.now += 2 * 3600 * 1000;
  huawei.state.refreshFails = true;
  const ack = await gladys.fake.sceneAction('refresh_data', {});
  assert.equal(ack.success, true);
  assert.deepEqual(ack.data.outputs, { synced: false });
});

test('scene events only carry declared keys', async () => {
  const { gladys, huawei, service } = await setup({ linked: true });
  await service.sync();
  const d = huawei.state.data;
  d.steps = 12000;
  d.heartRate = { bpm: 35, time: huawei.state.now + 1 };
  d.spo2 = { saturation: 88, time: huawei.state.now + 1 };
  d.weight = { ...d.weight, time: huawei.state.now + 1 };
  d.sleep = { ...d.sleep, wakeup_time: d.sleep.wakeup_time + 1 };
  await service.sync();
  assert.equal(gladys.fake.sceneEvents.length, 5);
  for (const event of gladys.fake.sceneEvents) {
    const trigger = manifest.scene_triggers.find((t) => t.key === event.key);
    const allowed = [...(trigger.fields ?? []), ...(trigger.variables ?? [])].map((f) => f.key);
    for (const key of Object.keys(event.data)) {
      assert.ok(allowed.includes(key), `${event.key}.${key} is not declared`);
    }
  }
  const alert = gladys.fake.sceneEvents.find((e) => e.key === 'heart_rate_alert');
  assert.equal(alert.data.direction, 'low');
});
