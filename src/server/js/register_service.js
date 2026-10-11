/*
 * pwix:iziam-oauth/src/server/js/register_service.js
 *
 * Register the OAuth service against meteor:oauth package.
 */

import _ from 'lodash';

import { Meteor } from 'meteor/meteor';
import { OAuth } from 'meteor/oauth';

/**
 * Source: https://github.com/meteor/meteor/blob/devel/packages/oauth/oauth_server.js
 * 
 * Register a handler for an OAuth service. The handler will be called
 * when we get an incoming http request on /_oauth/{serviceName}. This
 * handler should use that information to fetch data about the user
 * logging in.
 *
 * @param name {String} e.g. "google", "facebook"
 * @param version {Number} OAuth version (1 or 2)
 * @param urls   For OAuth1 only, specify the service's urls
 * @param handleOauthRequest {Function(oauthBinding|query)}
 *   - (For OAuth1 only) oauthBinding {OAuth1Binding} bound to the appropriate provider
 *   - (For OAuth2 only) query {Object} parameters passed in query string
 *   - return value is:
 *     - {serviceData:, (optional options:)} where serviceData should end
 *       up in the user's services[name] field
 *     - `null` if the user declined to give permissions
 */
OAuth.registerService( iziamOAuth.C.Service, 2, null, async query => {
    try {
        return await ( await iziamOAuth.s.engine()).complete( query );
    } catch( error ){
        // Provider errors can embed tokens or callback parameters. Send a bounded
        // error through Meteor's credential completion mechanism instead.
        throw new Meteor.Error( 'iziam-authorization-failed', 'izIAM authorization failed or expired' );
    }
});
