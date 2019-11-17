import path from 'path';
import fse from 'fs-extra';
import { Request, Response, Middleware } from 'polka';
import xxhash from 'xxhashjs';
import mime from 'mime';
import { StaticServerOptions, AvailableFile, AvailableFiles } from './types';

/**
 * Check if file exists
 *
 * @param path - file path
 * @return true if file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await fse.access(path);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get file info
 *
 * @param filePath
 * @param stats - path stats
 * @return file informations for static server.
 */
async function getFilePathInfo(filePath: string, stats: fse.Stats): Promise<AvailableFile> {
  const contentType = mime.getType(filePath);
  const gzipPath = `${filePath}.gz`;
  const brotliPath = `${filePath}.br`;

  const hasGzip = await fileExists(gzipPath);
  const hasBrotli = await fileExists(brotliPath);

  const gzip = hasGzip
    ? {
        path: gzipPath,
        size: (await fse.stat(gzipPath)).size,
      }
    : undefined;
  const br = hasBrotli
    ? {
        path: brotliPath,
        size: (await fse.stat(brotliPath)).size,
      }
    : undefined;

  return {
    path: filePath,
    contentType,
    size: stats.size,
    modifiedTime: stats.mtime.toUTCString(),
    etag: xxhash.h32(`${filePath}-${stats.size}-${stats.mtime.getTime()}`, 0xabcd).toString(16),
    gzip,
    br,
  };
}

/**
 * Fill array with static assets available in folder
 *
 * @param acc - accumulator of static paths data
 * @param dir - directory path to serve
 * @param baseDir - directory base path to serve
 */
async function fillStaticPaths(acc: AvailableFiles, dir: string, baseDir: string): Promise<void> {
  const dirPaths = await fse.readdir(dir);

  const promises = dirPaths.map(async dirPath => {
    const absPath = path.join(dir, dirPath);
    const stats = await fse.stat(absPath);
    if (stats.isDirectory()) {
      await fillStaticPaths(acc, absPath, baseDir);
    } else {
      const isCompressedFile = ['.br', '.gz'].includes(path.extname(absPath));

      if (!isCompressedFile) {
        const url = absPath.substr(baseDir.length);
        const filePathInfo = await getFilePathInfo(absPath, stats);
        acc[url] = filePathInfo;
      }
    }
  });

  await Promise.all(promises);
}

/**
 * Get static assets available in folder
 *
 * @param dir - directory path to serve
 * @return available assets
 */
async function getStaticPaths(dir: string): Promise<AvailableFiles> {
  const staticPaths: AvailableFiles = {};
  await fillStaticPaths(staticPaths, dir, dir);
  return staticPaths;
}

/**
 * Create function to get file to serve
 *
 * @param staticPaths - available static files
 * @param indexPath - path to folder index
 * @param fallbackPath - fallback path in case no file is found
 * @return function which get available static file to send depending on request
 */
function getFileToServe(staticPaths: AvailableFiles, indexPath: string, fallbackPath?: string) {
  return (req: Request) => {
    const reqPath = req.path === '/' ? `/${indexPath}` : req.path;
    const file = staticPaths[reqPath];

    if (file) {
      return file;
    }

    // if file isn't found, we search for an index file
    const indexReqPath =
      reqPath.charAt(reqPath.length - 1) === '/'
        ? `${reqPath}${indexPath}`
        : `${reqPath}/${indexPath}`;
    const indexFile = staticPaths[indexReqPath];
    if (indexFile) {
      return indexFile;
    }

    // if index file isn't found, we search for fallback
    if (fallbackPath) {
      const fallbackFile = staticPaths[fallbackPath];
      if (fallbackFile) {
        return fallbackFile;
      }
    }

    return null;
  };
}

/**
 * Get headers to send
 *
 * @param file - file to serve
 * @param options - static server options
 * @return headers to send
 */
function getHeaders(
  file: AvailableFile,
  options: StaticServerOptions,
): { [key: string]: string | number } {
  // set no-cache to force browser to call the server before get assets from cache (check if etag header changed)
  // set must-revalidate to force browser to call the server before get assets from cache (check if not expired)
  const headers: { [key: string]: string | number } = {
    'last-modified': file.modifiedTime,
    etag: file.etag,
    'cache-control': `no-cache, must-revalidate, max-age=${options.maxage}`,
  };
  if (file.contentType) {
    headers['content-type'] = file.contentType;
  }

  return headers;
}

/**
 * Send not modified response to say browser it can use file in cache
 *
 * @param headers - headers to send
 * @param res - response object
 */
function sendNotModified(headers: { [key: string]: string | number }, res: Response) {
  res.writeHead(304, headers);
  (res as any).logInfo = headers;
  res.end();
}

/**
 * Send file
 *
 * @param file - informations about file to send
 * @param headers - headers to send
 * @param req - request object
 * @param res - response object
 */
function sendFile(
  file: AvailableFile,
  headers: { [key: string]: string | number },
  req: Request,
  res: Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const acceptEncoding = req.headers['accept-encoding'];
    if (acceptEncoding) {
      if (acceptEncoding.includes('br') && file.br) {
        headers['content-encoding'] = 'br'; // eslint-disable-line no-param-reassign
        headers['content-length'] = file.br.size; // eslint-disable-line no-param-reassign
        res.writeHead(200, headers);
        (res as any).logInfo = headers;
        fse
          .createReadStream(file.br.path)
          .on('error', reject)
          .pipe(res)
          .on('finish', resolve);
        return;
      }

      if (acceptEncoding.includes('gzip') && file.gzip) {
        headers['content-encoding'] = 'gzip'; // eslint-disable-line no-param-reassign
        headers['content-length'] = file.gzip.size; // eslint-disable-line no-param-reassign
        res.writeHead(200, headers);
        (res as any).logInfo = headers;
        fse
          .createReadStream(file.gzip.path)
          .on('error', reject)
          .pipe(res)
          .on('finish', resolve);
        return;
      }
    }

    headers['content-length'] = file.size; // eslint-disable-line no-param-reassign
    res.writeHead(200, headers);
    (res as any).logInfo = headers;
    fse
      .createReadStream(file.path)
      .on('error', reject)
      .pipe(res)
      .on('finish', resolve);
  });
}

/**
 * Create a middleware to serve static files
 *
 * @param dir - directory path to serve
 * @param options - server options
 * @return polka middleware
 */
async function staticServe(dir: string, options: StaticServerOptions) {
  const staticDir = path.resolve(dir);
  const staticPaths = await getStaticPaths(staticDir);
  const getFile = getFileToServe(staticPaths, options.index, options.fallback);

  const serve: Middleware = async (req, res, next) => {
    const file = getFile(req);

    if (file) {
      const headers = getHeaders(file, options);

      const requestEtag = req.headers['if-none-match'];

      // if request etag is equals to file etag, it means browser has already the file in cache
      // so we send a `not-modified` response to say browser it can use file from cache
      if (requestEtag === file.etag) {
        sendNotModified(headers, res);
      } else {
        try {
          await sendFile(file, headers, req, res);
        } catch (e) {
          process.stderr.write(`${e}\n`);
          res.writeHead(500);
          res.end();
        }
      }
    } else if (next) {
      next();
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  };

  return serve;
}

export default staticServe;
