/*
 * pwix:iziam-oauth/src/server/js/check_npms.js
 */

import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';

if( false ){
    // whitelist packages which are included via a subfolder or badly recognized
}

checkNpmVersions({
    'jose': '^6.2.2',
    'lodash': '^4.17.0',
    'openid-client': '^6.8.4'
},
    'pwix:iziam-oauth'
);
