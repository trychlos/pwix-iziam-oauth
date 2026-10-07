/*
 * pwix:iziam-oauth/src/common/i18n/fr.js
 */

iziamOAuth.i18n = {
    ...iziamOAuth.i18n,
    ...{
        fr: {
            definitions: {
                grant_type: {
                    auth_code_label: 'Authorization Code',
                    auth_code_description: 'Échanger un code d’autorisation contre des jetons.',
                    client_credentials_label: 'Client Credentials',
                    client_credentials_description: 'Obtenir des jetons pour un client confidentiel.',
                    refresh_token_label: 'Refresh Token',
                    refresh_token_description: 'Renouveler les jetons avec un jeton de rafraîchissement.',
                }
            }
        }
    }
};
