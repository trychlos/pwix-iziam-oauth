import './index.js';
import { Tinytest } from 'meteor/tinytest';
import { Meteor } from 'meteor/meteor';
import { OAuth } from 'meteor/oauth';
import { ServiceConfiguration } from 'meteor/service-configuration';
import { iziamOAuth } from 'meteor/pwix:iziam-oauth';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const applicationRequire = createRequire(process.cwd() + '/package.json');
let fixturePromise;
function fixture() {
    if (!fixturePromise) fixturePromise = (async () => {
        const { generateKeyPair, exportJWK, SignJWT } = applicationRequire('jose');
        const { privateKey, publicKey } = await generateKeyPair('RS256');
        const jwk = { ...await exportJWK(publicKey), kid: 'meteor-test', alg: 'RS256' };
        const codes = new Map();
        let issuer;
        const server = createServer((request, response) => {
            (async () => {
                const url = new URL(request.url, issuer);
                response.setHeader('content-type', 'application/json');
                const send = object => response.end(JSON.stringify(object));
                if (url.pathname === '/.well-known/openid-configuration') return send({
                    issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
                    jwks_uri: issuer + '/jwks', userinfo_endpoint: issuer + '/userinfo',
                    end_session_endpoint: issuer + '/logout', response_types_supported: ['code'],
                    subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256']
                });
                if (url.pathname === '/jwks') return send({ keys: [jwk] });
                if (url.pathname === '/userinfo') return send({ sub: 'meteor-test-user', preferred_username: 'integration-test' });
                if (url.pathname === '/authorize') {
                    const code = String(codes.size) + '-' + Date.now();
                    codes.set(code, url.searchParams);
                    const callback = new URL(url.searchParams.get('redirect_uri'));
                    callback.searchParams.set('state', url.searchParams.get('state'));
                    callback.searchParams.set('code', code);
                    response.writeHead(302, { location: callback.toString() });
                    return response.end();
                }
                if (url.pathname === '/logout') {
                    response.writeHead(302, { location: Meteor.absoluteUrl() });
                    return response.end();
                }
                if (url.pathname === '/token') {
                    let body = '';
                    for await (const chunk of request) body += chunk;
                    const parameters = new URLSearchParams(body);
                    const attempt = codes.get(parameters.get('code'));
                    codes.delete(parameters.get('code'));
                    if (!attempt || attempt.get('code_challenge') !== createHash('sha256')
                        .update(parameters.get('code_verifier') || '').digest('base64url')) {
                        response.statusCode = 400;
                        return send({ error: 'invalid_grant' });
                    }
                    const id_token = await new SignJWT({ nonce: attempt.get('nonce') })
                        .setProtectedHeader({ alg: 'RS256', kid: 'meteor-test' })
                        .setIssuer(issuer).setAudience('meteor-test-client').setSubject('meteor-test-user')
                        .setIssuedAt().setExpirationTime('5m').sign(privateKey);
                    return send({ access_token: 'test-access', refresh_token: 'test-refresh', id_token,
                        token_type: 'Bearer', expires_in: 300 });
                }
                response.statusCode = 404;
                send({ error: 'not_found' });
            })().catch(() => { response.statusCode = 500; response.end('{}'); });
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        issuer = 'http://127.0.0.1:' + server.address().port;
        Meteor.settings.private = { iziam: {
            issuerUrl: issuer, client_id: 'meteor-test-client', client_secret: 'test-secret',
            allowInsecureLocalhost: true, post_logout_redirect_uri: Meteor.absoluteUrl()
        } };
        return { engine: await iziamOAuth.s.engine() };
    })();
    return fixturePromise.then(async result => {
        // Tinytest clears Mongo between suite runs; discovery remains cached.
        await ServiceConfiguration.configurations.upsertAsync({ service: 'iziam' }, { $set: { service: 'iziam' } });
        return result;
    });
}

// Available only when this package's tests are installed in an isolated app.
Meteor.methods({
    async 'iziam.tests.setup'() { await fixture(); return true; }
});

Tinytest.addAsync('iziam-oauth - native library, Mongo state, and Meteor callback', (test, done) => {
    (async () => {
        const { engine } = await fixture();
        const launch = await engine.start();
        const authorization = await fetch(launch.url, { redirect: 'manual' });
        const callback = new URL(authorization.headers.get('location'));
        callback.searchParams.set('only_credential_secret_for_test', '1');
        const response = await fetch(callback);
        const secret = await response.text();
        const result = await OAuth.retrieveCredential(launch.credentialToken, secret);
        test.equal(result?.serviceName, 'iziam');
        test.equal(result?.serviceData?.id, 'meteor-test-user');
        test.equal(result?.serviceData?.accessToken, 'test-access');
        test.isFalse(await OAuth.retrieveCredential(launch.credentialToken, secret));
        const attempt = await engine.states.consume(callback.searchParams.get('state'), new Date(), 'oidc');
        test.isFalse(attempt);
        const simultaneous = await engine.start();
        const state = new URL(simultaneous.url).searchParams.get('state');
        const claims = await Promise.all([engine.states.consume(state, new Date(), 'oidc'), engine.states.consume(state, new Date(), 'oidc')]);
        test.equal(claims.filter(Boolean).length, 1);
    })().then(done, error => { test.exception(error); done(); });
});
