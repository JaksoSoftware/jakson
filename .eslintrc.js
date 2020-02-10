module.exports = {
  parser: '@typescript-eslint/parser',  // Specifies the ESLint parser
  extends: [
    'plugin:@typescript-eslint/recommended',  // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    // TODO run prettier through eslint too
  ],
  parserOptions: {
    ecmaVersion: 2018,  // Allows for the parsing of modern ECMAScript features
    sourceType: 'module',  // Allows for the use of imports,
    project: ['tsconfig-eslint.json'],
    noWatch: true
  },
  rules: {
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. "@typescript-eslint/explicit-function-return-type": "off",
    '@typescript-eslint/member-delimiter-style': [
      'error', {
        multiline: {
          delimiter: 'none'
        }
      }
    ],
    '@typescript-eslint/camelcase': [
      'error', {
        properties: 'never'
      }
    ],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-use-before-define': ["error", { "functions": false, "classes": false }],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/prefer-readonly': 'warn'
  }
}
