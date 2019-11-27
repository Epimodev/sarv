import colors from 'kleur';
import clearConsole from 'console-clear';

/**
 * Parse a string to integer
 *
 * @param value - string to parse
 * @return parsed integer or undefined if string isn't a number
 */
export function parseIntValue(value: string | undefined): number | undefined {
  if (value) {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Format file size
 *
 * @param size - file size
 * @return formatted file size
 */
export function formatFileSize(size: number): string {
  const ONE_MEGABYTES = 1000000;
  const ONE_KILOBYTES = 1000;
  let value = size;
  let suffix = ' B';
  if (size >= ONE_MEGABYTES) {
    value = size / ONE_MEGABYTES;
    suffix = 'MB';
  } else if (size >= ONE_KILOBYTES) {
    value = size / ONE_KILOBYTES;
    suffix = 'KB';
  }

  return `${value.toFixed(1)} ${suffix}`;
}

/**
 * Print message when server is ready
 *
 * @param path - serving directory path
 * @param host - host urls
 */
export function printReadyMessage(path: string, host: { local: string; network: string }) {
  clearConsole(true); // keep console history

  const message = `
--${colors.inverse('APPLICATION READY')}-------------------------------------------

  ${colors.grey(`- Folder:         ${path}`)}

  ${colors.grey(`- Local access:   ${host.local}`)}
  ${colors.grey(`- Network access: ${host.network}`)}

--${colors.inverse('LOGS')}-----------------------------------------------------------

`;
  process.stdout.write(message);
}
