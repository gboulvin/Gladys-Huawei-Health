// -----------------------------------------------------------------------------
// Minimal client of the Health Service Kit REST API (cloud side).
//
// Only the read endpoints the integration needs. Two Huawei specifics:
//   - data is stored in the region of the account: a request sent to the wrong
//     site answers 403 with error 121001 and the right domain in `Location`;
//     the client follows it once and remembers it (onBaseUrlChange);
//   - a 401 means the access token died early: the client asks for a fresh one
//     once, then gives up.
// -----------------------------------------------------------------------------

import { HuaweiAuthError } from './oauth.js';

export const DEFAULT_API_BASE_URL = 'https://health-api.cloud.huawei.com';

const CROSS_SITE_ERROR = 121001;
const REQUEST_TIMEOUT_MS = 20_000;

export class HuaweiApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'HuaweiApiError';
    this.status = status;
    this.code = code;
  }
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// Huawei only redirects to its own health domains: never follow a Location
// header anywhere else with the user's bearer token.
function isHuaweiHealthOrigin(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && /^health-api\.cloud\.huawei\.[a-z.]+$/.test(hostname);
  } catch {
    return false;
  }
}

export class HuaweiHealthClient {
  /**
   * @param {object} options
   * @param {() => Promise<string>} options.getAccessToken valid access token
   * @param {(options: { force: boolean }) => Promise<string>} [options.refreshAccessToken]
   * @param {string} options.clientId app id, sent as `x-client-id`
   * @param {string} [options.baseUrl]
   * @param {(baseUrl: string) => void} [options.onBaseUrlChange]
   * @param {typeof fetch} [options.fetchImpl]
   */
  constructor({
    getAccessToken,
    refreshAccessToken,
    clientId,
    baseUrl = DEFAULT_API_BASE_URL,
    onBaseUrlChange = () => {},
    fetchImpl = fetch,
  }) {
    this.getAccessToken = getAccessToken;
    this.refreshAccessToken = refreshAccessToken;
    this.clientId = clientId;
    this.baseUrl = baseUrl || DEFAULT_API_BASE_URL;
    this.onBaseUrlChange = onBaseUrlChange;
    this.fetchImpl = fetchImpl;
  }

  async request(method, path, { query, body } = {}, attempt = { auth: 0, site: 0 }) {
    const url = new URL(`/healthkit/v2${path}`, this.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      for (const item of [].concat(value)) {
        url.searchParams.append(key, String(item));
      }
    }
    const token =
      attempt.auth > 0 && this.refreshAccessToken
        ? await this.refreshAccessToken({ force: true })
        : await this.getAccessToken();
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        Authorization: `Bearer ${token}`,
        'x-client-id': this.clientId,
        'x-version': 'gladys_integration_1',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      return readJson(response);
    }
    const payload = await readJson(response);
    const code = payload?.error?.code;

    if (response.status === 401 && attempt.auth === 0 && this.refreshAccessToken) {
      return this.request(method, path, { query, body }, { ...attempt, auth: 1 });
    }
    if (response.status === 401) {
      throw new HuaweiAuthError('Huawei rejected the access token', {
        status: 401,
        needsReconnect: true,
      });
    }
    if (response.status === 403 && code === CROSS_SITE_ERROR && attempt.site === 0) {
      const location = response.headers.get('location');
      if (location && isHuaweiHealthOrigin(location)) {
        this.baseUrl = new URL(location).origin;
        this.onBaseUrlChange(this.baseUrl);
        return this.request(method, path, { query, body }, { ...attempt, site: 1 });
      }
    }
    throw new HuaweiApiError(
      `Huawei Health ${method} ${path} answered ${response.status}${code ? ` (${code})` : ''}`,
      { status: response.status, code },
    );
  }

  /** Latest sample point of 1 to 20 data types: `{ samplePoints: { [type]: point } }`. */
  latestSamplePoints(dataTypes) {
    return this.request('GET', '/sampleSets/latestSamplePoint', { query: { dataType: dataTypes } });
  }

  /** Daily statistics (max 31 days): `{ group: [{ startTime, endTime, sampleSet }] }`. */
  dailyPolymerize({ dataTypes, startDay, endDay, timeZone }) {
    return this.request('POST', '/sampleSet:dailyPolymerize', {
      body: { dataTypes, startDay, endDay, timeZone },
    });
  }

  /** Sample details in a window (max 30 days), times in milliseconds. */
  polymerize({ dataTypes, startTime, endTime }) {
    return this.request('POST', '/sampleSet:polymerize', {
      body: {
        polymerizeWith: dataTypes.map((dataTypeName) => ({ dataTypeName })),
        startTime,
        endTime,
      },
    });
  }

  /** Health records of a data type (max 31 days), times in NANOseconds. */
  healthRecords({ dataType, startTimeNs, endTimeNs }) {
    return this.request('GET', '/healthRecords', {
      query: { dataType, startTime: startTimeNs, endTime: endTimeNs },
    });
  }

  /** Every data collector visible with the granted scopes (devices that wrote data). */
  dataCollectors() {
    return this.request('GET', '/dataCollectors');
  }

  /** Whether the user allowed the Huawei Health app to share its data (1 = yes). */
  privacyRecords() {
    return this.request('GET', '/profile/privacyRecords');
  }
}
