const {
    defineConfig,
} = require("eslint/config");

const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.mocha,
            expect: "readonly",
            sinon: "readonly",
        },

        ecmaVersion: 2020,
        sourceType: "module",
        parserOptions: {},
    },

    extends: compat.extends("eslint:recommended"),

    rules: {
        "no-console": "off",

        "no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
        }],

        "prefer-const": "error",
        "no-var": "error",
    },

    ignores: ["dist/", "coverage/", "node_modules/", "templates/", ".nyc_output/"],
}]);
