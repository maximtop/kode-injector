/**
 * @file
 */

/* eslint-disable import/no-unresolved */
import path from 'node:path';
import { rspack, type Configuration } from '@rspack/core';
import { defineConfig } from '@rspack/cli';

import packageJson from './package.json';
import { ArchivePlugin } from './scripts/build/archive-plugin';
import { updateLocalesMSGName, updateManifest } from './scripts/build/helpers';
import { CHANNEL_ENVS, type BuildEnv } from './scripts/constants';

const channelEnv = process.env.CHANNEL_ENV;

if (channelEnv !== CHANNEL_ENVS.DEV && channelEnv !== CHANNEL_ENVS.PROD) {
    throw new Error(`Unsupported CHANNEL_ENV: ${channelEnv ?? '(missing)'}`);
}

const CHANNEL_ENV = channelEnv as BuildEnv;
const IS_DEV = CHANNEL_ENV === CHANNEL_ENVS.DEV;
const ROOT_PATH = import.meta.dirname;
const SRC_PATH = path.resolve(ROOT_PATH, 'src');
const BUILD_PATH = path.resolve(ROOT_PATH, 'build');
const OUTPUT_PATH = path.join(BUILD_PATH, CHANNEL_ENV);

const plugins: NonNullable<Configuration['plugins']> = [
    new rspack.CopyRspackPlugin({
        patterns: [
            {
                from: path.join(SRC_PATH, 'manifest.json'),
                to: 'manifest.json',
                transform: (content) => updateManifest(
                    content,
                    { version: packageJson.version },
                ),
            },
            {
                from: path.join(SRC_PATH, 'assets'),
                to: 'assets',
            },
            {
                from: path.join(SRC_PATH, '_locales'),
                to: '_locales',
                transform: (content) => updateLocalesMSGName(content, CHANNEL_ENV),
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
];

if (!IS_DEV) {
    plugins.push(new ArchivePlugin(
        OUTPUT_PATH,
        path.join(BUILD_PATH, `${packageJson.version}-${CHANNEL_ENV}.zip`),
    ));
}

export default defineConfig({
    mode: IS_DEV ? 'development' : 'production',
    target: 'web',
    devtool: 'inline-source-map',
    entry: {
        background: path.join(SRC_PATH, 'pages/background'),
        popup: path.join(SRC_PATH, 'pages/popup'),
        options: path.join(SRC_PATH, 'pages/options'),
        'content-script': path.join(SRC_PATH, 'pages/content-script'),
    },
    output: {
        path: OUTPUT_PATH,
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
                localIdentName: IS_DEV
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
                                development: IS_DEV,
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
});
