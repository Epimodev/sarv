#!/usr/bin/env node
import path from 'path';
import zlib from 'zlib';
import sade from 'sade';
import fse from 'fs-extra';
import mime from 'mime';
import compressible from 'compressible';
import prompts from 'prompts';
import kleur from 'kleur';
import { formatFileSize } from './utils';

interface CompressibleFile {
  absolutePath: string;
  relativePath: string;
  size: number;
}

interface CompressedFile {
  relativePath: string;
  size: number;
  gzipSize: number;
  brotliSize: number;
}

sade('sarv-compress <dir>', true)
  .version('1.1.0')
  .describe('Compress text files')
  .example('public')
  .action(run)
  .parse(process.argv);

async function run(dir: string) {
  const dirname = dir ? path.resolve(dir) : path.resolve();

  const files = await getCompressableFiles(dirname);

  logCompressibleFiles(dirname, files);

  const { confirm }: { confirm: boolean } = await prompts({
    name: 'confirm',
    type: 'confirm',
    initial: true,
    message: 'Are you sure to create compressed version (gzip and brotli)?',
  });

  if (confirm) {
    const startTime = Date.now();
    const compressedFiles = await Promise.all(files.map(compressFile));
    const endTime = Date.now();
    const duration = endTime - startTime;

    logCompressSuccess(compressedFiles, duration);
  }
}

/**
 * Find compressible files in a directory
 *
 * @param dir - dirname where to find compressible files
 * @return Promise with compressible files
 */
async function getCompressableFiles(dir: string): Promise<CompressibleFile[]> {
  const files: CompressibleFile[] = [];
  await fillFilePaths(files, dir, dir);
  return files;
}

/**
 * Fill accumulator array with compressible files
 *
 * @param acc - list to fill
 * @param dir - dirname where to find files to compress
 * @param baseDir - base dirname where to find files to compress
 */
async function fillFilePaths(acc: CompressibleFile[], dir: string, baseDir: string) {
  const dirPaths = await fse.readdir(dir);

  const promises = dirPaths.map(async dirPath => {
    const absolutePath = path.join(dir, dirPath);
    const stats = await fse.stat(absolutePath);
    if (stats.isDirectory()) {
      await fillFilePaths(acc, absolutePath, baseDir);
    } else {
      const ext = path.extname(absolutePath).substr(1);
      const mimeType = mime.getType(ext);
      const isCompressible = mimeType ? compressible(mimeType) : false;
      const relativePath = absolutePath.slice(baseDir.length + 1);

      if (isCompressible) {
        acc.push({
          absolutePath,
          relativePath,
          size: stats.size,
        });
      }
    }
  });

  await Promise.all(promises);
}

/**
 * Display compressible files
 *
 * @param dirname - dirname to compress
 * @param files - compressible files
 */
function logCompressibleFiles(dirname: string, files: CompressibleFile[]): void {
  const pathLenghts = files.map(({ relativePath }) => relativePath.length);
  const longestPathLength = Math.max(...pathLenghts);
  const fileLines = files.map(file => {
    const size = formatFileSize(file.size).padStart(9);
    return `${kleur.cyan(file.relativePath.padEnd(longestPathLength))} ${kleur.bold(size)}`;
  });

  process.stdout.write(`Those files are compressible in ${kleur.cyan(dirname)}\n\n`);
  process.stdout.write(fileLines.join('\n'));
  process.stdout.write('\n');
  process.stdout.write('\n');
}

/**
 * Log success message
 *
 * @param files - compressed files
 * @param duration - duration of compression
 */
function logCompressSuccess(files: CompressedFile[], duration: number): void {
  const nbSeconds = duration / 1000;
  const pathLenghts = files.map(({ relativePath }) => relativePath.length);
  const longestPathLength = Math.max(...pathLenghts);

  const fileLines = files.map(file => {
    const path = kleur.cyan(file.relativePath.padEnd(longestPathLength));
    const size = kleur.bold(formatFileSize(file.size).padStart(9));
    const gzipSize = kleur.bold(formatFileSize(file.gzipSize).padStart(9));
    const brotliSize = kleur.bold(formatFileSize(file.brotliSize).padStart(9));

    return `${path}${size} -> gzip:${gzipSize} -> brotli:${brotliSize}`;
  });

  process.stdout.write(
    `\n${kleur.green('Files compressed with success!!!')} ${kleur.grey(
      `(in ${nbSeconds.toFixed(1)} seconds)`,
    )}\n\n`,
  );
  process.stdout.write(fileLines.join('\n'));
  process.stdout.write('\n');
  process.stdout.write('\n');
}

/**
 * Compress a file (to gzip and brotli) and write compressed version next to file
 *
 * @param fileInfo - info about file to compress
 * @return Promise with compressed info
 */
async function compressFile(fileInfo: CompressibleFile): Promise<CompressedFile> {
  const file = await fse.readFile(fileInfo.absolutePath);
  const brotli = await brotliCompress(file);
  const gzip = await gzipCompress(file);
  const brotliPath = `${fileInfo.absolutePath}.br`;
  const gzipPath = `${fileInfo.absolutePath}.gz`;

  await Promise.all([fse.writeFile(brotliPath, brotli), fse.writeFile(gzipPath, gzip)]);

  return {
    relativePath: fileInfo.relativePath,
    size: fileInfo.size,
    gzipSize: gzip.byteLength,
    brotliSize: brotli.byteLength,
  };
}

/**
 * Compress a file to brotli
 *
 * @param file - buffer to compress
 * @return Promise with compressed buffer
 */
function brotliCompress(file: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const params = { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 };
    zlib.brotliCompress(file, { params }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Compress a file to gzip
 *
 * @param file - buffer to compress
 * @return Promise with compressed buffer
 */
function gzipCompress(file: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gzip(file, { level: 9 }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}
