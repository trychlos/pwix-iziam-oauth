/*
 * pwix:iziam-oauth/src/server/js/functions.js
 */

import { createRequire } from 'node:module';
import { EnvSettings } from 'meteor/pwix:env-settings';
import { Meteor } from 'meteor/meteor';
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
                await ServiceConfiguration.configurations.upsertAsync({ service: iziamOAuth.C.Service }, {
                    $set: { service: iziamOAuth.C.Service },
                    $unset: { client_secret: '', secret: '' }
                });
                return new Protocol({ client, states: States.s, settings });
            })().catch( error => { enginePromise = null; throw error; });
        }
        return enginePromise;
    },

    /**
     * @summary Returns the login options as defined by the application in its settings
     * @param {*} options 
     * @param {*} context 
     * @returns {Object}
     */
    async loginOptions( options = {}, context={} ){
        return ( await this.engine()).start( options, context );
    },

    /**
     * @summary Returns the logout options as defined by the application in its settings
     * @param {*} serviceData 
     * @returns {Object}
     */
    async logoutOptions( serviceData ){
        return ( await this.engine()).logout( serviceData );
    }
};
