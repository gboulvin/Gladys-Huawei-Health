// A fake Gladys (SDK) + a fake Huawei cloud, wired through the real handlers.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/handlers.js';
import { createFakeHuawei } from './fakeHuawei.js';

export const SELECTOR = 'huawei-health';
export const REDIRECT_URI = 'https://my.gladysassistant.com/redirect/oauth';

export async function setup({ config = {}, linked = false } = {}) {
  const huawei = createFakeHuawei();
  const gladys = createFakeGladys({
    selector: SELECTOR,
    config: { client_id: '101234567', client_secret: 'secret', ...config },
  });
  const service = registerHandlers(gladys, {
    fetchImpl: huawei.fetchImpl,
    now: () => huawei.state.now,
  });
  await gladys.connect();
  service.stop();
  if (linked) {
    await link(gladys, huawei);
    service.stop();
  }
  return { gladys, huawei, service };
}

/** Run the whole "Connect" round trip, as the Gladys frontend does. */
export async function link(gladys) {
  const ack = await gladys.fake.oauthAuthorizeUrl('huawei_account', REDIRECT_URI);
  const state = new URL(ack.data.authorize_url).searchParams.get('state');
  return gladys.fake.oauthCallback('huawei_account', {
    code: 'good-code',
    state,
    redirectUri: REDIRECT_URI,
  });
}
