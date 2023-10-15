type TwitterUserIndexEntry = {
  id?: string,
  handle?: string,
  displayName?: string
}

export class TwitterUserIndex extends Map<string, TwitterUserIndexEntry> {
  add(input: TwitterUserIndexEntry | TwitterUserIndexEntry[]) {
    if (Array.isArray(input)) {
      input.map(i => this.add(i));
    } else {
      this.set(this.toKey(input), input);
    }
  }

  getId(input: string) {
    return [...this.values()].filter(v => v.id === input);
  }

  getHandle(input: string) {
    return [...this.values()].filter(v => v.handle === input);
  }

  protected toKey(input: TwitterUserIndexEntry) {
    return `${input.id}\t${input.handle}\t$input.displayName`;
  }
}