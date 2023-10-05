import { Twitter } from "../../index.js";
import { TwitterApi } from "twitter-api-v2";
import prompts from 'prompts';
import open from 'open';

export async function cacheBookmarks(this: Twitter) {
  if (this.options.useApi === true) {
    const client = await this.getOAuth2Client();
    const user = await client.currentUser();

    // We SHOULD check for already-cached bookmarks here
    
    const bookmarks = await client.v2.bookmarks({ expansions: ['referenced_tweets.id'] })
    
    for await (const bookmark of bookmarks) {
      const quotedTweet = bookmarks.includes.quote(bookmark)
      if (quotedTweet) {
        this.files.writeCache(`${user.id}/bookmarks/bookmark-${bookmark.id}.json`, bookmark);
        this.files.writeCache(`${user.id}/bookmarks/tweet-${quotedTweet.id}.json`, quotedTweet);
      }
    }
  }
  return Promise.resolve();
}

export async function getBearerClient(this: Twitter): Promise<TwitterApi> {
  if (this.options.useApi !== true) return Promise.reject();
  if (this.bearerClient) {
    return Promise.resolve(this.bearerClient);
  }

  if (this.options.auth?.bearerToken) {
    this.bearerClient = new TwitterApi(this.options.auth.bearerToken);
    return Promise.resolve(this.bearerClient);
  }

  // TODO: If we have stored OAuth1 login credentials, we can request a fresh
  // bearer token and save it, too. But right now we don't.

  return Promise.reject();
}

// This implements the OAuth 1.0a User Context login flow.
// Regrettably, some features require the OAuth 2.0 User Context; we'll deal with that later.
export async function getOAuth1Client(this: Twitter): Promise<TwitterApi> {
  if (this.options.useApi !== true) return Promise.reject();
  
  if (this.oAuth1Client) {
    return Promise.resolve(this.oAuth1Client);
  }

  const auth = {
    appKey: this.options.auth?.apiKey ?? '',
    appSecret: this.options.auth?.apiKeySecret ?? '',
    accessToken: this.options.auth?.accessToken ?? '',
    accessSecret: this.options.auth?.accessTokenSecret ?? ''
  }

  if (this.files.existsCache('login-credentials.json')) {
    // We have fully cached credentials — use them and return a client!
    const { accessToken, accessSecret } = await this.files.readCache('login-credentials.json');
    auth.accessToken = accessToken;
    auth.accessSecret = accessSecret;
    this.oAuth1Client = new TwitterApi(auth);
    return Promise.resolve(this.oAuth1Client);
} else {
    // Time to make an auth link!
    let authClient = new TwitterApi(auth);
    const { url, oauth_token, oauth_token_secret } = await authClient.generateAuthLink();
    const { ready } = await prompts({ type: 'confirm', initial: true, name: 'ready', message: 'Open Twitter to authorize app?' });
    if (ready === false) { return Promise.reject(); }

    await open(url);
    const { pin } = await prompts({ type: 'text', name: 'pin', message: 'Twitter PIN' });

    if (pin) {
      // Log in again with the freshly returned token and secret…
      authClient = new TwitterApi({
        appKey: auth.appKey,
        appSecret: auth.appSecret,
        accessToken: oauth_token,
        accessSecret: oauth_token_secret,
      });
      const { client: loggedClient, accessToken, accessSecret } = await authClient.login(pin);
      await this.files.writeCache('login-credentials.json', { accessToken, accessSecret });
      this.oAuth1Client = loggedClient;
      return Promise.resolve(this.oAuth1Client);
    } else {
      return Promise.reject();
    }
  }
  return Promise.reject();
}

export async function getOAuth2Client(this: Twitter): Promise<TwitterApi> {
  if (this.options.useApi !== true) return Promise.reject();

  if (this.options.auth?.bearerToken) {
    return Promise.resolve(new TwitterApi(this.options.auth.bearerToken));
  }

  if (this.options.auth?.clientId && this.options.auth?.clientSecret) {
    return Promise.reject();
  } else {
    return Promise.reject();
  }
}