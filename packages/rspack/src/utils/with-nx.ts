import { Configuration, ExternalItem } from '@rspack/core';
import * as path from 'path';
import { getCopyPatterns } from './get-copy-patterns';
import { SharedConfigContext } from './model';
import { normalizeAssets } from './normalize-assets';

export function withNx(_opts = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: SharedConfigContext
  ): Configuration {
    const isProd =
      process.env.NODE_ENV === 'production' || options.mode === 'production';

    const project = context.projectGraph.nodes[context.projectName];
    const sourceRoot = path.join(context.root, project.data.sourceRoot);

    const externals: ExternalItem = {};
    let externalsType: Configuration['externalsType'];
    if (options.target === 'node') {
      const projectDeps =
        context.projectGraph.dependencies[context.projectName];
      for (const dep of Object.values(projectDeps)) {
        const externalNode = context.projectGraph.externalNodes[dep.target];
        if (externalNode) {
          externals[externalNode.data.packageName] =
            externalNode.data.packageName;
        }
      }
      externalsType = 'commonjs';
    }

    const updated: Configuration = {
      ...config,
      target: options.target,
      mode: options.mode,
      context: context.root,
      devtool:
        options.sourceMap === 'hidden'
          ? ('hidden-source-map' as const)
          : options.sourceMap
          ? ('source-map' as const)
          : (false as const),
      entry: {
        main: {
          import: [path.join(context.root, options.main)],
        },
      },
      output: {
        path: path.join(context.root, options.outputPath),
        publicPath: '/',
        filename:
          isProd && options.target !== 'node'
            ? '[name].[contenthash:8][ext]'
            : '[name][ext]',
      },
      devServer: {
        port: 4200,
        hot: true,
      } as any,
      module: {},
      plugins: config.plugins ?? [],
      resolve: {
        tsConfigPath: path.join(context.root, options.tsConfig),
      },
      infrastructureLogging: {
        debug: false,
      },
      builtins: {
        copy: {
          patterns: getCopyPatterns(
            normalizeAssets(options.assets, context.root, sourceRoot)
          ),
        },
        progress: {},
      },
      externals,
      externalsType,
      stats: {
        colors: true,
        preset: 'normal',
      },
    };

    if (options.optimization) {
      updated.optimization = {
        ...config.optimization,
        minimize: true,
      };
    }

    return updated;
  };
}
