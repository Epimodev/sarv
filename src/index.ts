#!/usr/bin/env node
import path from 'path';
import sade from 'sade';
import polka, { Request } from 'polka';
import getPort from 'get-port';
import getLocalAccess from 'local-access';
import staticServe from './static-serve';
import requestLogger from './request-logger';
import { parseIntValue, printReadyMessage } from './utils';
import { StaticServerOptions } from './types';

sade('sarv [dir]', true)
  .version('1.1.0')
  .describe('Run a static file server')
  .example('public')
  .example('public --port 8080')
  .example('public --fallback /index.html')
  .option('-h, --host', 'Hostname to bind', 'localhost')
  .option('-p, --port', 'Port to bind', 3000)
  .option('-i, --index', 'Define index file name', 'index.html')
  .option('-f, --fallback', 'Define fallback file')
  .option('-m, --maxage', 'Define max-age value (in sec) in "Cache-Control" header', 1209600) // 2 weeks in seconds
  .option('-v, --verbose', 'Display content encoding and content length in logs')
  .action(startServer)
  .parse(process.argv);

async function startServer(dir: string, options: { [key: string]: string | undefined }) {
  const dirname = dir || path.resolve();
  const assets = await staticServe(dirname, (options as unknown) as StaticServerOptions);
  const { host } = options;
  const wantedPort = parseIntValue(options.port);
  const port = await getPort({ port: wantedPort, host });

  polka<Request>()
    .use(requestLogger(!!options.verbose))
    .use(assets)
    .listen({ port, host }, (err?: any) => {
      if (err) throw err;

      const localAccess = getLocalAccess({ port, hostname: host });
      printReadyMessage(path.resolve(dirname), localAccess);
    });
}
