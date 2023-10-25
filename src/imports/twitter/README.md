# Twitter Importer

This importer is designed to hoover up a handful of data sources, potentially
multiple sources in one migration operation:

- Text files containing arbitrary lists of Twitter URLs or Tweet IDs
- One or more 'Account Archive' zip files, downloaded from Twitter
- Daily tweet metrics exports from analytics.twitter.com

In its "caching" phase, it:

1. Builds a giant undifferentiated pool of tweets and twitter media entities
2. If user archives were imported, builds indexes of which tweets were fav'd
   or RT'd by the user
3. Compiles any daily metrics exports into per-user datasets
4. Optionally scrapes Twitter for additional metadata (username and date for
   favorited tweets, full metadata for quoted tweets, alt text for tweets
   with media, screenshots of tweets matching particular criteria, etc)
5. Optionally builds an index of threads from the reply-to information in
   the cached tweets
6. Optionally caches media assets locally
7. Optionally unshortens and validates links that appear in the tweets

When fully populated, the cache directory keeps things in the following
directory structures:

- `[username]-archive-[yyyy-MM-dd].json` (archive-specific metadata)
- `[username]-details.json` (account metadata)
- `[username]-favorites.json` (tweet ID list)
- `[username]-retweets.json` (tweet ID list, with dates they were retweeted)
- `[username]-metrics.csv` (daily records for an account's engagement numbers)
- `tweets/[yyyy]/[MM]/tweet-[tweet-id].json` (individually cached tweets)
- `screenshots/[yyyy]/[MM]/[tweet-id].[jpeg or png]` (screenshots of tweets)
- `threads/[yyyy]/thread-[tweet-id].json`) (indexes of thread parents and children)
- `media/[media-id].[extension]` (backed-up media files)
- `url-history.csv` (master list of unshortened and resolved URLs)

The end result of that caching phase is a cluster of metadata, and a huge
archive of tweets that can be used to reconstruct a particular user's
timeline, the combined timelines of multiple users, or an Elon-proof
snapshot of arbitrary tweets.

Actual output is phase two, because procrastination rocks.
