import { TwitterApi } from 'twitter-api-v2';
import { listenOnLocalhost } from '../../index.js';

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
  [index: string]: string | undefined,

  /**
   * Can be used in place of the apiKey and apiKeySecret, if available.
   * It's exclusive to the auth flow used to generate it, so a token from
   * the OAuth1 flow can't be used with and endpoint that's OAuth2 only.
   * 
   * Might split this into appBearerToken and userBearerToken.
   */
  bearerToken?: string,

  /**
   * Keys exclusive to the application, used to request an authorization URL
   * and kick off the auth process. Once that flow is successful, we use the
   * clientId and clientSecret to do real API stuff.
   */
  apiKey?: string,
  apiKeySecret?: string,

  /**
   * Access tokens for the OAuth1 user flow
   */
  accessToken?: string,
  accessTokenSecret?: string,
  refreshToken?: string,

  /**
   * Used for the OAuth2 scoped user flow.
   */
  clientId?: string,
  clientSecret?: string,
  
  /**
   * Used for a split second during the OAuth 1.0 authorization flow;
   * we open a browser window, let the user give access to their account,
   * then they copy the PIN it displays and paste it to the command line.
   * Once that happens, the PIN is unecessary and we can use/cache the keys
   * and secrets Twitter hands us.
   */
  loginPin?: string,
}

export async function getOAuth1Client(apiKey: string, apiSecret: string) {
  // first, check for cached credentials. if they exist, go straight to logging in.
  const localUrl = 'http://localhost:9000/oauth';
  const linkRequestClient = new TwitterApi({ appKey: apiKey, appSecret: apiSecret });

  const { url, oauth_token, oauth_token_secret } = await linkRequestClient.generateAuthLink(localUrl);
  const { request } = await listenOnLocalhost({
    launchBrowser: url,
    listen: ( req, body, res) => res.write('Authorization successful. You can close this window!')
  });
  const verifier = new URL(request.url!, 'http://localhost').searchParams.get('oauth_verifier') ?? '';

  const loginClient = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: oauth_token,
    accessSecret: oauth_token_secret
  });

  return loginClient.login(verifier)
    .then(({ client, accessToken, accessSecret }) => {
      console.log(`OAuth1 Token: ${accessToken}`);
      console.log(`OAuth2 Secret: ${accessSecret}`);
      return client;
    });
}

export async function getOAuth2Client(clientId: string, clientSecret: string, scope?: string[]) {
  const localUrl = 'http://localhost:9000/oauth';
  scope ??= [ 'tweet.read', 'users.read', 'bookmark.read', 'offline.access' ];

  const linkRequestClient = new TwitterApi({ clientId, clientSecret });
  const { url, codeVerifier } = linkRequestClient.generateOAuth2AuthLink(localUrl, { scope });
  let { request } = await listenOnLocalhost({
    launchBrowser: url,
    listen: ( req, body, res) => res.write('Authorization successful. You can close this window!')
  });
  const code = new URL(request.url!, 'http://localhost').searchParams.get('code') ?? '';

  const loginClient = new TwitterApi({ clientId, clientSecret });
  return loginClient.loginWithOAuth2({ code, codeVerifier, redirectUri: 'http://localhost:9000/oauth' })
    .then(async ({ client, accessToken, refreshToken, expiresIn }) => {
      console.log(`OAuth2 Token: ${accessToken}`);
      console.log(`Expires In: ${refreshToken}`);
      console.log(`Refresh Token: ${refreshToken}`);
      return client;
    });
}
