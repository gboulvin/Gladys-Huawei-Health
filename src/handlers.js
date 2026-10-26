// -----------------------------------------------------------------------------
// SDK wiring: every Gladys event the integration answers, mapped to the
// service. Kept out of index.js so the tests can register the exact same
// handlers on the SDK's fake Gladys.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { HuaweiHealthService } from './service.js';
import { SCENE_ACTIONS } from './scenes.js';
import { WIDGETS, refreshWidgets } from './widgets.js';

const logger = createLogger({ name: 'handlers' });

// Manifest `actions` (Configuration screen buttons).
export const ACTIONS = {
  test_connection: (service) => service.testConnection(),
  sync_now: (service) => service.syncNow(),
  sign_out: (service) => service.signOut(),
};

/**
 * Register every handler on `gladys` and return the service behind them.
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {object} [options] forwarded to HuaweiHealthService (fetchImpl, now)
 */
export function registerHandlers(gladys, options = {}) {
  const service = new HuaweiHealthService(gladys, options);
  service.onSynced = () => refreshWidgets(gladys);

  // --- Discovery: the account device, once linked ------------------------------
  gladys.onScanRequest(async () => {
    await gladys.publishDiscoveredDevices(service.buildDiscoveredDevices());
  });

  // --- OAuth2: the "Connect" button of the `huawei_account` field ---------------
  gladys.onOAuthAuthorizeUrl(async (key, redirectUri) => {
    logger.info(`Authorization requested for ${key}`);
    return service.authorizeUrl(redirectUri);
  });
  gladys.onOAuthCallback(async (key, params) => {
    await service.handleOAuthCallback(params);
    refreshWidgets(gladys);
  });

  // --- Manifest actions ----------------------------------------------------------
  for (const [key, handler] of Object.entries(ACTIONS)) {
    gladys.onAction(key, () => handler(service));
  }

  // --- Scene actions -------------------------------------------------------------
  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(key, (fields) => handler(service, { fields }));
  }

  // --- Dashboard widgets ---------------------------------------------------------
  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(key, () => widget.get(service));
    if (typeof widget.action === 'function') {
      gladys.onWidgetAction(key, (actionKey, params) =>
        widget.action(service, { actionKey, params }),
      );
    }
  }

  // --- Configuration saved by the user ------------------------------------------
  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Configuration updated');
    service.updateConfig(newConfig);
    // The enabled data groups shape the device features: re-publish them.
    await gladys.publishDiscoveredDevices(service.buildDiscoveredDevices());
    if (service.isLinked) {
      service.start();
    } else {
      service.stop();
      await service.sync();
    }
    refreshWidgets(gladys);
  });

  // --- Connection lifecycle -------------------------------------------------------
  gladys.on('connected', async () => {
    try {
      service.loadConfig(await gladys.getConfig());
      await gladys.publishDiscoveredDevices(service.buildDiscoveredDevices());
      // The first sync reports the connection status (or why there is none).
      service.lastStatusKey = undefined;
      service.start();
      refreshWidgets(gladys);
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys
        .setConnectionStatus(false, {
          en: 'Initialization failed, check the integration logs.',
          fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
          de: 'Initialisierung fehlgeschlagen, prüfen Sie die Integrationsprotokolle.',
          es: 'La inicialización falló, consulte los registros de la integración.',
        })
        .catch(() => {});
    }
  });

  gladys.on('disconnected', () => service.stop());

  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    service.stop();
  });

  return service;
}
