/**
 * Allows us to quickly build index of bookmark/favorite/retweet style
 * Tweet interactions for specific users. It can be used as a quick and
 * dirty bucket of tweets with the `tidx.add(id)`, but if full index
 * records with user handles and dates are added, grouped and filtered
 * lists can be pulled out easily.
 */
type TweetIndexEntry = {
  /**
   * The ID of an individual Tweet
   */
  id: string;

  /**
   * The handle of the user who added the tweet
   *
   * @type {?string}
   */
  handle?: string;

  /**
   * The date the Tweet was added to a particular list, in ISO format
   */
  date?: string;

  /**
   * The name of the list the tweet was added to
   */
  list?: string;
};

export class TweetIndex extends Map<string, TweetIndexEntry> {
  constructor(items?: string[] | TweetIndexEntry[]) {
    super();
    for (const item of items ?? []) {
      this.add(item);
    }
  }

  add(item: string | TweetIndexEntry) {
    super.set(this.keyFor(item), this.valueFor(item));
  }

  protected keyFor(input: string | TweetIndexEntry): string {
    if (typeof input === 'string') {
      return this.keyFor({ id: input });
    } else {
      return `${input.list ?? 'default'}\t${input.handle ?? 'unknown'}\t${
        input.id
      }\t${input.date ?? '1970-01-01T00:00:00'}`;
    }
  }

  protected valueFor(input: string | TweetIndexEntry): TweetIndexEntry {
    if (typeof input === 'string') {
      return { id: input };
    } else {
      return input;
    }
  }

  protected populate(input: TweetIndexEntry): Required<TweetIndexEntry> {
    return {
      handle: 'unknown',
      list: 'default',
      date: '1970-01-01T00:00:00',
      ...input
    };
  }

  /**
   * Returns the index's results grouped by handle and list name
   */
  batchedvalues() {
    const results: Record<string, Record<string, TweetIndexEntry[]>> = {};
    for (const item of [...this.values()]) {
      const populated = this.populate(item);
      results[populated.handle] ??= {};
      results[populated.handle][populated.list] ??= [];
      results[populated.handle][populated.list].push(item);
    }
    return results;
  }
}
