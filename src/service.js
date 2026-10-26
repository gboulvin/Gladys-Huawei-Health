// -----------------------------------------------------------------------------
// The integration's runtime: OAuth session, Huawei client, periodic sync.
//
// index.js only wires the SDK handlers to this object, so the whole behaviour
// can be driven from the tests with the SDK's fake Gladys and a fake `fetch`.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { TOKEN_KEYS, mergeConfigUpdate, normalizeConfig } from './config.js';
import { account } from './devices/account.js';
import { fetchDevices, fetchSnapshot } from './health.js';
import { HuaweiHealthClient } from './huawei/client.js';
import {
  HuaweiAuthError,
  accountIdFromSubject,
  buildAuthorizeUrl,
  decodeIdToken,
  exchangeCode,
  generateState,
  isExpired,
  refreshAccessToken,
  toStoredTokens,
} from './huawei/oauth.js';
import { message } from './i18n.js';
import { TriggerTracker } from './triggers.js';

const logger = createLogger({ name: 'huawei-health' });

// An authorization started and never finished is forgotten after this delay.
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
// The device list changes when the user pairs a new watch: no need to ask
// Huawei more than once an hour.
const DEVICES_TTL_MS = 60 * 60 * 1000;
// publishChangedStates heartbeat: an unchanged value (0 steps at night) is
// re-sent every 30 minutes, so the dashboards never call it stale.
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;

export const OAUTH_FIELD_KEY = 'huawei_account';

export class HuaweiHealthService {
  constructor(gladys, { fetchImpl = fetch, now = () => Date.now() } = {}) {
    this.gladys = gladys;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.config = normalizeConfig();
    this.pendingStates = new Map();
    this.tracker = new TriggerTracker();
    this.snapshot = undefined;
    this.devicesCache = undefined;
    this.timer = undefined;
    this.syncing = undefined;
    this.refreshing = undefined;
    this.lastStatusKey = undefined;
    this.onSynced = () => {};
  }

  // --- Configuration ---------------------------------------------------------

  loadConfig(raw) {
    this.config = normalizeConfig(raw);
    this.client = undefined;
  }

  updateConfig(update) {
    const previous = this.config;
    this.config = mergeConfigUpdate(previous, update);
    this.client = undefined;
    if (
      previous.client_id !== this.config.client_id ||
      previous.step_goal !== this.config.step_goal
    ) {
      this.tracker.reset();
    }
  }

  get isConfigured() {
    return Boolean(this.config.client_id && this.config.client_secret);
  }

  get isLinked() {
    return Boolean(
      this.isConfigured &&
      this.config.refresh_token &&
      this.config.account_id &&
      this.config.token_client_id === this.config.client_id,
    );
  }

  get accountId() {
    return this.config.account_id;
  }

  get deviceExternalId() {
    return this.accountId ? account.deviceExternalId(this.gladys, this.accountId) : undefined;
  }

  async persist(partial) {
    this.config = normalizeConfig({ ...this.config, ...partial });
    await this.gladys.setConfig(partial);
  }

  // --- Connection status -----------------------------------------------------

  /** Why the integration cannot sync, as a status message, or undefined. */
  setupProblem() {
    if (!this.isConfigured) {
      return 'notConfigured';
    }
    if (this.config.refresh_token && this.config.token_client_id !== this.config.client_id) {
      return 'clientChanged';
    }
    if (!this.isLinked) {
      return 'notLinked';
    }
    return undefined;
  }

  async reportStatus(connected, messageKey) {
    const key = `${connected}:${messageKey ?? ''}`;
    if (key === this.lastStatusKey) {
      return;
    }
    this.lastStatusKey = key;
    await this.gladys
      .setConnectionStatus(connected, messageKey ? message(messageKey) : undefined)
      .catch((err) => logger.error('setConnectionStatus failed', err));
  }

  // --- OAuth -----------------------------------------------------------------

  authorizeUrl(redirectUri) {
    if (!this.isConfigured) {
      throw new Error(message('notConfigured').en);
    }
    const now = this.now();
    for (const [state, expiresAt] of this.pendingStates) {
      if (expiresAt < now) {
        this.pendingStates.delete(state);
      }
    }
    const state = generateState();
    this.pendingStates.set(state, now + OAUTH_STATE_TTL_MS);
    return buildAuthorizeUrl({
      clientId: this.config.client_id,
      redirectUri,
      groups: this.config.data_groups,
      state,
    });
  }

  async handleOAuthCallback({ code, state, redirectUri }) {
    const expiresAt = this.pendingStates.get(state);
    this.pendingStates.delete(state);
    if (!expiresAt || expiresAt < this.now()) {
      throw new Error(message('invalidState').en);
    }
    if (!code) {
      throw new Error('Huawei returned no authorization code');
    }
    const payload = await exchangeCode({
      fetchImpl: this.fetchImpl,
      clientId: this.config.client_id,
      clientSecret: this.config.client_secret,
      code,
      redirectUri,
    });
    const claims = decodeIdToken(payload.id_token);
    if (!claims.sub) {
      throw new Error('Huawei returned no id_token: is "openid" among the app scopes?');
    }
    await this.persist({
      ...toStoredTokens(payload, { clientId: this.config.client_id, now: this.now() }),
      account_id: accountIdFromSubject(claims.sub),
      account_name: typeof claims.display_name === 'string' ? claims.display_name : '',
    });
    this.client = undefined;
    this.tracker.reset();
    this.devicesCache = undefined;
    logger.info('Huawei account linked');
    await this.gladys.publishDiscoveredDevices(this.buildDiscoveredDevices());
    await this.reportStatus(true);
    this.start();
  }

  async getAccessToken({ force = false } = {}) {
    if (!force && !isExpired(this.config.token_expires_at, this.now())) {
      return this.config.access_token;
    }
    // Several requests can find the token expired at once: refresh it once.
    this.refreshing ??= (async () => {
      try {
        const payload = await refreshAccessToken({
          fetchImpl: this.fetchImpl,
          clientId: this.config.client_id,
          clientSecret: this.config.client_secret,
          refreshToken: this.config.refresh_token,
        });
        await this.persist(
          toStoredTokens(payload, {
            clientId: this.config.client_id,
            previousRefreshToken: this.config.refresh_token,
            now: this.now(),
          }),
        );
        return this.config.access_token;
      } finally {
        this.refreshing = undefined;
      }
    })();
    return this.refreshing;
  }

  getClient() {
    this.client ??= new HuaweiHealthClient({
      getAccessToken: () => this.getAccessToken(),
      refreshAccessToken: ({ force }) => this.getAccessToken({ force }),
      clientId: this.config.client_id,
      baseUrl: this.config.api_base_url,
      fetchImpl: this.fetchImpl,
      onBaseUrlChange: (baseUrl) => {
        logger.info(`Huawei Health data lives on ${baseUrl}`);
        this.persist({ api_base_url: baseUrl }).catch((err) =>
          logger.error('Saving the API site failed', err),
        );
      },
    });
    return this.client;
  }

  // --- Devices ---------------------------------------------------------------

  buildDiscoveredDevices() {
    if (!this.accountId) {
      return [];
    }
    return [
      account.buildDevice(this.gladys, {
        accountId: this.accountId,
        accountName: this.config.account_name,
        config: this.config,
      }),
    ];
  }

  /** Watches, bands and scales that write to the account (cached one hour). */
  async getHuaweiDevices({ force = false } = {}) {
    const now = this.now();
    if (!force && this.devicesCache && now - this.devicesCache.at < DEVICES_TTL_MS) {
      return this.devicesCache.devices;
    }
    const devices = await fetchDevices(this.getClient());
    this.devicesCache = { at: now, devices };
    return devices;
  }

  // --- Sync ------------------------------------------------------------------

  /**
   * Read the Huawei cloud, publish the states and the scene events. Concurrent
   * calls (timer, action button, scene) share the same run.
   */
  sync() {
    this.syncing ??= this.runSync().finally(() => {
      this.syncing = undefined;
    });
    return this.syncing;
  }

  async runSync() {
    const problem = this.setupProblem();
    if (problem) {
      await this.reportStatus(false, problem);
      return { ok: false, messageKey: problem };
    }
    const snapshot = await fetchSnapshot(this.getClient(), this.config, this.now());
    const failedGroups = Object.keys(snapshot.errors);
    for (const [group, err] of Object.entries(snapshot.errors)) {
      logger.warn(`Reading ${group} failed: ${err.message}`);
    }

    const authError = Object.values(snapshot.errors).find(
      (err) => err instanceof HuaweiAuthError && err.needsReconnect,
    );
    if (authError) {
      await this.reportStatus(false, 'reconnect');
      return { ok: false, messageKey: 'reconnect' };
    }
    if (failedGroups.length > 0 && failedGroups.length === this.config.data_groups.length) {
      await this.reportStatus(false, 'cloudError');
      return { ok: false, messageKey: 'cloudError' };
    }

    // Keep the last known value of a group that failed this time.
    const values = { ...this.snapshot?.values, ...snapshot.values };
    this.snapshot = { ...snapshot, values };

    const states = account.buildStates(this.gladys, {
      accountId: this.accountId,
      config: this.config,
      values,
    });
    if (states.length > 0) {
      await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
    }
    const events = this.tracker.detect(values, { config: this.config });
    for (const event of events) {
      logger.info(`Scene event ${event.key}`);
      await this.gladys
        .publishSceneEvent(event.key, event.data)
        .catch((err) => logger.error(`publishSceneEvent ${event.key} failed`, err));
    }
    await this.reportStatus(true);
    this.onSynced();
    return { ok: true, failedGroups };
  }

  // --- Lifecycle -------------------------------------------------------------

  start() {
    this.stop();
    const loop = async () => {
      try {
        await this.sync();
      } catch (err) {
        logger.error('Sync failed', err);
        await this.reportStatus(false, 'cloudError');
      }
      this.timer = setTimeout(loop, this.config.poll_frequency * 1000);
      this.timer.unref?.();
    };
    this.timer = setTimeout(loop, 0);
    this.timer.unref?.();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  // --- Configuration screen actions -------------------------------------------

  async syncNow() {
    const result = await this.sync();
    if (!result.ok) {
      return message(result.messageKey);
    }
    if (result.failedGroups.length > 0) {
      return message('partialSync', { groups: result.failedGroups.join(', ') });
    }
    return message('syncDone');
  }

  /** Forget the Huawei tokens: the account stays authorized until revoked in the Huawei app. */
  async signOut() {
    this.stop();
    await this.persist(Object.fromEntries(TOKEN_KEYS.map((key) => [key, ''])));
    this.snapshot = undefined;
    this.devicesCache = undefined;
    this.tracker.reset();
    await this.reportStatus(false, 'notLinked');
    return message('signedOut');
  }

  async testConnection() {
    const problem = this.setupProblem();
    if (problem) {
      return message(problem);
    }
    try {
      const privacy = await this.getClient().privacyRecords();
      const opinion = Array.isArray(privacy) ? privacy[0]?.opinion : privacy?.opinion;
      if (opinion === 2) {
        return message('privacyNotGranted');
      }
      const devices = await this.getHuaweiDevices({ force: true });
      const names = devices.map((device) => device.name).join(', ');
      return message('connectionOk', { devices: names || message('noDevice') });
    } catch (err) {
      logger.error('Connection test failed', err);
      if (err instanceof HuaweiAuthError) {
        return message('reconnect');
      }
      return message('cloudError');
    }
  }
}
