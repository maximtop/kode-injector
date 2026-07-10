module.exports = (api) => {
    api.cache(false);
    return {
        presets: [
            '@babel/preset-env',
            '@babel/preset-react',
            '@babel/preset-typescript',
        ],
        plugins: [
            ['@babel/plugin-transform-runtime', { corejs: 3 }],
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-proposal-class-properties', { loose: false }],
        ],
    };
};
