/*
 * pwix:iziam-oauth/src/server/js/check_npms.js
 */

import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';

if( false ){
    // whitelist packages which are included via a subfolder or badly recognized
    require( 'jose/package.json' );
}

checkNpmVersions({
    'jose': '^6.2.0',
    'lodash': '^4.17.0'
},
    'pwix:iziam-oauth'
);
