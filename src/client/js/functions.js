/*
 * pwix:iziam-oauth/src/client/js/functions.js
 */

import { Meteor } from 'meteor/meteor';
import { OAuth } from 'meteor/oauth';

iziamOAuth.requestCredential = ( options, callback, method = 'pwix.iziamOAuth.m.loginOptions' ) => {
    if( typeof options === 'function' ){
        callback = options; options = {};
    }
    callback = callback || (() => {});
    Meteor.callAsync( method, options || {}).then( launch => {
        OAuth.launchLogin({
            loginService: 'iziam',
            loginStyle: launch.loginStyle,
            loginUrl: launch.url,
            credentialToken: launch.credentialToken,
            credentialRequestCompleteCallback: callback,
            popupOptions: launch.popupOptions
        });
    }).catch( callback );
};
