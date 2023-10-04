# Livejournal Import

I haven't had a Livejournal for close to two decades, but I wrote a hell of a lot of stuff there when I did. So if there are *modern* ways to get this data out of Livejournal (or, more likely Dreamwidth), someone else will have to implement them.

## Sources

- Year-by-year XML exports from **LJArchive**, an open source program that stopped getting updates before Obama was elected. LJArchive, notably, captured each entry's comments but ignored anything that was posted to a closed group. So all my public posts got saved but ones to smaller communities are lost to the mists of time. Probably for the best. LJArchive also (tragically) didn't save any information about the user picture assigned to each post.
- Locally saved versions of anything I posted using **Semagic**, a Windows Livejournal client that made posting less of a pain. Semagic didn't save comments, but it did preserve the user picture. Also it saved things in a proprietary file format that was never really documented. Parsing those files is basically a shot in the dark: it worked for my posts, but if you have .slj files sitting around I can't promise the migrator won't choke on them.

## Data Scrubbing

Semagic and a few other Livejournal clients had a tendency to flip the 'mood' and 'music' fields, which is incredibly frustrating and annoying for some people. Cough, me. This importer looks for ` - `, which almost all clients used to separate song name and artist name, and if it finds that in the 'mood' field, swaps mood and music.

Livejournal also had a set of custom tags (`<lj-user>`, `<lj-poll>`, and `<lj-cut>`) that were often used in post bodies. The import detects and transforms those; in particular, if the `lj-cut` tag is present it's used to construct a 'summary' property in addition to the full text in the 'entry' property.

These can be toggled using the `respectCut` and `fixMusicMoods` flags in the import options.
