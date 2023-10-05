# The EatonFYI Migration

This is a giant pile of utility code meant to migrate things from all the services
I've posted on to a centralized database that I own. It's meant to be relatively
clean but it's migration code for my old tumblr posts, not banking infrastructure.
It's ugly.

The intent is to grab stuff I've created or contributed to communities I've been a
part of, and put it in a form where I can make a consolidated archive or generate
little sub-archives as desired. That makes for some fun spelunking and parsing work.

## How it works

Each source of data has its own importer (aka, something that implements the Importer
class). Importers are all expected to handle (or politely error out of) a few basic
operations:

- **Parsing and retrieving**: Via scraping, the use of an official API, parsing of
  pre-downloaded 'archive my stuff' files, etc; hoover up everything that can be
  found for a particular information source. One-off importers can also just
  crawl through a folder full of custom text files or what not to generate the data.
- **Asset mirroring**: Optionally save local copies of remote media and other bits
  (for example, taking screenshots or caching OpenGraph/OEmbed data for linked
  URLs to avoid future linkrot)
- **Local cacheing**: Create a local JSON formatted version of the data, stored on
  the filesystem. It should be possible to clear and regenerate this cache via
  the parse/retrieve step, but it should also be possible to save the cached files
  and re-run migration from them if the third party API goes dark.
- **Data sanitization**: Going from the cached 'canonical' data to something usable.
  This can involve everything from link unshortening to HTML filtering to correcting
  known issues (like the fact that my livejournal exports often have the mood and
  music fields swapped, due to a borked client in the early aughts).
- **Data normalization**: The final endgame is the creation of a single consistent
  schema to store a bunch of my stuff. Some of the details are still being ironed
  out, but this is a distinct step that comes after the cacheing; that allows
  me to tweak the final endpoints without re-running absolutely everything.
- **Final data insertion**: The plan right now is to dump things into an ArangoDB
  instance, due to the fact that it's an easy document store, supports fun graph
  traversal tricks, and can serve as its own public-facing REST API with custom
  middleware and endpoints. My own site is likely to be a static site, but I'll
  generate it from this datastore rather than outputting a bunch of intermediary
  markdown files.

## Utilities/Wrappers

In addition to the service-specific import classes, there are several utility libraries
in the project that get used and reused across the various importers.

- **BaseImport**: The aforementioned base class for each import; it provides scaffolding the
  operations described above, with automatic setup of Database and Filestore instances.
  It provides a centralized logger, as well, because nothing is worse than scattering
  console.log() bits all over code that you eventually want to *be quiet*. Generally speaking,
  it tries to make sure a given import only needs to bother with parsing a data sourc and
  sanitizing data to "fully participate" in a bulk migration.
- **Filestore**: While optional, this helper class wraps works well with the assumptions
  outlined above; it maintains three parallel "buckets" for files: Input, Cache, and Output.
  It exposes wrapped versions of `stat`, `readFile`, `writeFile`, `ensureDir`, and `find`
  that are sandboxed to a particular bucket, making it easy to call `findInput(globPattern)`,
  `readInput(fileName)`, then `writeCache(newFile)` with the resulting data. Its read and
  write methods can optionally auto-parse and auto-serialize data based on filenames (json,
  yaml, xml, csv, and tsv).
- **Database**: An extremely light wrapper around the `arangodbjs` library. It provides
  helper functions that automate setting up document and relationship collections in bulk,
  automatically generating "correct" IDs for entities when they're saved, and so on.
  The idea isn't to automate complex queries, but to make saving, linking, and updating
  easy as pie. Long term, I'd love to make this database neutral so data can be routed
  to other destinations, but I strongly suspect everyone with good ideas about homebrew
  ORMs has either already shipped or gone mad.
- **File and Data Format Helpers**: Grouped by format; `import { Html } from fyiapi`
  gives you helper functions related to Html, `import { Markdown } from fyiapi` gives
  you those related to markdown, and so on and so forth. That makes it easy to call,
  say, `const $ = Html.fromCheerio(myData)` or `const plain = Html.toTxt(myData)`
  from an import class.

## Supported/planned services

- [x] Twitter (from account archive .zips & saved analytics CSVs)
- [ ] Bluesky
- [ ] Mastodon
- [x] Instagram (account archive zips, no public API)
- [ ] Flickr (metadata, possible file mirroring, via API)
- [x] Medium (account archive zips, no public API)
- [x] Tumblr (user info, blog info, and posts via API)
- [ ] Wordpress (TBD, will prioritize downloaded account XML files)
- [x] Livejournal (from LJArchive XML files and Semagic save files)
- [x] Metafilter (inefficiently scraped, would love to improve that)
- [ ] Reddit (do this before the API dies, probably)
- [x] Pinboard (account archives json files, API access is TBD)
- [x] Jekyll (standard posts and drafts)
- [x] Movable Type (blogs, user accounts, posts, and comments from a SQL DB)
- [ ] Drupal (very TBD, targeting node and comment extraction from a SQL DB)
- [ ] Facebook (targeting saved account archives, don't have an account anymore)
- [ ] Quora (I have some stuff kicking around there )
- [ ] Goodreads (this will probably require scraping)
- [ ] Letterboxd (want to use their public API)
- [ ] LibraryThing

## Third Party Tools

In order to do all the parsing, processing, and normalization, we encounter a whole
pile of different formats. It's a little horrifying. Some tools floating around in
the project's dependency tree are useful across many imports; most of the time they're
responsible for what gets exposed by the file and data format helpers mentioned above.

These may change as the project evolves; I'm not terribly worried about the size of
the dependency list, because migration tends to be a one-shot deal, rather than an
ongoing burden on a particular server, but I'm always up for improving things.

- API and scraping
  - [got](https://github.com/sindresorhus/got) for http stuff that goes beyond fetch
  - [crawlee](https://crawlee.dev) for complicated scraping
  - [playwright](https://github.com/Microsoft/playwright) for screenshots and dynamic stuff
  - [tumblr.js](https://github.com/tumblr/tumblr.js/), [node-pinboard](https://github.com/maxmechanic/node-pinboard),
    and a growing list of others for direct API access.
- Parsing and munging
  - [url-tools](https://github.com/autogram-is/url-tools) for parsing, filtering, and normalizing URLs
  - [turndown](https://github.com/mixmark-io/turndown) for converting HTML into markdown
  - [greymatter](https://github.com/jonschlinkert/gray-matter) for reading/writing blog frontmatter
  - [textile-js](https://github.com/GehDoc/textile-js) for turning MovableType's textile
    formatting into HTML, before turning it back into useful things with turndown and
    html-to-text…
  - [html-to-text](https://github.com/html-to-text/node-html-to-text) for scrubbing and transforming HTML
    in various ways; it's an amazing general purpose library.
  - [cheerio](https://cheerio.js.org) and [cheerio json mapper](https://github.com/denkan/cheerio-json-mapper)
    for html and xml parsing with jquery-like syntax
  - [xmldom-ts](https://github.com/backslash47/xmldom) and [xpath-ts2](https://github.com/EagleoutIce/xpath)
    for the really dank stuff
- File/Data formats
  - [yaml](https://github.com/eemeli/yaml) for reading/writing YAML
  - [fast-csv](https://github.com/C2FO/fast-csv) for reading and writing tsv/csv files
  - [json-nd](https://github.com/thyms/json-nd) for reading/writing newline-delimited JSON, which
    a number of hosted content APIs like Sanity.io and Contentful use for bulk imports.
- General utility
  - [uuid](https://github.com/uuidjs/uuid) and [object-hash](https://github.com/puleos/object-hash)
    for quickly generating hashes *and* random identifiers with no fuss or muss
  - [fast-glob](https://github.com/mrmlnc/fast-glob) for file-finding in the piles of raw data
  - [date-fns](https://date-fns.org) for date parsing, because yuck
  - [mysql2](https://github.com/sidorares/node-mysql2) for yoinking stuff out of MySQL;
    might switch to something agnostic later; being able to import and export SQLITE
    might be useful for caching, as well.

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
