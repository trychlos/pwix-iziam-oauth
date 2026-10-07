/*
 * pwix:iziam-oauth/src/common/js/functions.js
 */

import _ from 'lodash';
import { url } from 'node:url';

import { check, Match } from 'meteor/check';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Logger } from 'meteor/pwix:logger';
import { Random } from 'meteor/random';

import { GrantType } from '../../common/definitions/grant-type.def.js';

const logger = Logger.get();

iziamOAuth.fn = {

    /*
     * @summary Starts an Authorization Code flow
     * @param {GrantType} grantType the definition as returned from GrantType.Knowns()
     * @param {Object} params the configuration object
     * @returns {Object}
     */
    async _authorization_code_flow( grantType, params ){
        logger.debug( '_authorization_code_flow()', 'grantType', grantType, 'params', params );
        // begin with a server part
        //  generate the PKCE code challenge, keeping the PKCE code verifier on server side
        let res = await ( Meteor.isClient ? Meteor.callAsync( 'pwix.iziamOAuth.m.authorization_code_start', grantType, params ) : iziamOAuth.s.authorization_code_start( grant_type, params ));
        if( res.error ){
            return res;
        }
        const stateDoc = res;
        // we want an authorization url with state
        const url = new URL( params.authorizationUrl );
        url.searchParams.append( 'client_id', params.client_id );
        url.searchParams.append( 'redirect_uri', params.redirectUrl );
        url.searchParams.append( 'response_type', 'code' );
        url.searchParams.append( 'code_challenge', stateDoc.pkce.code_challenge );
        url.searchParams.append( 'code_challenge_method', stateDoc.pkce.code_challenge_method );
        url.searchParams.append( 'state', stateDoc._id );
        //url.searchParams.append( 'scope', ? );
        // and redirect (from the client) to the Authorization Server
        if( Meteor.isClient ){
            FlowRouter.go( url.toString());
        }
    },

    /*
     * @summary Check the required params for this flow
     *  We choose to just ignore unknwon/additional params - only checking that knwon required params are there
     * @returns {Boolean} true if ok
     */
    async _check_flow_params( grantType, params ){
        const requiredParms = GrantType.requiredParms( grantType );
        const paramKeys = Object.keys( params );
        const notFound = [];
        // scan for all keys
        for( const key of Object.keys( requiredParms )){
            if( !paramKeys.includes( key )){
                notFound.push( key );
            }
        }
        for( const key of notFound ){
            logger.log( 'required param not found', key );
        }
        return notFound.length === 0;
    },

    /*
     * @summary Starts a Client Credentials flow
     */
    async _client_credentials_flow( grantType, params ){
        return { error: 'UnimplementedFlow' };
    },

    /*
     * @summary Starts a Refresh Token flow
     */
    async _refresh_token_flow( grantType, params ){
        return { error: 'UnimplementedFlow' };
    },

    /**
     * @locus Anywhere
     * @Summary Start an Authorization Grant flow
     * @param {String} grant_type one of the values defined in GrantType definitions
     *  'authorization_code'
     *  'client_credentials'
     *  'refresh_token'
     * @param {Object} parms a configuration object with following keys:
     *  - client_id: the client identifier as provided by the izIAM Authorization Server
     *  - client_secret: an optional client_secret - should only be provided for a - in an OAuth sense - 'confidential' client
     *  - authorizationUrl: if requested grant type is 'authorization_code', the URL to the authorization endpoint
     *  - tokenUrl: if requested grant type is 'authorization_code', the URL to the token endpoint
     *  - redirectUrl: if requested grant type is 'authorization_code', the redirection URL to the client at the end of the flow
     * @returns {Object} an object with following keys:
     *  - error: the encountered error, if any
     */
    async authorizationFlow( grant_type, params ){
        // make sure grant_type is known
        const grantType = GrantType.byId( grant_type );
        if( !grantType ){
            return { error: 'UnknownGrantType' };
        }
        // check parms defined by the requested grant type
        if( !await iziamOAuth.fn._check_flow_params( grantType, params )){
            return { error: 'InvalidParams' };
        }
        // run (at least start) the authorization flow
        switch( grant_type ){
            case 'authorization_code':
                return await iziamOAuth.fn._authorization_code_flow( grantType, params );
                break;
            case 'client_credentials':
                return await iziamOAuth.fn._client_credentials_flow( grantType, params );
                break;
            case 'refresh_token':
                return await iziamOAuth.fn._refresh_token_flow( grantType, params );
                break;
        }
        return { error: 'UnhandledGrantType' };
    },

    /**
     * @locus Anywhere
     * @param {Buffer} buffer 
     * @returns {String}
     */
    base64url( buffer ){
        return buffer.toString( 'base64' )
            .replace( /\+/g, '-' )
            .replace( /\//g, '_' )
            .replace( /=+$/, '' );
    }
};
