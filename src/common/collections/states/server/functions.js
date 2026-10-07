/*
 * pwix:iziam-oauth:/src/common/collections/states/server/functions.js
 */

import _ from 'lodash';
import { strict as assert } from 'node:assert';

import { States } from '../index.js';

States.s = {
    /**
     * @summary Fetch the Authorization State from the collection
     * @param {Object} query
     * @returns {Object} the stateDoc, or null
     */
    async dbFetch( query ){
        const doc = await States.collection.findOneAsync( query );
        return doc;
    },

    /**
     * @summary Create and returns a new States document to handle the starting authorization flow
     *  The document Mongo identifier will be used as a 'state' parameter during exchanges with AuthorizationServer
     *  We generate here - even if finally may not be used a PKCE verifier/ challenge object
     * @param {GrantType} grantType the definition as returned from GrantType.Knowns()
     * @param {Object} params the configuration object
     */
    async dbNew( grantType, params ){
        const doc = {
            grantType,
            params,
            pkce: await iziamOAuth.s.pkceChallenge( iziamOAuth.configure().pkceVerifierSize )
        };
        const res = await States.collection.insertAsync( doc );
        if( res ){
            doc._id = res;
        } else {
            doc = null;
        }
        return doc;
    }
};
