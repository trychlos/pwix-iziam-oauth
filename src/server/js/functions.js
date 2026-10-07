/*
 * pwix:iziam-oauth/src/server/js/functions.js
 */

import _ from 'lodash';
import crypto from 'node:crypto';
import { url } from 'node:url';

import { EnvSettings } from 'meteor/pwix:env-settings';
import { Logger } from 'meteor/pwix:logger';
import { Random } from 'meteor/random';
import { ServiceConfiguration } from 'meteor/service-configuration';

import { States } from '../../common/collections/states/index.js';

import { GrantType } from '../../common/definitions/grant-type.def.js';

const logger = Logger.get();

iziamOAuth.s = {

    /*
     * @summary Starts an Authorization Code flow
     * @param {GrantType} grantType the definition as returned from GrantType.Knowns()
     * @param {Object} params the configuration object
     * @returns {Object}
     */
    async authorization_code_start( grantType, params ){
        const stateDoc = await States.s.dbNew( grantType, params );
        if( !stateDoc ){
            return { error: 'UnableToCreateState' };
        }
        // when returning the stateDoc to the client, be sure to remove the PKCE code verifier which msut stays server-side
        const clientDoc = { ...stateDoc };
        delete clientDoc.pkce.code_verifier;
        return clientDoc;
    },

    /**
     * @summary Handle izIAM answer
     * @param {Object} params
     * @param {Object} queryParams
     * @returns {}
     */
    async handle( params, queryParams ){
        logger.debug( 'iziamOAuth.s.handle()', 'params', params, 'queryParams', queryParams );
        const stateDoc = await States.s.dbFetch({ _id: queryParams.state });
    },

    /*
     * @summary Generate a code verifier and its challenge suitable for PKCE run
     */
    async pkceChallenge( length=43 ){
        const code_verifier = iziamOAuth.fn.base64url( crypto.randomBytes( 1024 )).slice( 0, length );
        const code_challenge = iziamOAuth.fn.base64url( crypto.createHash( 'sha256' ).update( code_verifier ).digest());
        return {
            code_verifier,
            code_challenge,
            code_challenge_method: 'S256'
        };
    }
};
