// Wrapper for a suite of tools to un-shorten URLs, remap URLs based on known redirects,
// remap twitter URLs, and so on.
//
// How to do that?
//
// - Generate an internal list of old URL and the internal content IDs they map to while
//   running the migrations. Save the final output and use it to replace links.
// - Check https://github.com/tweetback/tweetback for links to specific users tweets;
//   it's a small set of users but as good a place as any to start.
// - Request the URL and return the chain of redirects, prioritizing the final one.
//   For particularly egregious shorteners that use JS based redirects, this might
//   get hairy. De-AMPing URLs would be good, too.
// - Use the library of dead URL shortening sites hosted by the Internet Archive to
//   resolve dead shortlinks
// - For dead links, consider checkign the wayback machine, at least to generate a
//   screenshot or capture some metadata.
//
// The shortener should be usable in 'quickly correct internal links' mode as well as
// 'hunt down that link no matter what' mode.

export * from './url-resolver.js';
export * from './types.js';
