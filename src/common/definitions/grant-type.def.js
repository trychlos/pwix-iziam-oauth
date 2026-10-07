/*
 * pwix-iziam-oauth:/src/common/definitions/grant-type.def.js
 *
 * See https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1#section-1.3 Authorization Grant
 * 
 * 1.3. Authorization Grant
 *      An authorization grant represents the resource owner's authorization (to access its protected resources) used by the client
 *      to obtain an access token. This specification defines three grant types -- authorization code, refresh token, and client
 *      credentials -- as well as an extensibility mechanism for defining additional types.
 *
 * 1.3.1. Authorization Code
 *      An authorization code is a temporary credential used to obtain an access token.
 *      Instead of the client requesting authorization directly from the resource owner, the client directs the resource owner to an
 *      authorization server (via its user agent) which in turn directs the resource owner back to the client with the authorization code.
 *      The client can then exchange the authorization code for an access token.
 *      Before directing the resource owner back to the client with the authorization code, the authorization server authenticates the
 *      resource owner, and may request the resource owner's consent or otherwise inform them of the client's request. Because the resource
 *      owner only authenticates with the authorization server, the resource owner's credentials are never shared with the client, and the
 *      client does not need to have knowledge of any additional authentication steps such as multi-factor authentication or delegated accounts.
 *      The authorization code provides a few important security benefits, such as the ability to authenticate the client, as well as the
 *      transmission of the access token directly to the client without passing it through the resource owner's user agent and potentially 
 *      exposing it to others, including the resource owner.
 *
 * 1.3.2. Refresh Token
 *      Refresh tokens are credentials used to obtain access tokens. Refresh tokens may be issued to the client by the authorization
 *      server and are used to obtain a new access token when the current access token becomes invalid or expires, or to obtain additional 
 *      access tokens with identical or narrower scope (access tokens may have a shorter lifetime and fewer privileges than authorized by
 *      the resource owner). Issuing a refresh token is optional at the discretion of the authorization server, and may be issued based on
 *      properties of the client, properties of the request, policies within the authorization server, or any other criteria. If the
 *      authorization server issues a refresh token, it is included when issuing an access token (i.e., step (2) in Figure 2).
 *      The lifetime of the refresh token is also at the discretion of the authorization server.
 *      A refresh token is a string representing the authorization granted to the client by the resource owner. The string is considered
 *      opaque to the client. The refresh token may be an identifier used to retrieve the authorization information or may encode this
 *      information into the string itself. Unlike access tokens, refresh tokens are intended for use only with authorization servers
 *      and are never sent to resource servers.
 *
 * 1.3.3. Client Credentials
 *      The client credentials or other forms of client authentication (e.g., a private key used to sign a JWT, as described in [RFC7523]
 *      and its update [I-D.ietf-oauth-rfc7523bis]) can be used as an authorization grant when the authorization scope is limited to
 *      the protected resources under the control of the client, or to protected resources previously arranged with the authorization server.
 *      Client credentials are used when the client is requesting access to protected resources based on an authorization previously arranged
 *      with the authorization server.
 */

import _ from 'lodash';
import { strict as assert } from 'node:assert';

import { Logger } from 'meteor/pwix:logger';
import { pwixI18n } from 'meteor/pwix:i18n';

const logger = Logger.get();

export const GrantType = {
    C: [
        {
            // OAuth 2.1 authorization code
            id: 'authorization_code',
            label: 'definitions.grant_type.auth_code_label',
            description: 'definitions.grant_type.auth_code_description',
            auth_flow: 'authorization_code',
            required_parms: {
                // the client identifier as provided by the Authorization Server at registration time
                client_id: true,
                // the authorization URL on AS side
                authorizationUrl: true,
                // the authorization URL on client side
                //  this is the URL which must handle the exchanges with the AS
                redirectUrl: true
                // optional parms:
                //  - tokenUrl: the token endpoint on AS side, defaulting to authorizationUrl
                //  - returnUrl: the client URL to return to at end of the authorization flow
            }
        },
        {
            // OAuth 2.1 client credentials
            id: 'client_credentials',
            label: 'definitions.grant_type.client_credentials_label',
            description: 'definitions.grant_type.client_credentials_description',
            auth_flow: 'client_credentials'
        },
        {
            // OAuth 2.1 refresh token
            id: 'refresh_token',
            label: 'definitions.grant_type.refresh_token_label',
            description: 'definitions.grant_type.refresh_token_description',
            auth_flow: 'refresh_token'
        }
    ],

    // only warn once when byId() doesn't find the item
    warnedById: {},

    /**
     * @param {Object} def a GrantType definition as returned by GrantType.Knowns()
     * @returns {String} the auth_flow identifier
     */
    authFlow( def ){
        return def.auth_flow || null;
    },

    /**
     * @param {String} id a grant type identifier
     * @returns {Object} the grant type definition, or null
     */
    byId( id ){
        let found = null;
        for( const def of this.Knowns()){
            if( GrantType.id( def ) === id ){
                found = def;
                break;
            }
        }
        if( !found && !GrantType.warnedById[id] ){
            logger.warn( 'grant type not found', id );
            GrantType.warnedById[id] = true;
        }
        return found;
    },

    /**
     * @param {Object} def a GrantType definition as returned by GrantType.Knowns()
     * @returns {String} the description to be attached to the grant type
     */
    description( def ){
        return pwixI18n.label( I18N, def.description );
    },

    /**
     * @param {Object} def a GrantType definition as returned by GrantType.Knowns()
     * @returns {String} the grant type identifier
     */
    id( def ){
        return def.id;
    },

    /**
     * @returns {Array} the list of known grant types
     */
    Knowns(){
        return this.C;
    },

    /**
     * @param {Object} def a GrantType definition as returned by GrantType.Knowns()
     * @returns {String} the label to be attached to the grant type
     */
    label( def ){
        return pwixI18n.label( I18N, def.label );
    },

    /**
     * @param {Object} def a GrantType definition as returned by GrantType.Knowns()
     * @returns {Object} the list of parms required to start the connection flow
     */
    requiredParms( def ){
        return def.required_parms || {};
    }
};
