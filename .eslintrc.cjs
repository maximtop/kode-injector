module.exports = {
    extends: [
        'airbnb',
        'plugin:jsdoc/recommended',
    ],
    env: {
        browser: true,
    },
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    plugins: [
        '@typescript-eslint',
    ],
    globals: {
        chrome: true,
    },
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
                ecmaVersion: 2020,
                sourceType: 'module',
            },
            rules: {
                'no-use-before-define': 'off',
                'no-undef': 'off',
                'no-unused-vars': 'off',
                'no-shadow': 'off',
                '@typescript-eslint/no-shadow': 'error',
                'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
            },
        },
        {
            files: [
                'scripts/build/**/*.ts',
                'scripts/locales/**/*.ts',
                'tests/**/*.ts',
                'rspack.config.ts',
            ],
            rules: {
                'import/no-extraneous-dependencies': ['error', {
                    devDependencies: true,
                    optionalDependencies: false,
                    peerDependencies: false,
                }],
                'no-restricted-syntax': 'off',
                'no-continue': 'off',
            },
        },
        {
            files: ['scripts/locales/**/*.ts'],
            rules: {
                'jsdoc/require-file-overview': 'off',
                'jsdoc/sort-tags': 'off',
                'max-len': 'off',
            },
        },
        {
            files: ['tests/**/*.ts'],
            rules: {
                'jsdoc/require-file-overview': 'off',
                'jsdoc/require-jsdoc': 'off',
                'jsdoc/require-description': 'off',
                'no-useless-constructor': 'off',
                'no-empty-function': 'off',
                'object-curly-newline': 'off',
            },
        },
    ],
    rules: {
        indent: ['error', 4, { SwitchCase: 1 }],
        'import/extensions': ['error', 'ignorePackages', {
            js: 'never',
            jsx: 'never',
            ts: 'never',
            tsx: 'never',
        }],
        'import/prefer-default-export': 'off',
        'react/jsx-indent': ['error', 4],
        'react/jsx-indent-props': ['error', 4],
        'react/prop-types': 'off',
        'arrow-body-style': 'off',
        'class-methods-use-this': 'off',
        // Type information is provided by TypeScript declarations.
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/require-throws': 'error',
        'jsdoc/require-file-overview': 'error',
        'jsdoc/require-param-description': 'off',
        'jsdoc/require-property-description': 'off',
        'jsdoc/require-returns-description': 'off',
        'jsdoc/require-returns': 'off',
        'jsdoc/require-param': ['error', {
            checkDestructured: false,
            contexts: [
                'FunctionDeclaration',
                'FunctionExpression',
                'MethodDefinition',
            ],
        }],
        'jsdoc/check-param-names': ['error', {
            checkDestructured: false,
        }],
        'jsdoc/no-undefined-types': 'off',
        'jsdoc/require-returns-check': 'off',
        'jsdoc/require-jsdoc': ['error', {
            contexts: [
                'ClassDeclaration',
                'ClassProperty',
                'MethodDefinition',
                'TSInterfaceDeclaration',
                'TSInterfaceDeclaration TSPropertySignature',
                'TSTypeAliasDeclaration',
                'TSTypeAliasDeclaration > TSTypeLiteral > TSPropertySignature',
                'ExportNamedDeclaration > FunctionDeclaration',
                'FunctionDeclaration',
                'FunctionExpression',
            ],
            require: {
                ArrowFunctionExpression: true,
                FunctionDeclaration: true,
                FunctionExpression: true,
            },
        }],
        'jsdoc/require-description': ['error', {
            contexts: [
                'ClassDeclaration',
                'ClassProperty',
                'MethodDefinition',
                'TSInterfaceDeclaration',
                'TSInterfaceDeclaration TSPropertySignature',
                'TSTypeAliasDeclaration',
                'TSTypeAliasDeclaration > TSTypeLiteral > TSPropertySignature',
            ],
        }],
        'jsdoc/multiline-blocks': ['error', {
            noSingleLineBlocks: true,
            singleLineTags: [],
        }],
        'jsdoc/lines-before-block': ['error', {
            checkBlockStarts: false,
            excludedTags: [],
            ignoreSingleLines: false,
            lines: 1,
        }],
        'jsdoc/check-tag-names': ['warn', {
            definedTags: ['note'],
        }],
        'jsdoc/no-defaults': 'off',
        'jsdoc/tag-lines': ['error', 'any', {
            startLines: 1,
        }],
        'jsdoc/sort-tags': ['error', {
            linesBetween: 1,
            tagSequence: [
                { tags: ['file'] },
                { tags: ['template', 'class', 'async'] },
                { tags: ['note'] },
                { tags: ['see'] },
                { tags: ['param'] },
                { tags: ['returns'] },
                { tags: ['throws'] },
                { tags: ['example'] },
            ],
        }],
    },
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
            },
        },
    },
};
