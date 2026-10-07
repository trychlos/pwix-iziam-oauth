/*
 * pwix:iziam-oauth/src/server/js/check_npms.js
 */

import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';

// openid-client is loaded and version-checked natively in functions.js;
// jose is its transitive dependency. Meteor's package-scoped resolver cannot
// reliably inspect these ESM packages and otherwise reports false missing peers.

checkNpmVersions({
    'lodash': '^4.17.0'
},
    'pwix:iziam-oauth'
);
