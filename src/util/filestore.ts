import path from "path"

import gpkg from 'fast-glob';
const { async: glob } = gpkg;

import fpkg, { PathLike } from 'fs-extra';
const { readFile, readJson, writeFile, writeJson, statSync, existsSync, ensureDirSync } = fpkg;

import is from "@sindresorhus/is";

/**
 * A light wrapper for a bunch of file system manipulation tasks we do during import
 * and processing.
 * 
 * Right now it just wraps the 'correct' directories for raw files to live in: the 
 * goal is to establish a 'root' for all files that can be used consistently whether
 * it's on the local filesystem or an S3 bucket or whatever.
 */
export class Filestore {
  get importPath() {
    return path.join(__dirname, 'raw');
  }

  get outputPath() {
    return path.join(__dirname, 'data');
  }

  /**
   * Gets metadata for a file or directory; this includes creation time and 
   */
  stat = statSync;

  /**
   * Ensures that a particular directory path exists. 
   */
  ensure = ensureDirSync;

  /**
   * Checks whether a file or directory exists; returns TRUE or FALSE.
   */
  exists = existsSync

  /**
   * Finds files and directories matching a particular glob string. 
   */
  find = glob;

  /**
   * Writes a file to the filesystem; if the name ends with 'json' the data
   * is automatically deserialized.
   */
  async read(file: PathLike) {
    if (file.toLocaleString().toLocaleLowerCase().endsWith('.json')) {
      return readJson(file);
    } else {
      return readFile(file);
    }
  }

  /**
   * Writes a file to the filesystem; if the name ends with 'json' the data
   * is automatically serialized.
   */
  async write(file: PathLike, data: unknown) {
    if (file.toLocaleString().toLocaleLowerCase().endsWith('.json')) {
      return writeJson(file, data, { spaces: 2});
    } else if (is.string(data) || is.buffer(data)) {
      return writeFile(file, data);
    }
  }
}