// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest itself, but nothing there knows
// which handlers the code registers, nor the four languages we promise.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIONS } from '../src/handlers.js';
import { SCENE_ACTIONS, SUMMARY_OUTPUTS } from '../src/scenes.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGER_KEYS } from '../src/triggers.js';
import { DATA_GROUPS, DEFAULT_CONFIG, TOKEN_KEYS } from '../src/config.js';
import { GROUP_SCOPES } from '../src/huawei/dataTypes.js';
import { LANGUAGES } from '../src/i18n.js';
import { OAUTH_FIELD_KEY } from '../src/service.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

// Every object of the manifest that looks like a multi-language text.
function multiLanguageTexts(value, path = 'manifest', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => multiLanguageTexts(item, `${path}[${index}]`, found));
  } else if (value && typeof value === 'object') {
    if (typeof value.en === 'string') {
      found.push({ path, value });
    } else {
      for (const [key, child] of Object.entries(value)) {
        multiLanguageTexts(child, `${path}.${key}`, found);
      }
    }
  }
  return found;
}

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

test('every text of the manifest exists in English, French, German and Spanish', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 50);
  for (const { path, value } of texts) {
    assert.deepEqual(Object.keys(value).sort(), [...LANGUAGES].sort(), path);
    for (const language of LANGUAGES) {
      assert.ok(value[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('every manifest action, scene action and widget has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.keys(ACTIONS).sort());
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(WIDGETS).sort());
});

test('the scene triggers the code fires are exactly the declared ones', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), [...TRIGGER_KEYS].sort());
});

test('the summary scene action declares every output the code returns', () => {
  const action = manifest.scene_actions.find((a) => a.key === 'get_health_summary');
  assert.deepEqual(
    keysOf(action.outputs).sort(),
    [...SUMMARY_OUTPUTS, 'synced_at', 'synced'].sort(),
  );
});

test('scene triggers, actions, widgets and keywords require a recent Gladys', () => {
  // widgets / scene_*: 5.1.0; categories: 4.86.0; keywords (new catalog): 5.3.0.
  assert.ok(isAtLeast(minGladysVersion(), [5, 3, 0]), manifest.gladys_version);
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
});

test('Huawei Health is a cloud service', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[field.key], field.default, field.key);
    }
  }
});

test('the data groups of the form are the ones the code knows', () => {
  const field = manifest.config_schema.find((f) => f.key === 'data_groups');
  assert.deepEqual(
    field.options.map((o) => o.value),
    DATA_GROUPS,
  );
  assert.deepEqual(Object.keys(GROUP_SCOPES), DATA_GROUPS);
});

test('the secret is a secret field, the account an oauth2 field', () => {
  const byKey = Object.fromEntries(manifest.config_schema.map((f) => [f.key, f]));
  assert.equal(byKey.client_secret.type, 'secret');
  assert.equal(byKey[OAUTH_FIELD_KEY].type, 'oauth2');
  for (const key of TOKEN_KEYS) {
    assert.equal(byKey[key], undefined, `${key} is stored off-schema, never shown in the form`);
  }
});

test('section fields are purely presentational, their links https', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const text of Object.values(section.description)) {
      assert.ok(text.length <= 1000, 'a section text holds 1000 characters at most');
    }
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(
    manifest.docker_image.endsWith(`:${manifest.version}`),
    `docker_image must be tagged :${manifest.version}, got "${manifest.docker_image}"`,
  );
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('widget labels hold 3 to 30 characters, descriptions 100 at most', () => {
  for (const widget of manifest.widgets) {
    for (const text of Object.values(widget.label)) {
      assert.ok(text.length >= 3 && text.length <= 30, `${widget.key}: "${text}"`);
    }
    for (const text of Object.values(widget.description ?? {})) {
      assert.ok(text.length <= 100, `${widget.key}: "${text}"`);
    }
  }
});
