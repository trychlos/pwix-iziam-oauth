/*
 * pwix:iziam-oauth/src/client/js/functions.js
 */

import { Logger } from 'meteor/pwix:logger';
import { OAuth } from 'meteor/oauth';
import { ServiceConfiguration } from 'meteor/service-configuration';
import { Tracker } from 'meteor/tracker';

const logger = Logger.get();

/**
 * @Summary Start an Authorization Grant flow
 * @param {String} grant_type one of the values defined in GrantType definitions
 *  'authorization_code'
 *  'client_credentials'
 *  'refresh_token'
 * @param {Object} parms a configuration object with following keys:
 *  - client_id: the client identifier as provided by the izIAM Authorization Server
 *  - client_secret: an optional client_secret - should only be provided for a - in an OAuth sense - 'confidential' client
 *  - authorizationUrl: the URL to the authorization endpoint
 */
iziamOAuth.authorizationFlow = async function( grant_type, parms ){
    const res = await iziamOAuth.fn.authorizationFlow( grant_type, parms );
    return res;
};
