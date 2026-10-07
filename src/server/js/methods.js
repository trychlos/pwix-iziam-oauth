import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

Meteor.methods({
    async 'pwix.iziamOAuth.m.loginOptions'(options = {}) {
        check(options, Object);
        try {
            return await iziamOAuth.s.loginOptions(options);
        } catch (error) {
            throw new Meteor.Error('iziam-login-options', 'Unable to start izIAM authorization');
        }
    }
});
