import { Tinytest } from 'meteor/tinytest';
import { iziamOAuth } from 'meteor/pwix:iziam-oauth';

Tinytest.add('iziam-oauth - service and configuration', test => {
    test.equal(iziamOAuth.C.Service, 'iziam');
    test.equal(iziamOAuth.configure().afterRoute, '/');
    test.throws(() => iziamOAuth.configure({ afterRoute: '//other.example/' }));
    test.equal(iziamOAuth.configure().afterRoute, '/');
    test.equal(iziamOAuth.configure({ afterRoute: '/test-return' }).afterRoute, '/test-return');
    test.equal(iziamOAuth._defaults.afterRoute, '/');
    iziamOAuth.configure({ afterRoute: '/' });
});
