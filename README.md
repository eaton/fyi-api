# The EatonFYI Migration

This is a giant pile of utility code meant to migrate things from all the services
I've posted on to a centralized database that I own. It's meant to be relatively
clean but it's migration code for my old tumblr posts, not banking infrastructure.
It's ugly.

## How it works

A single central database, a very light framework for service-specific importers,
a handful of helpful wrappers for database and filesystem work,  and a giant pile
of scraping, parsing, and data transformation tools dragged along for the ride.

Each service gets its own importer (aka, something that implements the Importer
class). Importers are all expected to handle (or politely error out of) a few basic
operations:

- *Parsing and retrieving*: Via scraping, the use of an official API, or parsing of
  already-downloaded files, hoover up everything that can be found for a particular
  user account.
- *Local cacheing*:
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

## Utility classes

- **Filestore**: An optional helper with functions for reading and writing files (optionally
  parsing and stringifying common serialization formats based on the filename), globbing for files
  in the raw import directory, common metadata extraction, and light image manipulation.
- **Database**: Another light wrapper, this time around ArangoDB's JS library. It provides
  helper functions that automate setting up collections for imports, inserting bulk data
  with minimal ArangoDB-specific futzing, and so on.
- **BaseImport**: Base class for all the import work; it provides scaffolding for the six
  operations described above, with automatic setup of Database and Filestore instances.
  Imports can also declare the document collectiosn they'll need, and BaseImport takes care
  of ensuring they exist before imports are run, clearing/deleting them in bulk, and so on.

## So about that grab bag

In order to do all the parsing, processing, and normalization, we encounter a whole
pile of different formats. It's a little horrifying. Some tools floating around in
the project's dependency tree are useful across many imports:

- API and scraping
  - [got](https://github.com/sindresorhus/got) for http stuff that goes beyond fetch
  
  - [crawlee](https://crawlee.dev) for complicated scraping
  - [playwright](https://github.com/Microsoft/playwright) for screenshots of stuff
- Parsing and munging
  - [url-tools](https://github.com/autogram-is/url-tools) for parsing, filtering, and normalizing URLs
  - [cheerio](https://cheerio.js.org) for html and xml parsing with jquery-like syntax
  - [html-to-text](https://github.com/html-to-text/node-html-to-text) for scrubbing and transforming HTML in various ways
  - [turndown](https://github.com/mixmark-io/turndown) for converting HTML into markdown
  - [greymatter](https://github.com/jonschlinkert/gray-matter) for reading/writing blog frontmatter
- File/Data formats
  - [json-nd](https://github.com/thyms/json-nd) for reading/writing newline-delimited JSON
  - [yaml](https://github.com/eemeli/yaml) for reading/writing YAML
  - [fast-csv](https://github.com/C2FO/fast-csv) for reading and writing tsv/csv files
- General utility
  - [fast-glob](https://github.com/mrmlnc/fast-glob) for file-finding in the piles of raw data
  - [date-fns](https://date-fns.org) for date parsing, because yuck
  - [mysql2](https://github.com/sidorares/node-mysql2) for yoinking stuff out of MySQL;
    might switch to something agnostic later
  - [uuid](https://github.com/uuidjs/uuid) and [object-hash](https://github.com/puleos/object-hash) for quickly generating hashes *and* random identifiers with no fuss or muss

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
| Jekyll                |         | markdown  |           |           |           |
| Movable Type          |         | sql       |           |           |           |
| Drupal                |         | sql*      |           |           |           |

## Some philosophical points

- Making an all-encompassing archive of one's own stuff is technically interesting,
  and psychologically risky. It's probably good that a lot of old stuff died,
  because most of our hot takes are trash. I solve that by archiving everything
  and adding a layer of 'destinations', each of which can have their own logic for
  publishing or ignoring stuff in the repository.
- Original content should be preserved in as close a form to its original one as
  possible. All of the migrations have a 'cache' step where data is turned into
  pre-parsed JSON files. Separating and grouping the data differently (i.e.,
  splitting huge everything-from-2020.xml files into separate ones) is fine
  at that stage, but any *changes* to the data happen later. That makes it
  possible to back up the cache for later re-processing, even if the source of
  the cached data is lost. Canonical examples include remapping URLs, fixing
  broken and/or horrifying HTML, translating between HTML, Markdown, and plaintext,
  etc.
- Enormous media files, if they still exist in their 'original' location, should
  be archived and backed up but the remote links should be preserved as long as
  VC funded cloud services are giving everybody piles of free storage and bandwidth.
  Don't look a gift server in the mouth, but keep a local cache handy.
- This tool is for making a *repository of stuff one person created*, not a universal
  everything archive. An edge case is the parent/reply relationship. If the user wrote
  a comment on a post, archiving the original post for context might make sense. If the
  user wrote a post and other people commented on it in its original location,
  preserving those comments probably makes sense, too. The Twitter importer handles
  this by attempting to cache quote-tweeted tweets before the service makes that
  impossible, and may eventually try to cache tweets-being-replied-to for the same
  reason. The Metafilter importer caches the *original post* that a user's comment
  lived on, but makes no attempt to preserve the whole discussion thread. [pause]
  Ah, shit, we probably could actually. Hmmm.
