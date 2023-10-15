import { BaseImport, BaseImportOptions } from "./base-import.js";

export interface FileImportOptions extends BaseImportOptions {

}

export interface FileImportCache extends Record<string, unknown> {

}

export class FileImport extends BaseImport<FileImportCache> {
  loadCache(): Promise<void | Record<string, FileImportCache>> {
    return Promise.resolve({});
  }

  fillCache(): Promise<void | Record<string, FileImportCache>> {
    return Promise.resolve({});
  }
}