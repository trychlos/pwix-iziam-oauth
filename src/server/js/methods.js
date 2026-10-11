/*
 * pwix:iziam-oauth/src/server/js/methods.js
 */

import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Logger } from 'meteor/pwix:logger';

const logger = Logger.get();

Meteor.methods({
    async 'pwix.iziamOAuth.m.loginOptions'( options={} ){
        check( options, Object );
        try {
            return await iziamOAuth.s.loginOptions( options );
        } catch( error ){
            logger.error( error );
            throw new Meteor.Error( 'iziam-login-options', 'Unable to get login options' );
        }
    }
});
