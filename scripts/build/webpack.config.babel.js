import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import ZipWebpackPlugin from 'zip-webpack-plugin';

import { CHANNEL_ENVS } from '../constants';
import { updateLocalesMSGName, updateManifest } from './helpers';

const packageJson = require('../../package.json');

const { CHANNEL_ENV = CHANNEL_ENVS.DEV } = process.env;

const IS_DEV = CHANNEL_ENV === CHANNEL_ENVS.DEV;

const BUILD_PATH = '../../build';
const SRC_PATH = '../../src';
const BACKGROUND_PATH = path.resolve(__dirname, SRC_PATH, 'pages', 'background');
const POPUP_PATH = path.resolve(__dirname, SRC_PATH, 'pages', 'popup');
const OPTIONS_PATH = path.resolve(__dirname, SRC_PATH, 'pages', 'options');
const CONTENT_SCRIPT_PATH = path.resolve(__dirname, SRC_PATH, 'pages', 'content-script');

const plugins = [
    new CopyWebpackPlugin({
        patterns: [
            {
                context: 'src',
                from: 'manifest.json',
                to: 'manifest.json',
                transform: (content) => updateManifest(
                    content,
                    IS_DEV,
                    { version: packageJson.version },
                ),
            },
            {
                context: 'src',
                from: 'assets',
                to: 'assets',
            },
            {
                context: 'src',
                from: '_locales',
                to: '_locales',
                transform: (content) => updateLocalesMSGName(content, CHANNEL_ENV),
            },
        ],
    }),
    new HtmlWebpackPlugin({
        template: path.join(BACKGROUND_PATH, 'index.html'),
        filename: 'background.html',
        chunks: ['background'],
    }),
    new HtmlWebpackPlugin({
        template: path.join(POPUP_PATH, 'index.html'),
        filename: 'popup.html',
        chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
        template: path.join(OPTIONS_PATH, 'index.html'),
        filename: 'options.html',
        chunks: ['options'],
    }),
];

if (IS_DEV) {
    plugins.push(
        new CleanWebpackPlugin({
            cleanAfterEveryBuildPatterns: ['!**/*.json', '!assets/**/*'],
        }),
    );
} else {
    plugins.push(
        new ZipWebpackPlugin({
            path: '../',
            filename: `${packageJson.version}-${CHANNEL_ENV}.zip`,
        }),
    );
}

const config = {
    mode: IS_DEV ? 'development' : 'production',
    devtool: IS_DEV ? 'eval-cheap-module-source-map' : false,
    entry: {
        background: BACKGROUND_PATH,
        popup: POPUP_PATH,
        options: OPTIONS_PATH,
        'content-script': CONTENT_SCRIPT_PATH,
    },
    output: {
        path: path.resolve(__dirname, BUILD_PATH, CHANNEL_ENV),
        filename: '[name].js',
        publicPath: '',
    },
    resolve: {
        extensions: ['.js', '.jsx'],
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        babelrc: true,
                    },
                },
            },
            {
                test: /\.(png|svg|jpe?g|gif|woff2?|eot|ttf|otf)$/,
                type: 'asset/resource',
            },
            {
                test: /\.p?css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            importLoaders: 1,
                            modules: {
                                compileType: 'module',
                                mode: 'local',
                                auto: true,
                                exportGlobals: false,
                                localIdentName: IS_DEV ? '[path][name]__[local]--[hash:base64:5]' : '[hash:base64]',
                                exportLocalsConvention: 'camelCaseOnly',
                                exportOnlyLocals: false,
                            },
                        },
                    },
                    'postcss-loader',
                ],
            },
        ],
    },
    plugins,
};

export default config;
