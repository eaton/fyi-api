
// Placeholder for an importer that imports a jekyll blog (primarily markdown files with
// YAML front matter). It pulls in files as atomic units, and doesn't take advantage of
// any template logic for processing etc.
import path from "path";
import { BaseImport, BaseImportOptions, uuid } from "../index.js";
import matter from 'gray-matter';

export type JekyllPost = {
  [key: string]: unknown,
  published?: boolean,
  date?: string,
  format?: string,
  slug?: string,
  excerpt?: string,
  content: string,
  frontmatter: Record<string, unknown>,
  skipOnOutput?: boolean
}

export type JekyllConfig = {
  [key: string]: unknown,

}

export interface JekyllImportOptions extends BaseImportOptions {
  /**
   * An array of folders inside the jekyll project to scan for blog posts
   * 
   * @default ['_posts', '_drafts']
   */
  folders?: string[],

  /**
   * An array of file extensions to treat as blog posts
   * 
   * @default ['md', 'markdown', 'htm', 'html']
   */
  fileTypes?: string[],

  /**
   * An optional callback to manipulate the post data before it's cached or saved.
   */
  parser?: (post: JekyllPost) => JekyllPost
}

export class Jekyll extends BaseImport {
  collections = { jekyll_post: {} };
  folders: string[];
  fileTypes: string[];
  parser?: (post: JekyllPost) => JekyllPost;

  constructor(options?: JekyllImportOptions) {
    super(options);
    this.folders = options?.folders ?? ['_posts', '_drafts'];
    this.fileTypes = options?.fileTypes ?? ['md', 'markdown', 'htm', 'html'];
    this.parser = options?.parser;
  }

  async doImport(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async fillCache(): Promise<void> {
    if (this.files.existsInput('_config.yml')) {

      // The config file may also have useful bits we can use later in the import;
      //
      // `permalink`: would let us predict the rendered filename; defaults to `date`
      // `markdown_ext`: comma-delimited list of markdown extensions. Defaults to "markdown,mkdown,mkdn,mkd,md"
      // `data_dir`: Directory where data files live. Defaults to "_data"
      // `defaults`: Arbitary frontmatter defaults. See https://jekyllrb.com/docs/configuration/front-matter-defaults/

      const config = await this.files.readInput('_config.yml');
      await this.files.writeCache('config.json', config)
      this.log(`Jekyll _config file written to ${this.files.cache}`);
    }

    // Right now we're not importing any jekyll data files. we probably want to.
    
    const postFiles = await this.files.findInput(
      `**/{${this.folders.join(',')}}/**/*.{${this.fileTypes.join(',')}}`
    );

    for (const filePath of postFiles) {
      const [originalPath, date, slug, format] = filePath.match(/.*(\d{4}-\d{2}-\d{2})-(.*)\.(\w+)$/) ?? [];
      const parsedPost = matter.read(path.join(this.files.input, filePath));

      let data: JekyllPost = {
        path: originalPath,
        date,
        slug,
        format,
        frontmatter: parsedPost.data,
        published: filePath.includes('/_posts/'),
        content: parsedPost.content,
        excerpt: parsedPost.excerpt,
      }

      if (this.parser) data = this.parser(data);
      const cachePath = await this.files.writeCache(
        path.join('posts', uuid(filePath) + '.json'),
        data
      );
      this.log(`${filePath} -> ${cachePath}`);
    }
    return Promise.resolve();
  }
}