import { Middleware, Request, Response } from 'polka';
import colors from 'kleur';

/**
 * Check if a value contains a logInfo key
 *
 * @param value - value to check
 * @return true if the value has `logInfo` key
 */
function hasLogInfo(
  value: any,
): value is { logInfo: { [key: string]: string | number | undefined } } {
  return !!value.logInfo;
}

/**
 * Format date to display in logs
 *
 * @param date - date to format
 * @return formatted date
 */
function formatDate(date: Date): string {
  const dateTime = date
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '');
  return colors.magenta(dateTime);
}

/**
 * Format status code to display in logs
 *
 * @param code - http status code
 * @return formatted status
 */
function formatStatus(code: number): string {
  if (code < 300) {
    return colors.green(code);
  }
  if (code < 400) {
    return colors.yellow(code);
  }
  return colors.red(code);
}

/**
 * Format request duration to display in logs
 *
 * @param duration - request duration
 * @return formatted request duration
 */
function formatDuration(duration: number): string {
  const unit = duration < 1000 ? 'ms' : 's';
  const displayedDuration = duration < 1000 ? duration : duration / 1000;
  const displayedValue = `${displayedDuration}${unit}`.padStart(6);

  return colors.bold(displayedValue);
}

/**
 * Format file path to display in logs
 *
 * @param path - served file path
 * @return formatted file path
 */
function formatPath(path: string): string {
  return colors.grey(path);
}

/**
 * Get response content length
 *
 * @param res - response object
 * @return response content length
 */
function getContentLength(res: Response): number {
  if (hasLogInfo(res) && res.logInfo['content-length'] !== undefined) {
    return res.logInfo['content-length'] as number;
  }
  return 0;
}

/**
 * Get response content encoding
 *
 * @param res - response object
 * @return response content encoding
 */
function getEncoding(res: Response): string {
  if (hasLogInfo(res) && res.logInfo['content-encoding'] !== undefined) {
    return res.logInfo['content-encoding'] as string;
  }
  return 'no encoding';
}

/**
 * Format content length to display in logs
 *
 * @param contentLength - response content length
 * @return formatted content length
 */
function formatContentLength(contentLength: number): string {
  const ONE_MEGABYTES = 1000000;
  const ONE_KILOBYTES = 1000;
  let value = contentLength;
  let suffix = 'B';
  if (contentLength >= ONE_MEGABYTES) {
    value = contentLength / ONE_MEGABYTES;
    suffix = 'MB';
  } else if (contentLength >= ONE_KILOBYTES) {
    value = contentLength / ONE_KILOBYTES;
    suffix = 'KB';
  }

  return colors.cyan(`${value.toFixed(1)} ${suffix}`.padStart(9));
}

/**
 * Format content encoding to display in logs
 *
 * @param encoding - response content encoding
 * @return formatted content encoding
 */
function formatEncoding(encoding: string): string {
  return colors.grey(encoding.padStart(11));
}

/**
 * Write request log line
 *
 * @param start - request start date
 * @param req - request object
 * @param res - response object
 */
function writeLogLine(start: Date, req: Request, res: Response): void {
  const end = Date.now();

  const date = formatDate(start);
  const status = formatStatus(res.statusCode);
  const duration = formatDuration(end - start.getTime());
  const path = formatPath(req.path);

  process.stdout.write(`[${date}] - ${status} - ${duration} - ${path}\n`);
}

/**
 * Write request log line with content encoding and content length
 *
 * @param start - request start date
 * @param req - request object
 * @param res - response object
 */
function writeVerboseLine(start: Date, req: Request, res: Response): void {
  const end = Date.now();

  const contentLength = formatContentLength(getContentLength(res));
  const encoding = formatEncoding(getEncoding(res));
  const date = formatDate(start);
  const status = formatStatus(res.statusCode);
  const duration = formatDuration(end - start.getTime());
  const path = formatPath(req.path);

  process.stdout.write(
    `[${date}] - ${status} - ${encoding} - ${contentLength} - ${duration} - ${path}\n`,
  );
}

/**
 * Middleware to add log for each request on finish
 *
 * @param req - request object
 * @param res - response object
 * @param next - next handler
 */
function requestLogger(verbose: boolean) {
  const writeLine = verbose ? writeVerboseLine : writeLogLine;

  const logger: Middleware = (req, res, next) => {
    const start = new Date();
    res.addListener('finish', () => {
      writeLine(start, req, res);
    });

    if (next) {
      next();
    }
  };

  return logger;
}

export default requestLogger;
