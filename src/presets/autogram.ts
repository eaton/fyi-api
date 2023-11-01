import 'dotenv/config';
import { AutogramImport } from "../index.js";

const ai = new AutogramImport({
  files: { input: process.env.AUTOGRAM_INPUT },
});
await ai.loadCache();