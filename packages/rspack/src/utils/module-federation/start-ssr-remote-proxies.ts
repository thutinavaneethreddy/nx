import { logger } from '@nx/devkit';
import type { Express } from 'express';
import { existsSync, readFileSync } from 'fs';
import type { StaticRemotesConfig } from './parse-static-remotes-config';

export function startSsrRemoteProxies(
  staticRemotesConfig: StaticRemotesConfig,
  mappedLocationsOfRemotes: Record<string, string>,
  sslOptions?: { pathToCert: string; pathToKey: string }
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createProxyMiddleware } = require('http-proxy-middleware');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');

  let sslCert: Buffer;
  let sslKey: Buffer;
  if (sslOptions && sslOptions.pathToCert && sslOptions.pathToKey) {
    if (existsSync(sslOptions.pathToCert) && existsSync(sslOptions.pathToKey)) {
      sslCert = readFileSync(sslOptions.pathToCert);
      sslKey = readFileSync(sslOptions.pathToKey);
    } else {
      logger.warn(
        `Encountered SSL options in project.json, however, the certificate files do not exist in the filesystem. Using http.`
      );
      logger.warn(
        `Attempted to find '${sslOptions.pathToCert}' and '${sslOptions.pathToKey}'.`
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const http: typeof import('http') = require('http');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const https: typeof import('https') = require('https');

  logger.info(`NX Starting static remotes proxies...`);
  for (const app of staticRemotesConfig.remotes) {
    const expressProxy: Express = express();
    /**
     * SSR remotes have two output paths: one for the browser and one for the server.
     * We need to handle paths for both of them.
     * The browser output path is used to serve the client-side code.
     * The server output path is used to serve the server-side code.
     */

    expressProxy.use(
      createProxyMiddleware({
        target: `${mappedLocationsOfRemotes[app]}`,
        secure: sslCert ? false : undefined,
        changeOrigin: true,
        pathRewrite: (path) => {
          if (path.includes('/server')) {
            return path;
          } else {
            return `browser/${path}`;
          }
        },
      })
    );

    const proxyServer = (
      sslCert
        ? https.createServer(
            {
              cert: sslCert,
              key: sslKey,
            },
            expressProxy
          )
        : http.createServer(expressProxy)
    ).listen(staticRemotesConfig.config[app].port);
    process.on('SIGTERM', () => proxyServer.close());
    process.on('exit', () => proxyServer.close());
  }
  logger.info(`Nx SSR Static remotes proxies started successfully`);
}