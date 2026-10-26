# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-26

### Added

- First version of the Huawei Health integration, through Huawei's official
  Health Service Kit cloud API (OAuth 2.0 with your own Huawei developer app).
- Account device: steps, active calories and distance of the day, heart rate,
  resting heart rate, heart rate variability, SpO2, stress, body and skin
  temperature, weight, BMI, body fat, sleep score and phases.
- Choice of the data groups to read, matching the scopes approved by Huawei.
- Scene triggers: night of sleep recorded, daily step goal reached, abnormal
  heart rate (high/low), low blood oxygen, new weigh-in.
- Scene actions: synchronize now, get the health summary.
- Dashboard widgets: health overview, activity of the day, last night's sleep.
- Configuration actions: test the connection, synchronize now, sign out.
- English, French, German and Spanish.

[Unreleased]: https://github.com/gboulvin/Gladys-Huawei-Health/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/gboulvin/Gladys-Huawei-Health/releases/tag/v1.0.1
