# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

**Huawei Health**, a Gladys Assistant **external integration**: a Node.js
service (Node 22+, ESM, no build step) running in its own sandboxed Docker
container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
(its only runtime dependency) and to the Huawei Health cloud over HTTPS with
the global `fetch`. It started from the official JavaScript template
(`GladysAssistant/integration-template-js`).

Huawei watches have no local API. The integration uses Huawei's **official**
cloud API, Health Service Kit (REST, `health-api.cloud.huawei.com/healthkit/v2`),
with the user's own Huawei developer app (Client ID / secret) and the Huawei ID
OAuth 2.0 authorization-code flow relayed by Gladys (`oauth2` config field).
The reference is the Health Service Kit documentation on developer.huawei.com
("Cloud-side Data Openness" guides, "REST" API reference).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/service.test.js          # one file
node --test --test-name-pattern "token"   # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                     bootstrap: SDK client + registerHandlers + connect
src/handlers.js              SDK wiring: OAuth, actions, scene actions, widgets, lifecycle
src/service.js               session (tokens, refresh), sync loop, publication of states/events/statuses
src/huawei/oauth.js          Huawei ID OAuth 2.0: authorize URL, code exchange, refresh, id_token
src/huawei/client.js         Health Service Kit REST client (read-only), 401 retry, 121001 site redirection
src/huawei/dataTypes.js      data type names + OAuth scopes per data group
src/health.js                one snapshot per sync: raw Huawei JSON -> values (pure, defensive)
src/triggers.js              scene triggers: diff of two snapshots (pure)
src/devices/account.js       the account device: one read-only feature per metric
src/scenes.js                scene action handlers (manifest `scene_actions`)
src/widgets.js               dashboard widgets (manifest `widgets`)
src/i18n.js                  user-facing messages, en/fr/de/es
src/config.js                DEFAULT_CONFIG (mirrors the manifest defaults), TOKEN_KEYS, normalization
docs/{en,fr,de,es}.md        user documentation, re-hosted by Gladys (en + fr mandatory)
test/helpers/fakeHuawei.js   in-memory Huawei cloud (token endpoint + Health Service Kit) for the tests
```

## Rules

- **External ids are forever.** The account device is keyed by a hash of the
  Huawei OpenID (`accountIdFromSubject`), a feature by its key in `FEATURES`
  (src/devices/account.js). Never rename one: Gladys keys the history, scenes
  and dashboards on them. Same for every manifest key (`config_schema`,
  actions, scene triggers/actions, their fields, variables and outputs,
  widgets) and for the data group values.
- **Never write to the Huawei account.** Read endpoints and read scopes only.
- **Secrets.** The client secret only goes to the Huawei token endpoint; the
  tokens live in off-schema config keys (`TOKEN_KEYS`). Never log tokens, the
  client secret, the authorization code, the OpenID nor health values. Only
  official Huawei hosts; a `121001` redirection is followed only to
  `health-api.cloud.huawei.*`.
- **Be gentle with Huawei.** Sync interval 5 minutes minimum, one sync at a
  time (`service.sync()` shares the running one), device list cached one hour.
- **Scene events.** Derived from two snapshots: the first snapshot after a
  start is a baseline and never fires; one event per new Huawei timestamp or
  threshold crossing; `data` only holds the keys declared in the manifest.
- **The container rootfs is read-only.** Write only under `/data`.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Four languages.** Every user-facing text exists in English, French, German
  and Spanish: manifest texts (`label`, `description`, `placeholder`, option
  labels), `src/i18n.js`, widget texts in `src/widgets.js`, and `docs/*.md`,
  kept in sync. The tests check the manifest, the messages and the widgets.
  Widget texts respect the core limits: `validateWidgetContent` must stay `[]`.
- **Manifest.** The catalog `description` holds 10 to 100 characters per
  language; `keywords` (10 at most) need `gladys_version >= 5.3.0`.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (`fakeHuawei` + the SDK's fake
  Gladys).
