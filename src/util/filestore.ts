import path from "path"

import gpkg from 'fast-glob';
const { async: glob } = gpkg;
type GlobOptions = Parameters<typeof glob>[1];

import fpkg, { PathLike } from 'fs-extra';
const { readFile, readJson, writeFile, writeJson, statSync, existsSync, ensureDirSync } = fpkg;

import { parse as parseYaml, stringify as serializeYaml } from 'yaml';

import is from "@sindresorhus/is";

export interface FilestoreOptions extends Record<string, unknown> {
  input?: string,
  output?: string,
  cache?: string,
  bucket?: string,
  readableOutput?: boolean,
}

export interface FilestoreReadOptions {
  [key: string]: unknown,
  parse?: boolean,
  throw?: boolean 
}

export interface FilestoreWriteOptions {
  [key: string]: unknown,
  serialize?: boolean,
  ensure?: boolean
}

/**
 * A light wrapper for a bunch of file system manipulation tasks we do during import
 * and processing.
 * 
 * Right now it just wraps the 'correct' directories for raw files to live in: the 
 * goal is to establish a 'root' for all files that can be used consistently whether
 * it's on the local filesystem or an S3 bucket or whatever.
 */
export class Filestore {
  static input = 'input';
  static cache = 'cache';
  static output = 'output';

  _bucket?: string;
  _input?: string;
  _output?: string;
  _cache?: string;

  readableOutput = true;

  get input(): string {
    if (this._input) return this._input;
    if (this._bucket) return path.join(Filestore.input, this._bucket);
    return Filestore.input;
  }
  
  set input(value: string | undefined) {
    this._input = value;
  }

  get cache(): string {
    if (this._cache) return this._cache;
    if (this._bucket) return path.join(Filestore.cache, this._bucket);
    return Filestore.cache;
  }

  set cache(value: string | undefined) {
    this._cache = value;
  }

  get output(): string {
    if (this._output) return this._output;
    if (this._bucket) return path.join(Filestore.output, this._bucket);
    return Filestore.output
  }

  set output(value: string | undefined) {
    this._output = value;
  }

  constructor(options?: FilestoreOptions) {
    this._input = options?.input;
    this._cache = options?.cache;
    this._output = options?.output;
    this._bucket =  options?.bucket;
    this.readableOutput = options?.readableOutput ?? true;

    this.ensureInput();
    this.ensureCache();
    this.ensureOutput();
  }

  /**
   * Gets metadata for a file or directory, including creation time and permissions
   */
  stat(path: string) {
    return statSync(path);
  }

  /**
   * Gets metadata for an item in the input directory
   */
  inputStat(path: string) {
    return this.stat(this.prefix(path, 'input'));
  }

  /**
   * Gets metadata for an item in the cache directory
   */
  cacheStat(path: string) {
    return this.stat(this.prefix(path, 'cache'));
  }

  /**
   * Gets metadata for an item in the output directory
   */
  outputStat(path: string) {
    return this.stat(this.prefix(path, 'output'));
  }


  /**
   * Creates a full directory path if it doesn't already exist. 
   */
  ensure(path: string) {
    ensureDirSync(path);
  }

  /**
   * A version of `ensure` auto-prefixed to the input directory. 
   */
  ensureInput(path: string = '') {
    this.ensure(this.prefix(path, 'input'));
  }

  /**
   * A version of `ensure` auto-prefixed to the cache directory. 
   */
  ensureCache(path: string = '') {
    this.ensure(this.prefix(path, 'cache'));
  }
  
  /**
   * A version of `ensure` auto-prefixed to the output directory. 
   */
  ensureOutput(path: string = '') {
    this.ensure(this.prefix(path, 'output'));
  }

  /**
   * Checks whether a file or directory exists; returns TRUE or FALSE.
   */
  exists(path: string): boolean {
    return existsSync(path);
  }

  /**
   * Checks whether a file or directory exists in the current `input` directory;
   * returns TRUE or FALSE.
   */
  existsInput(path: string) {
    return this.exists(this.prefix(path, 'input'));
  }

  /**
   * Checks whether a file or directory exists in the current `cache` directory;
   * returns TRUE or FALSE.
   */
  existsCache(path: string) {
    return this.exists(this.prefix(path, 'cache'));
  }

  /**
   * Checks whether a file or directory exists in the current `output` directory;
   * returns TRUE or FALSE.
   */
  existsOutput(path: string) {
    return this.exists(this.prefix(path, 'output'));
  }

  /**
   * Finds files and directories matching a particular glob string.
   */
  async find(input: string | string[], options?: GlobOptions, prefix?: string): Promise<string[]> {
    let globs: string | string[] = input;
    if (prefix) {
      globs = typeof(input) === 'string' ?
        this.prefix(input, prefix) :
        input.map(i => this.prefix(i, prefix));
    }
    return glob(globs, options);
  }

  /**
   * Wrapper for the `find` function that works inside the current input directory.
   */
  async findInput(globs: string | string[], options?: GlobOptions): Promise<string[]> {
    return this.find(globs, options, this.input)
      .then(paths => paths.map(
        p => p.startsWith(this.input) ? path.relative(this.input, p) : p
      ));
  }

  /**
   * Wrapper for the `find` function that prefixes all paths with the current cache directory.
   */
  async findCache(globs: string | string[], options: GlobOptions = {}): Promise<string[]> {
    return this.find(globs, options, this.cache)
      .then(paths => paths.map(
        p => p.startsWith(this.cache) ? path.relative(this.cache, p) : p
      ));
  }

  /**
   * Wrapper for the `find` function that prefixes all paths with the current cache directory.
   */
  async findOutput(globs: string | string[], options: GlobOptions = {}): Promise<string[]> {
    return this.find(globs, options, Filestore.output)
      .then(paths => paths.map(
        p => p.startsWith(this.output) ? path.relative(this.output, p) : p
      ));
  }

  /**
   * Writes a file to the filesystem; if the name ends with 'json' the data
   * is automatically deserialized.
   * 
   * By default, it will attempt to parse JSON and YAML files, returning them
   * as deserialized data structures.
   * 
   * By default, it will swallow read errors and simply return `undefined` if
   * files don't exist.
   */
  async read(file: PathLike, options?: FilestoreReadOptions) {
    const errorHandler = (err: unknown) => {
      if ((options?.throw === true) && (err instanceof Error)) {
        throw err;
      } else {
        return undefined;
      }
    };

    if (options?.parse !== false) {
      const extension = path.parse(file.toLocaleString()).ext.toLocaleLowerCase();
      if (extension === '.json') {
        return readJson(file).catch(errorHandler);
      } else if (extension === '.yaml' || extension === '.yml') {
        return readFile(file)
          .then(data => parseYaml(data.toString()))
          .catch(errorHandler);
      }
    }
    
    return readFile(file)
      .then(buffer => (options?.parse !== false) ? buffer.toString() : buffer)
      .catch(errorHandler);
  }

  /**
   * Prefixed version of `read` that looks in the current input directory.
   */
  async readInput(file: string, options?: FilestoreReadOptions) {
    return this.read(this.prefix(file, this.input), options);
  }

  /**
   * Prefixed version of `read` that looks in the current cache directory.
   */
  async readCache(file: string, options?: FilestoreReadOptions) {
    return this.read(this.prefix(file, this.cache), options);
  }

  /**
   * Prefixed version of `read` that looks in the current output directory.
   */
  async readOutput(file: string, options?: FilestoreReadOptions) {
    return this.read(this.prefix(file, this.output), options);
  }

  /**
   * Writes a file to the filesystem; if the name ends with 'json' the data
   * is automatically serialized.
   */
  async write(file: string, data: unknown, options?: FilestoreWriteOptions): Promise<void> {
    if (options?.ensurePath !== false) {
      this.ensure(path.parse(file).dir);
    }

    if (typeof(data) !== 'string' && options?.autoSerialize !== false) {
      const extension = path.parse(file.toLocaleString()).ext.toLocaleLowerCase();
      if (extension === '.json') {
        return writeJson(file, data, this.readableOutput ? { spaces: 2 } : {});
      } else if (extension === '.yaml' || extension === '.yml') {
        return writeFile(file, serializeYaml(data));
      }
    }

    if (is.string(data) || is.buffer(data)) {
      return writeFile(file, data);
    }

    throw new Error(`${file} couldn't be written.`)
  }

  /**
   * Prefixed version of `write` that directs output to the current cache directory.
   * 
   * Returns a promise that resolves to the fully prefixed filename that was generated.
   */
  async writeCache(file: string, data: unknown, options?: FilestoreWriteOptions): Promise<string> {
    const path = this.prefix(file, this.cache);
    return this.write(path, data, options)
      .then(() => path);
  }

  /**
   * Prefixed version of `write` that directs output to the current cache directory.
   * 
   * Returns a promise that resolves to the fully prefixed filename that was generated.
   */
  async writeOutput(file: string, data: unknown, options?: FilestoreWriteOptions): Promise<string> {
    const path = this.prefix(file, this.output);
    return this.write(path, data, options)
      .then(() => path);
  }

  /**
   * Internal utility function for prefixing a path; attempts to be smart about a lot
   * of potential weird scenarios but can be faked out.
   * 
   * - Absolute paths (ie, those that start with *are not* prefixed
   * - `input`, `cache`, and `output` are expanded to the current Filestore directories
   * - If the input already starts with the prefix, it won't be added a second time.
   */
  prefix(input: string, prefix: string) {
    if (path.isAbsolute(input)) return input;

    let fullPrefix = prefix;
    switch (prefix) {
      case Filestore.input:
        fullPrefix = this.input;
        break;
      case Filestore.cache:
        fullPrefix = this.cache;
        break;
      case Filestore.output:
        fullPrefix = this.output;
        break;
    }
    
    if (input.startsWith(fullPrefix)) return input;
  
    return path.join(fullPrefix, input);
  }
}