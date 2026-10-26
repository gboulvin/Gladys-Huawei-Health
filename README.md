# Huawei Health for Gladys Assistant

An **external integration** for [Gladys Assistant](https://gladysassistant.com)
(5.3 or later) that brings your **Huawei Health** account into your home
automation: the health values of your Huawei watches, bands and scales, scene
triggers and actions, and dashboard widgets.

Built from the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
with [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md)

## Features

| Surface               | What you get                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account device        | Steps, active calories, distance (today), heart rate, resting heart rate, HRV, SpO2, stress, body & skin temperature, weight, BMI, body fat, sleep score & phases |
| Scene triggers        | Night of sleep recorded, daily step goal reached, abnormal heart rate (high/low filter), low blood oxygen, new weigh-in                                           |
| Scene actions         | Synchronize now, get the health summary (values as scene variables)                                                                                               |
| Dashboard widgets     | Health overview (6 tiles, devices, Refresh button), activity (step goal gauge, 7-day chart), last night's sleep (phases, heart rate chart)                        |
| Configuration actions | Test the connection (Huawei devices, privacy switch), synchronize now, sign out                                                                                   |
| Languages             | English, French, German, Spanish                                                                                                                                  |
| Transport             | `cloud` (Huawei Health Service Kit)                                                                                                                               |

## How it talks to Huawei

Huawei watches have no local API: they sync over Bluetooth with the Huawei
Health app, which uploads to the Huawei cloud. The integration reads that
cloud through Huawei's **official** REST API,
[Health Service Kit](https://developer.huawei.com/consumer/en/hms/huaweihealth/):

1. the user creates a Huawei developer app, applies for Health Service Kit with
   the read scopes they need (Huawei reviews it, about 10 working days), and
   enters its Client ID / secret in Gladys;
2. the **Connect** button runs the Huawei ID OAuth 2.0 authorization-code flow
   (`oauth-login.cloud.huawei.com`, `access_type=offline`) through the Gladys
   OAuth relay; the tokens are stored as off-schema config keys and refreshed
   automatically;
3. every 15 minutes (configurable, 5 minutes minimum), the integration reads
   `health-api.cloud.huawei.com/healthkit/v2`: daily statistics
   (`sampleSet:dailyPolymerize`), latest samples
   (`sampleSets/latestSamplePoint`), sample details (`sampleSet:polymerize`),
   sleep records (`healthRecords`) and the data collectors (devices). Accounts
   hosted on another Huawei site are followed through the documented `121001`
   redirection.

Each data group is read on its own: a scope that was not granted only blanks
that group. Read-only, always.

## Development

```bash
npm install
npm test               # node --test: fake Huawei cloud + the SDK's fake Gladys
npm run lint           # ESLint
npm run format:check   # Prettier
npx github:GladysAssistant/integration-store .   # store admission checks
```

Project layout and rules: see [`CLAUDE.md`](CLAUDE.md).

Run against a local Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="huawei-health" \
LOG_LEVEL=debug \
npm start
```

## Releasing

Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md),
then **Actions → Release → Run workflow** (`patch`, `minor` or `major`): the
workflow bumps the version everywhere, pushes the tag, builds the
`linux/amd64` + `linux/arm64` image to `ghcr.io/gboulvin/gladys-huawei-health`
and publishes the GitHub Release.

## Disclaimer

Not affiliated with Huawei. Huawei, HUAWEI Health and HUAWEI WATCH are
trademarks of Huawei Technologies Co., Ltd. The values shown are informative
and are not medical advice.

## License

Apache-2.0
