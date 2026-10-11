/*
 * pwix:iziam-oauth/src/server/js/check_npms.js
 */

import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';

// whitelist packages which are not well handled by the standard ESM import
//  by requiring directly the package.json
if( false ){
    // even the explicit require doesn't let checkNpmVersions() find the openid-client version
    //  so rely on iziamOAuth.s.engine() function
    //require( 'openid-client/package.json' );
}

checkNpmVersions({
    'lodash': '^4.17.0',
    'openid-client': '^6.8.4'
},
    'pwix:iziam-oauth'
);
