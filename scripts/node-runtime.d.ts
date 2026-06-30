declare module 'node:fs/promises' {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function readFile(path: string, encoding: BufferEncoding): Promise<string>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function unlink(path: string): Promise<void>;
  export function writeFile(path: string, data: string, encoding: BufferEncoding): Promise<void>;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

type BufferEncoding = 'utf8';

declare const process: {
  argv: string[];
  exitCode: number | undefined;
};
