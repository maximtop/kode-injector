/**
 * @file
 */

require('@babel/register')({
    extensions: ['.ts'],
    ignore: [/node_modules/],
    rootMode: 'upward',
});

const config = require('./webpack.config');

module.exports = config.default || config;
