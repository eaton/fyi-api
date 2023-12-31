import { BaseImport, BaseImportOptions } from '../index.js';
import { TwitterMetricsRow } from './types.js';
import { parseString } from '@fast-csv/parse';
import { Text } from 'mangler';

export interface TwitterMetricsOptions extends BaseImportOptions {
  outputFormat?: 'csv' | 'json';
  splitUsers?: boolean;
}

export class TwitterMetrics extends BaseImport<TwitterMetricsRow[]> {
  declare options: TwitterMetricsOptions;

  constructor(options: TwitterMetricsOptions = {}) {
    options = {
      outputFormat: 'csv',
      splitUsers: true,
      ...options
    };
    super(options);
    this.cacheData = [];
  }

  async loadCache(): Promise<void> {
    this.cacheData = this.cache.read('metrics.json', 'auto') as TwitterMetricsRow[];
    if (!this.cacheData || this.cacheData.length === 0) {
      await this.fillCache();
    }
  }

  async fillCache(): Promise<TwitterMetricsRow[]> {
    const metrics = await this.input.findAsync({ matching:
      'daily_tweet_activity_metrics_*.csv'
    });
    const metricsRegex =
      /daily_tweet_activity_metrics_(.+)_\d{8}_\d{8}_(\w+).csv/;
    for (const file of metrics) {
      const [handle] = file.match(metricsRegex)?.slice(1) ?? [];
      await this.input.readAsync(file, "utf8").then((raw) =>
        parseString(raw ?? '', { headers: true })
          .on('error', (error) => this.log(error))
          .on('data', (row) => {
            const mappedRow = Object.fromEntries(
              Object.entries(row).map(([k, v]) => [
                Text.toCase.camel(k),
                v === '-' ? undefined : v
              ])
            ) as TwitterMetricsRow;
            this.cacheData?.push({ handle, ...mappedRow });
          })
      );
    }
    await this.cache.writeAsync(`metrics.json`, this.cacheData ?? []);
    this.log(
      `Cached ${metrics.length} files (covering ${
        this.cacheData?.length || 0
      } days)`
    );
    return Promise.resolve(this.cacheData ?? []);
  }
}
