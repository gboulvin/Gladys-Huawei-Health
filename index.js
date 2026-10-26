// -----------------------------------------------------------------------------
// Entry point of the Huawei Health integration for Gladys Assistant.
//
// Role of this file: wire the SDK to the service (src/service.js). It holds no
// Huawei logic. It only:
//   1. instantiates the SDK (connection, auth, reconnection: handled for you);
//   2. registers the event handlers BEFORE connect();
//   3. connects, loads the config and starts the periodic sync.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/handlers.js';

const gladys = new GladysIntegration();
registerHandlers(gladys);

logger.info('Starting the Huawei Health integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
