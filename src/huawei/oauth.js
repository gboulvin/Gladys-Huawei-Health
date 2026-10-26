// -----------------------------------------------------------------------------
// Huawei ID (Account Kit) OAuth 2.0 authorization-code flow.
//
// The browser goes to AUTHORIZE_URL, Huawei redirects back to the redirect URI
// Gladys shows in the Configuration screen, and the integration exchanges the
// code at TOKEN_URL. `access_type=offline` is what makes Huawei return a
// refresh token (valid about six months, renewed on every refresh).
// -----------------------------------------------------------------------------

import { createHash, randomBytes } from 'node:crypto';
import { scopesFor } from './dataTypes.js';

export const AUTHORIZE_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
export const TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

// Refresh a little before the real expiry: a token that expires in the middle
// of a sync makes every following request fail.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export class HuaweiAuthError extends Error {
  constructor(message, { status, code, needsReconnect = false } = {}) {
    super(message);
    this.name = 'HuaweiAuthError';
    this.status = status;
    this.code = code;
    this.needsReconnect = needsReconnect;
  }
}

/**
 * Anti-CSRF state. Huawei documents the state as `^[0-9a-zA-Z:/\.]+$`: hex
 * stays inside that alphabet.
 */
export function generateState() {
  return randomBytes(16).toString('hex');
}

export function buildAuthorizeUrl({ clientId, redirectUri, groups, state }) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopesFor(groups));
  url.searchParams.set('state', state);
  return url.toString();
}

async function postToken(fetchImpl, params) {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    // Huawei answers JSON on success and on 400; anything else is a gateway error.
  }
  if (!response.ok || !payload.access_token) {
    // 1203 / sub-error 11205 or 31204: the refresh token is dead (password
    // change, revoked authorization...). Only a new authorization fixes it.
    const needsReconnect = response.status === 400 || response.status === 401;
    throw new HuaweiAuthError(
      `Huawei token endpoint answered ${response.status} (error ${payload.error ?? '?'}/${payload.sub_error ?? '?'})`,
      { status: response.status, code: payload.error, needsReconnect },
    );
  }
  return payload;
}

/**
 * Turn a token endpoint answer into what the integration stores.
 */
export function toStoredTokens(payload, { clientId, previousRefreshToken, now = Date.now() }) {
  return {
    access_token: payload.access_token,
    // A refresh answer may omit the refresh token: keep the previous one.
    refresh_token: payload.refresh_token ?? previousRefreshToken,
    token_expires_at: now + Number(payload.expires_in ?? 3600) * 1000,
    token_client_id: clientId,
  };
}

export async function exchangeCode({
  fetchImpl = fetch,
  clientId,
  clientSecret,
  code,
  redirectUri,
}) {
  return postToken(fetchImpl, {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
}

export async function refreshAccessToken({
  fetchImpl = fetch,
  clientId,
  clientSecret,
  refreshToken,
}) {
  return postToken(fetchImpl, {
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
}

export function isExpired(expiresAt, now = Date.now()) {
  return !expiresAt || Number(expiresAt) - EXPIRY_MARGIN_MS <= now;
}

/**
 * Read the claims of the id_token. No signature check: the token comes
 * straight from the Huawei token endpoint over TLS, it only serves to name the
 * account.
 */
export function decodeIdToken(idToken) {
  if (typeof idToken !== 'string') {
    return {};
  }
  try {
    const [, payload] = idToken.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

/**
 * Stable, non-reversible account id for the external ids: the Huawei OpenID
 * is personal data and has nothing to do in a Gladys device identifier.
 */
export function accountIdFromSubject(subject) {
  return createHash('sha256').update(String(subject)).digest('hex').slice(0, 16);
}
