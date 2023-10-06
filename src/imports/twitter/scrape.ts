/**
 * Twitter has become increasingly agressive about moving any automated
 * traffic to its API, and (coincidentally) increasing the API usage rates
 * by a factor of 10 or more. So, here we are — still scraping to get
 * certain data.
 * 
 * There are two main approaches used here:
 * 
 * - Load a copy of headless Chrome and control it using Playwright.
 *   Log network traffic to get the raw data goodness, scrape the DOM
 *   to extract anything necessary, and generate screenshots to
 *   preserve stuff that's likely to vanish behind paywalls or service
 *   failure.
 * 
 * - Hit the OEmbed endpoint at publish.twitter.com that's used for
 *   'tweet embedding' and twase out the important bits. This doesn't
 *   us as much information as some techniques, but it's particularly
 *   effective at getting some basic metadata for favorites.
 */