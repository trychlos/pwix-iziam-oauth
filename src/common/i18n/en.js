/*
 * pwix:iziam-oauth/src/common/i18n/en.js
 */

iziamOAuth.i18n = {
    ...iziamOAuth.i18n,
    ...{
        en: {
            definitions: {
                grant_type: {
                    auth_code_label: 'Authorization Code',
                    auth_code_description: 'Exchange an authorization code for tokens.',
                    client_credentials_label: 'Client Credentials',
                    client_credentials_description: 'Obtain tokens for a confidential client.',
                    refresh_token_label: 'Refresh Token',
                    refresh_token_description: 'Renew tokens using a refresh token.',
                }
            }
        }
    }
};
