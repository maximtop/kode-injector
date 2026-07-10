/**
 * @file
 */

/* eslint-disable import/no-unresolved */
import path from 'node:path';
import { rspack, type Configuration } from '@rspack/core';

import packageJson from './package.json';
import { ArchivePlugin } from './scripts/build/archive-plugin';
import { updateLocalesMSGName, updateManifest } from './scripts/build/helpers';
import {
    BROWSER_TARGETS,
    CHANNEL_ENVS,
    type BrowserTarget,
    type BuildEnv,
} from './scripts/constants';

const ROOT_PATH = import.meta.dirname;
const SRC_PATH = path.resolve(ROOT_PATH, 'src');
const BUILD_PATH = path.resolve(ROOT_PATH, 'build');

/**
 * Creates one browser-specific Rspack configuration.
 *
 * @param browser Browser receiving the generated extension.
 * @param buildEnv Selected build channel.
 *
 * @returns Browser-specific Rspack configuration.
 */
export const createRspackConfig = (
    browser: BrowserTarget,
    buildEnv: BuildEnv,
): Configuration => {
    const isDev = buildEnv === CHANNEL_ENVS.DEV;
    const channelPath = path.join(BUILD_PATH, buildEnv);
    const outputPath = path.join(channelPath, browser);

    const plugins: NonNullable<Configuration['plugins']> = [
        new rspack.CopyRspackPlugin({
            patterns: [
                {
                    from: path.join(SRC_PATH, 'manifest.json'),
                    to: 'manifest.json',

                    /**
                     * Applies package and browser metadata to the manifest.
                     */
                    transform: (content) => updateManifest(
                        content,
                        {
                            browser,
                            version: packageJson.version,
                        },
                    ),
                },
                {
                    from: path.join(SRC_PATH, 'assets'),
                    to: 'assets',
                },
                {
                    from: path.join(SRC_PATH, '_locales'),
                    to: '_locales',

                    /**
                     * Applies the build-channel suffix to locale catalogs.
                     */
                    transform: (content) => updateLocalesMSGName(content, buildEnv),
                },
            ],
        }),
        new rspack.HtmlRspackPlugin({
            template: path.join(SRC_PATH, 'pages/popup/index.html'),
            filename: 'popup.html',
            chunks: ['popup'],
        }),
        new rspack.HtmlRspackPlugin({
            template: path.join(SRC_PATH, 'pages/options/index.html'),
            filename: 'options.html',
            chunks: ['options'],
        }),
        new ArchivePlugin(
            outputPath,
            path.join(channelPath, `${browser}.zip`),
        ),
    ];

    if (browser === BROWSER_TARGETS.FIREFOX) {
        plugins.push(new rspack.HtmlRspackPlugin({
            template: path.join(SRC_PATH, 'pages/background/index.html'),
            filename: 'background.html',
            chunks: ['background'],
        }));
    }

    return {
        name: browser,
        mode: isDev ? 'development' : 'production',
        target: 'web',
        devtool: 'inline-source-map',
        entry: {
            background: path.join(SRC_PATH, 'pages/background'),
            popup: path.join(SRC_PATH, 'pages/popup'),
            options: path.join(SRC_PATH, 'pages/options'),
            'content-script': path.join(SRC_PATH, 'pages/content-script'),
        },
        output: {
            path: outputPath,
            filename: '[name].js',
            cssFilename: '[name].css',
            publicPath: '',
            clean: true,
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
        experiments: {
            css: true,
        },
        module: {
            generator: {
                'css/auto': {
                    exportsOnly: false,
                    exportsConvention: 'camel-case-only',
                    localIdentName: isDev
                        ? '[path][name]__[local]--[hash]'
                        : '[hash]',
                },
            },
            rules: [
                {
                    test: /\.[jt]sx?$/,
                    exclude: /node_modules/,
                    loader: 'builtin:swc-loader',
                    options: {
                        jsc: {
                            parser: {
                                syntax: 'typescript',
                                tsx: true,
                                decorators: true,
                            },
                            target: 'es2020',
                            transform: {
                                legacyDecorator: true,
                                decoratorMetadata: false,
                                useDefineForClassFields: true,
                                react: {
                                    runtime: 'classic',
                                    development: isDev,
                                    refresh: false,
                                },
                            },
                        },
                        module: {
                            type: 'es6',
                        },
                    },
                    type: 'javascript/auto',
                },
                {
                    test: /\.(png|svg|jpe?g|gif|woff2?|eot|ttf|otf)$/,
                    type: 'asset/resource',
                },
                {
                    test: /\.p?css$/,
                    use: ['postcss-loader'],
                    type: 'css/auto',
                },
            ],
        },
        plugins,
    };
};
