/*
 * pwix:iziam-oauth/src/server/js/methods.js
 */

Meteor.methods({
    async 'pwix.iziamOAuth.m.authorization_code_start'( grant_type, params ){
        return await iziamOAuth.s.authorization_code_start( grant_type, params );
    },

    async 'pwix.iziamOAuth.m.handle'( params, queryParams ){
        return await iziamOAuth.s.handle( params, queryParams );
    }
});
