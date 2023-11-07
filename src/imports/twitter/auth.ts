import { TwitterApi } from 'twitter-api-v2';
import { Filestore, listenOnLocalhost } from '../../index.js';
import { TwitterApiRateLimitPlugin } from '@twitter-api-v2/plugin-rate-limit';

/**
 * There are five basic ways of accessing Twitter data:
 *
 * 1. Unauthenticated scraping, y'all. Mostly via the OEmbed endpoint
 *    at publish.twitter.com.
 * 2. Authenticated scraping: Log into twitter and make simple URL requests,
 *    parsing what appears on screen. No mechanism provided for that yet.
 * 3. API, with application bearer token: No fuss, no muss, but only works
 *    with a tiny handful of endpoints, none of them terribly useful.
 * 4. API, with OAuth1 user context: ???
 * 5. API, with OAuth2 user context: Most of the useful stuff requires this.
 *    Appropriately, it is the most annoying. Also requires the auth flow
 *    request specific permission scopes.
 */

/**
 * A bundle of assorted authentication bits for the Twitter API, annotated
 * for clarity.
 */
export type TwitterAuthData = {
  /**
   * General bag for other properties we might find
   */
  [index: string]: string | undefined;

  /**
   * Can be used in place of the apiKey and apiKeySecret, if available.
   * It's exclusive to the auth flow used to generate it, so a token from
   * the OAuth1 flow can't be used with and endpoint that's OAuth2 only.
   *
   * Might split this into appBearerToken and userBearerToken.
   */
  bearerToken?: string;

  /**
   * Keys exclusive to the application, used to request an authorization URL
   * and kick off the auth process. Once that flow is successful, we use the
   * clientId and clientSecret to do real API stuff.
   */
  apiKey?: string;
  apiKeySecret?: string;

  /**
   * Access tokens for the OAuth1 user flow
   */
  accessToken?: string;
  accessTokenSecret?: string;
  refreshToken?: string;

  /**
   * Used for the OAuth2 scoped user flow.
   */
  clientId?: string;
  clientSecret?: string;

  /**
   * Used for a split second during the OAuth 1.0 authorization flow;
   * we open a browser window, let the user give access to their account,
   * then they copy the PIN it displays and paste it to the command line.
   * Once that happens, the PIN is unecessary and we can use/cache the keys
   * and secrets Twitter hands us.
   */
  loginPin?: string;
};

/**
 * Returns an "API V1.1" compatible authenticated TwitterAPI client.
 *
 * This version of Twitter's API is deprecated and endpoints are steadily
 * being moved over to the V2 API. However, we use it to retrieve media
 * entity alt text, which the "Twitter Archive Export" feature ignores.
 *
 * Keys can be generated at {@link the Twitter API Developer Dashboard |
 * https://developer.twitter.com/en/portal/dashboard}
 *
 * @param appKey your Twitter application's "Consumer API Key"
 * @param appSecret your Twitter application's "Consumer Secret"
 * @param cache a Filestore instance to retrieve and save generated auth identifiers
 * @returns a promise that resolves to a logged-in TwitterAPI client
 */
export async function getOAuth1Client(
  appKey: string,
  appSecret: string,
  cache?: Filestore
): Promise<TwitterApi> {
  const file = 'twitter-v1-credentials.json';

  if (cache && cache.existsCache(file)) {
    const { accessToken, accessSecret } = await cache.readCache(file);
    return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  } else {
    const { client, accessToken, accessSecret } = await authorizeOAuth1(
      appKey,
      appSecret
    );
    if (cache) {
      await cache.writeCache(file, { accessToken, accessSecret });
    }
    return Promise.resolve(client);
  }
}

export async function authorizeOAuth1(apiKey: string, apiSecret: string) {
  const localUrl = 'http://localhost:9000/oauth';
  const linkRequestClient = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret
  });

  const { url, oauth_token, oauth_token_secret } =
    await linkRequestClient.generateAuthLink(localUrl);
  const { request } = await listenOnLocalhost({
    launchBrowser: url,
    listen: (req, body, res) =>
      res.write('Authorization successful. You can close this window!')
  });
  const verifier =
    new URL(request.url!, 'http://localhost').searchParams.get(
      'oauth_verifier'
    ) ?? '';

  const rateLimitPlugin = new TwitterApiRateLimitPlugin();
  const loginClient = new TwitterApi(
    {
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret
    },
    { plugins: [rateLimitPlugin] }
  );

  return loginClient.login(verifier);
}

/**
 * Returns an "API V2" compatible authenticated TwitterAPI client.
 *
 * ID and Secret can be generated at {@link the Twitter API Developer Dashboard |
 * https://developer.twitter.com/en/portal/dashboard}.
 *
 * @param clientId your Twitter application's "OAuth2 Client ID"
 * @param clientSecret your application's "OAuth2 Client Secret"
 * @param cache a Filestore instance to retrieve and save generated auth identifiers
 * @param scope an array of strings containing OAuth2 permission scopes
 * @returns a promise that resolves to a logged-in TwitterAPI client
 */
export async function getOAuth2Client(
  clientId: string,
  clientSecret: string,
  cache?: Filestore,
  scope?: string[]
) {
  const file = 'twitter-v2-credentials.json';

  if (cache && cache.existsCache(file)) {
    // Check for cached credentials. If they exist, things are easy peasy.
    // TODO: check refreshToken and expiresIn, and renew accessToken if necessary.
    const { accessToken } = await cache.readCache(file);
    return new TwitterApi(accessToken);
  } else {
    const { client, accessToken, refreshToken, expiresIn } =
      await authorizeOAuth2(clientId, clientSecret, scope);
    if (cache) {
      await cache.writeCache(file, { accessToken, refreshToken, expiresIn });
    }
    return Promise.resolve(client);
  }
}

export async function authorizeOAuth2(
  clientId: string,
  clientSecret: string,
  scope?: string[]
) {
  const localUrl = 'http://localhost:9000/oauth';
  scope ??= ['tweet.read', 'users.read', 'bookmark.read', 'offline.access'];

  const linkRequestClient = new TwitterApi({ clientId, clientSecret });
  const { url, codeVerifier } = linkRequestClient.generateOAuth2AuthLink(
    localUrl,
    { scope }
  );
  let { request } = await listenOnLocalhost({
    launchBrowser: url,
    listen: (req, body, res) =>
      res.write('Authorization successful. You can close this window!')
  });
  const code =
    new URL(request.url!, 'http://localhost').searchParams.get('code') ?? '';

  const rateLimitPlugin = new TwitterApiRateLimitPlugin();

  const loginClient = new TwitterApi(
    { clientId, clientSecret },
    { plugins: [rateLimitPlugin] }
  );
  return loginClient.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri: 'http://localhost:9000/oauth'
  });
}
