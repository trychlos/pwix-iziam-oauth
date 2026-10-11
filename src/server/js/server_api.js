/*
 * pwix:iziam-oauth/src/server/js/server_api.js
 *
 * The two public functions which are called by pwix:accounts-iziam (the application facing package).
 */

import _ from 'lodash';

// OAuth-only authorization is deliberately server-side. The application owns
// oauth_redirect_uri and passes its query to completeAuthorization there.
iziamOAuth.authorizationFlow = async ( grantType, options={} ) => {
    const engine = await iziamOAuth.s.engine();
    if( !engine ){
        throw new Error( 'Unable to get a reference on the openid-client engine' );
    }
    switch( grantType ){

        case 'refresh_token':
            const { credentials, ...grantOptions } = options;
            return engine.refresh( credentials, grantOptions );

        case 'client_credentials':
            return engine.clientCredentials( options );

        case 'authorization_code':
            return engine.start( options, { mode: 'oauth' });
    }
    // unsupported grant type
    throw new Error( 'Unsupported grant type' );
};

iziamOAuth.completeAuthorization = async ( query, credentialToken ) => {
    ( await iziamOAuth.s.engine()).complete( query, 'oauth', credentialToken );
};
