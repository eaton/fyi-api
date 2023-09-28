import path from "path"

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
}