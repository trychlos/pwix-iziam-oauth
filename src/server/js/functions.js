/*
 * pwix:iziam-oauth/src/server/js/functions.js
 */

import { createRequire } from 'node:module';
import { EnvSettings } from 'meteor/pwix:env-settings';
import { Meteor } from 'meteor/meteor';
import { OAuth } from 'meteor/oauth';
import { ServiceConfiguration } from 'meteor/service-configuration';

import { States } from '../../common/collections/states/index.js';

import { Protocol } from '../classes/protocol.class.js';

// Native Node loading respects ESM package exports, including jose. It also
// avoids Meteor's compiler rewriting openid-client's transitive imports.
const applicationRequire = createRequire( process.cwd() + '/package.json' );

let enginePromise = undefined;

iziamOAuth.s = {
    /**
     * @summary
     * @returns 
     */
    async engine(){
        if( !enginePromise ){
            enginePromise = ( async () => {
                const version = applicationRequire( 'openid-client/package.json' ).version;
                const [ major, minor, patch ] = version.split( '.' ).map( Number );
                if( major !== 6 || minor < 8 || ( minor === 8 && patch < 4 )){
                    throw new Error( 'iziam requires openid-client 6 (>= 6.8.4)' );
                }
                const client = applicationRequire( 'openid-client' );
                const environment = Meteor.settings.private?.iziam ? null : await EnvSettings.s.environmentServerSettings();
                const privateSettings = environment?.settings?.private?.iziam || Meteor.settings.private?.iziam;
                if( !privateSettings ){
                    throw new ServiceConfiguration.ConfigError();
                }
                const settings = { ...privateSettings };
                const callback = Meteor.absoluteUrl( '_oauth/iziam' );
                settings.redirect_uri = settings.redirect_uri || callback;
                if( settings.redirect_uri !== callback ){
                    throw new Error( 'iziam redirect_uri must equal '+callback );
                }
                settings.afterUrl = new URL( iziamOAuth.configure().afterRoute, Meteor.absoluteUrl()).toString();
                if( new URL( settings.afterUrl ).origin !== new URL( Meteor.absoluteUrl()).origin ){
                    throw new Error( 'iziam afterRoute must stay on the application origin' );
                }
                // Meteor only needs a service marker. Never publish client_secret via
                // ServiceConfiguration, which accounts-xxx packages expose to browsers.
                await ServiceConfiguration.configurations.upsertAsync({ service: 'iziam' }, {
                    $set: { service: iziamOAuth.C.Service },
                    $unset: { client_secret: '', secret: '' }
                });
                return new Protocol({ client, States, settings });
            })().catch( error => { enginePromise = null; throw error; });
        }
        return enginePromise;
    },

    /**
     * @summary
     * @param {*} options 
     * @param {*} context 
     * @returns 
     */
    async loginOptions( options = {}, context={} ){
        return ( await this.engine()).start( options, context );
    },

    async logoutOptions( serviceData ){
        return ( await this.engine()).logout( serviceData );
    }
};

OAuth.registerService( iziamOAuth.C.Service, 2, null, async query => {
    try {
        return await ( await iziamOAuth.s.engine()).complete( query );
    } catch( error ){
        // Provider errors can embed tokens or callback parameters. Send a bounded
        // error through Meteor's credential completion mechanism instead.
        throw new Meteor.Error( 'iziam-authorization-failed', 'izIAM authorization failed or expired' );
    }
});

iziamOAuth.retrieveCredential = ( token, secret ) => OAuth.retrieveCredential( token, secret );

// OAuth-only authorization is deliberately server-side. The application owns
// oauth_redirect_uri and passes its query to completeAuthorization there.
iziamOAuth.authorizationFlow = async ( grantType, options={} ) => {
    if( grantType === 'refresh_token' ){
        const { credentials, ...grantOptions } = options;
        return ( await iziamOAuth.s.engine()).refresh( credentials, grantOptions );
    }
    if( grantType === 'client_credentials' ) return ( await iziamOAuth.s.engine()).clientCredentials( options );
    if( grantType !== 'authorization_code' ) throw new Error( 'Unsupported grant type' );
    return ( await iziamOAuth.s.engine()).start( options, { mode: 'oauth' });
};

iziamOAuth.completeAuthorization = async ( query, credentialToken ) => ( await iziamOAuth.s.engine()).complete( query, 'oauth', credentialToken );
