import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGETS } from '../src/widgets.js';
import { setup } from './helpers/setup.js';

const LANG_FIELDS = ['label', 'text', 'title', 'value', 'name'];

// Every multi-language object of a content carries the four languages.
function assertFourLanguages(value, path = 'content') {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertFourLanguages(item, `${path}[${i}]`));
  } else if (value && typeof value === 'object') {
    if (typeof value.en === 'string') {
      assert.deepEqual(Object.keys(value).sort(), ['de', 'en', 'es', 'fr'], path);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (LANG_FIELDS.includes(key) || typeof child === 'object') {
        assertFourLanguages(child, `${path}.${key}`);
      }
    }
  }
}

test('before linking, every widget shows a valid empty state', async () => {
  const { gladys } = await setup();
  for (const key of Object.keys(WIDGETS)) {
    const ack = await gladys.fake.widgetGet(key);
    assert.equal(ack.success, true, ack.error);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], key);
    assert.equal(ack.data.content.components[0].type, 'text');
  }
});

test('after a sync, every widget renders exactly as sent', async () => {
  const { gladys, service } = await setup({ linked: true });
  await service.sync();
  for (const key of Object.keys(WIDGETS)) {
    const ack = await gladys.fake.widgetGet(key, { language: 'fr' });
    assert.equal(ack.success, true, ack.error);
    const { content } = ack.data;
    assert.deepEqual(validateWidgetContent(content), [], key);
    assertFourLanguages(content);
    assert.ok(content.components.length >= 4, key);
  }
});

test('the overview shows six tiles and the Huawei devices', async () => {
  const { gladys, service } = await setup({ linked: true });
  await service.sync();
  const { content } = (await gladys.fake.widgetGet('health_overview')).data;
  assert.equal(content.components.filter((c) => c.type === 'value').length, 6);
  const status = content.components.find((c) => c.type === 'status');
  assert.ok(status.items.some((item) => String(item.value).includes('WATCH GT 5')));
});

test('the activity widget charts the last 7 days', async () => {
  const { gladys, service } = await setup({ linked: true });
  await service.sync();
  const { content } = (await gladys.fake.widgetGet('activity_today')).data;
  const chart = content.components.find((c) => c.type === 'chart');
  assert.equal(chart.series[0].points.length, 7);
  assert.equal(chart.series[0].points.at(-1).v, 8200);
  const gauge = content.components.find((c) => c.type === 'gauge');
  assert.deepEqual([gauge.value, gauge.max], [8200, 10000]);
});

test('the refresh button syncs and answers a toast', async () => {
  const { gladys, service } = await setup({ linked: true });
  await service.sync();
  const ack = await gladys.fake.widgetAction('health_overview', 'refresh');
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.message.en, 'Data refreshed.');
  assert.ok(gladys.fake.widgetRefreshes.includes('health_overview'));
});
