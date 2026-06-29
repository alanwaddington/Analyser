// FIT file parsing and normalisation
// Wraps fit-file-parser and converts raw messages into the Activity domain type

export { normalise } from './parser';
export { parseInWorker, ParseCancelledError } from './parseInWorker';
export type { ParseJob } from './parseInWorker';
export { parseFitFile } from './parseFitFile';
