import path from 'path';
import { BaseImport } from '../base-import.js';

export class Wordpress extends BaseImport {
  async fillCache(): Promise<void> {
    const glob = '**/*.WordPress.*.xml';
    const foundFiles = await this.input.findAsync(glob);
    for (const file of foundFiles) {
      await this.fillCacheFromExport(file);
    }
  }

  async fillCacheFromExport(file: string) {
    const regex = /([\w]+)\.WordPress\.(\d{4}-\d{2}-\d{2})\.xml/;
    const [username, date] = (path.parse(file).name.match(regex) ?? []).slice(
      1
    );
    this.log(`Caching export for ${username} from ${date}`);

    // This is usually well-structured enough we might be able to parse it straight to JSON
    // const data = await this.input.readAsync(file);
  }
}
