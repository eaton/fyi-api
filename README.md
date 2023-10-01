# The EatonFYI Migration

This is a giant pile of utility code meant to migrate things from all the services I've posted on to a centralized database that I own. It's meant to be relatively clean but it's migration code for my old tumblr posts, not banking infrastructure. It's ugly.

## How it works

A single central database, a very light framework for service-specific importers,
a handful of helpful wrappers for database and filesystem work,  and a giant pile
of scraping, parsing, and data transformation tools dragged along for the ride.

Each service gets its own importer (aka, something that implements the Importer
class). Importers are all expected to handle (or politely error out of) six basic
operations:

- *Raw archiving*: Via scraping or the use of an official API, hoover up everything
  that can be found for a particular user account. For any currently-operating
  services, this is kind of ground zero.
- *Structured import*: Importing the service data into the database/knowledge graph
  for happiness.
- *Data normalization*: Normalizing the service data into a consistent schema. (i.e.,
  Tumblr 'link' posts and Pinboard bookmarks treated as the same entity type)
- *Incremental updates*: Re-archive or re-import new additions from a service without
  blowing everything away and redoing it all.
- *Asset caching*: Save local copies of remote media and other bits (for example,
  taking screenshots or caching OpenGraph/OEmbed data for linked URLs to avoid
  future linkrot)

## What it prioritizes

The intent is to grab stuff I've created or contributed to communities I've been a
part of, and put it in a form where I can make a consolidated archive or generate
little sub-archives as desired.

In general, it ignores *other peoples' stuff* with some exceptions: comments posted
by other people about my content, and original posts I commented on (enough data
to make the reply make sense is desired, but the goal is to link to context rather
than archive it wholesale).

## Planned/Supported sources

| Service               | Archive | Import    | Normalize | Update    | Assets    |
| --------------------- | ------- | --------- | --------- | --------- | --------- |
| Twitter               |         | archive   |           |           |           |
| Bluesky               |         |           |           |           |           |
| Mastodon              |         |           |           |           |           |
| Facebook              |         |           |           |           |           |
| Quora                 |         |           |           |           |           |
| Instagram             | Yes     | archive   |           |           |           |
| Flickr                |         |           |           |           |           |
| Medium                |         | archive   |           |           |           |
| Tumblr                | Yes     | json      |           |           |           |
| Wordpress             |         |           |           |           |           |
| Livejournal           |         | xml, sjl  |           |           |           |
| Metafilter             | Yes     | json      |           |           |           |
| Reddit                |         |           |           |           |           |
| Goodreads             |         |           |           |           |           |
| Letterboxd            |         |           |           |           |           |
| LibraryThing          |         |           |           |           |           |
| Pinboard              |         | json      |           |           |           |
| Jekyll/11ty markdown  |         |           |           |           |           |
| Movable Type          |         |           |           |           |           |
| Drupal                |         |           |           |           |           |
