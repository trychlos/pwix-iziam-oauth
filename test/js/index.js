import { Tinytest } from 'meteor/tinytest';
import { iziamOAuth } from 'meteor/pwix:iziam-oauth';

Tinytest.add('iziam-oauth - service and configuration', test => {
    test.equal(iziamOAuth.C.Service, 'iziam');
    test.equal(iziamOAuth.GrantType.Knowns().map(item => item.id), ['authorization_code', 'client_credentials', 'refresh_token']);
    test.equal(iziamOAuth.configure().afterRoute, '/');
    test.throws(() => iziamOAuth.configure({ afterRoute: '//other.example/' }));
});
