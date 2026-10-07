import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import * as client from 'openid-client';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { Protocol } from '../../src/server/core/protocol.js';

let server, issuer, privateKey, badPrivateKey, jwk;
const codes = new Map();
let exchanges = 0;
before(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    badPrivateKey = (await generateKeyPair('RS256')).privateKey;
    jwk = { ...await exportJWK(pair.publicKey), kid: 'test', alg: 'RS256', use: 'sig' };
    server = createServer(async (req, res) => {
        const url = new URL(req.url, issuer);
        res.setHeader('content-type', 'application/json');
        const send = body => res.end(JSON.stringify(body));
        if (url.pathname === '/.well-known/openid-configuration') return send({
            issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
            jwks_uri: issuer + '/jwks', userinfo_endpoint: issuer + '/userinfo',
            end_session_endpoint: issuer + '/logout', response_types_supported: ['code'],
            subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
            token_endpoint_auth_methods_supported: ['client_secret_basic', 'none']
        });
        if (url.pathname === '/jwks') return send({ keys: [jwk] });
        if (url.pathname === '/userinfo') {
            const sub = req.headers.authorization?.replace('Bearer access-', '');
            return send({ sub, preferred_username: sub, email: sub + '@example.test' });
        }
        if (url.pathname === '/token') {
            exchanges++;
            let body = '';
            for await (const chunk of req) body += chunk;
            const params = new URLSearchParams(body);
            if (params.get('grant_type') === 'client_credentials') {
                assert.equal(decodeURIComponent(Buffer.from(req.headers.authorization.slice(6), 'base64').toString()), 'test-client:private-secret');
                return send({ access_token: 'machine-token', token_type: 'Bearer', expires_in: 60, scope: params.get('scope') });
            }
            if (params.get('grant_type') === 'refresh_token') {
                const token = params.get('refresh_token');
                if (token === 'invalid') { res.statusCode = 400; return send({ error: 'invalid_grant' }); }
                return send({ access_token: 'renewed-access', token_type: 'Bearer', expires_in: 90,
                    ...(token === 'rotate' ? { refresh_token: 'rotated-token' } : {}) });
            }
            const code = params.get('code');
            const attempt = codes.get(code);
            codes.delete(code);
            if (!attempt || createHash('sha256').update(params.get('code_verifier') || '').digest('base64url') !== attempt.challenge) {
                res.statusCode = 400;
                return send({ error: 'invalid_grant' });
            }
            assert.equal(params.get('redirect_uri'), 'http://localhost/app/_oauth/iziam');
            const id_token = await new SignJWT({ nonce: attempt.nonce })
                .setProtectedHeader({ alg: 'RS256', kid: 'test' })
                .setSubject(attempt.sub).setIssuer(attempt.issuer || issuer)
                .setAudience(attempt.audience || 'test-client').setIssuedAt()
                .setExpirationTime(attempt.expired ? '-1h' : '5m').sign(attempt.badSignature ? badPrivateKey : privateKey);
            return send({ access_token: 'access-' + attempt.sub, refresh_token: 'refresh-' + attempt.sub,
                token_type: 'Bearer', expires_in: 60, ...(attempt.oauth ? {} : { id_token }) });
        }
        res.statusCode = 404;
        send({ error: 'not_found' });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    issuer = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

function fixture(overrides = {}) {
    const documents = new Map();
    const states = {
        async insert(doc) { documents.set(doc.state, structuredClone(doc)); },
        async consume(state, now, mode, credentialToken) {
            const doc = documents.get(state);
            if (!doc || (credentialToken && doc._id !== credentialToken) || doc.mode !== mode || doc.expiresAt <= now) return null;
            documents.delete(state);
            return doc;
        }
    };
    let now = Date.now();
    const protocol = new Protocol({ client, states, now: () => now, settings: {
        issuerUrl: issuer, client_id: 'test-client', client_secret: 'private-secret',
        allowInsecureLocalhost: true, redirect_uri: 'http://localhost/app/_oauth/iziam',
        afterUrl: 'http://localhost/app/', oauth_redirect_uri: 'http://localhost/app/_oauth/iziam', ...overrides
    } });
    return { protocol, documents, advance: ms => { now += ms; } };
}
function callback(launch, sub = 'alice', overrides = {}) {
    const url = new URL(launch.url);
    const code = client.randomState();
    codes.set(code, { sub, nonce: url.searchParams.get('nonce'),
        challenge: url.searchParams.get('code_challenge'), ...overrides });
    return { code, state: url.searchParams.get('state') };
}

test('OIDC popup exchanges once, validates identity and keeps secrets out of launch data', async () => {
    const { protocol, documents } = fixture();
    const launch = await protocol.start();
    assert.equal(launch.loginStyle, 'popup');
    const transaction = [...documents.values()][0];
    assert.equal(JSON.stringify(launch).includes(transaction.verifier), false);
    assert.equal(JSON.stringify(launch).includes('private-secret'), false);
    const query = callback(launch);
    const before = exchanges;
    const result = await protocol.complete(query);
    assert.equal(exchanges - before, 1);
    assert.equal(result.serviceData.id, 'alice');
    assert.equal(result.serviceData.username, 'alice');
    assert.equal(result.serviceData.accessToken, 'access-alice');
    assert.equal(documents.size, 0);
    await assert.rejects(protocol.complete(query), /already used/);
});

test('concurrent login attempts cannot share tokens or verifiers', async () => {
    const { protocol } = fixture();
    const [a, b] = await Promise.all([protocol.start(), protocol.start()]);
    assert.notEqual(a.credentialToken, b.credentialToken);
    const [alice, bob] = await Promise.all([protocol.complete(callback(a)), protocol.complete(callback(b, 'bob'))]);
    assert.equal(alice.serviceData.accessToken, 'access-alice');
    assert.equal(bob.serviceData.accessToken, 'access-bob');
});

test('expired and modified state fail before a token request', async () => {
    const { protocol, advance } = fixture();
    const launch = await protocol.start();
    const query = callback(launch);
    const before = exchanges;
    await assert.rejects(protocol.complete({ ...query, state: query.state + 'x' }), /Unknown/);
    advance(600001);
    await assert.rejects(protocol.complete(query), /expired/);
    assert.equal(exchanges, before);
});

test('redirect envelope returns to the application, not the token callback', async () => {
    const { protocol } = fixture();
    const launch = await protocol.start({ mobileHint: true });
    const envelope = JSON.parse(Buffer.from(new URL(launch.url).searchParams.get('state'), 'base64'));
    assert.deepEqual(envelope, { loginStyle: 'redirect', credentialToken: launch.credentialToken,
        redirectUrl: 'http://localhost/app/' });
});

test('provider denial consumes state and does not exchange a code', async () => {
    const { protocol } = fixture();
    const launch = await protocol.start();
    const state = new URL(launch.url).searchParams.get('state');
    const before = exchanges;
    await assert.rejects(protocol.complete({ state, error: 'access_denied' }));
    assert.equal(exchanges, before);
    await assert.rejects(protocol.complete({ state, code: 'replay' }), /already used/);
});

for (const [label, overrides] of Object.entries({ nonce: { nonce: 'wrong' }, audience: { audience: 'wrong' },
    issuer: { issuer: 'https://wrong.test' }, expiry: { expired: true }, signature: { badSignature: true } })) {
    test('reject invalid ID token ' + label, async () => {
        const { protocol } = fixture();
        const launch = await protocol.start();
        await assert.rejects(protocol.complete(callback(launch, 'alice', overrides)));
    });
}

test('password change binds completion to the current identity', async () => {
    const { protocol } = fixture();
    const launch = await protocol.start({}, { purpose: 'change_password', expectedSubject: 'alice' });
    assert.equal(new URL(launch.url).searchParams.get('prompt'), 'change_password');
    await assert.rejects(protocol.complete(callback(launch, 'bob')), /Unexpected iziam identity/);
});

test('browser cannot supply credentials or callback/issuer overrides', async () => {
    const { protocol } = fixture();
    for (const key of ['client_secret', 'issuerUrl', 'redirect_uri', 'prompt']) {
        await assert.rejects(protocol.start({ [key]: 'injected' }), /Invalid authorization options/);
    }
});

test('logout uses the supplied identity rather than global token state', async () => {
    const { protocol } = fixture();
    const [a, b] = await Promise.all([protocol.logout({ idToken: 'alice-id' }), protocol.logout({ idToken: 'bob-id' })]);
    assert.equal(new URL(a.url).searchParams.get('id_token_hint'), 'alice-id');
    assert.equal(new URL(b.url).searchParams.get('id_token_hint'), 'bob-id');
    assert.equal(await protocol.logout({}), null);
});

test('OAuth authorization returns server tokens without creating an identity', async () => {
    const { protocol } = fixture();
    const launch = await protocol.start({ scopes: ['api:read'] }, { mode: 'oauth' });
    const url = new URL(launch.url);
    assert.equal(url.searchParams.get('scope'), 'api:read');
    assert.equal(url.searchParams.has('nonce'), false);
    const query = callback(launch, 'alice', { oauth: true });
    // A Meteor login callback must not consume an OAuth-only authorization.
    await assert.rejects(protocol.complete(query), /Unknown/);
    await assert.rejects(protocol.complete(query, 'oauth'), /credential token/);
    await assert.rejects(protocol.complete(query, 'oauth', 'wrong-session'), /Unknown/);
    const result = await protocol.complete(query, 'oauth', launch.credentialToken);
    assert.equal(result.accessToken, 'access-alice');
    assert.equal(result.serviceData, undefined);
    assert.equal(result.idToken, undefined);
    await assert.rejects(protocol.complete(query, 'oauth', launch.credentialToken), /already used/);
});

test('client credentials authenticates on server and returns no user identity', { timeout: 5000 }, async () => {
    const { protocol } = fixture();
    const result = await protocol.clientCredentials({ scopes: ['api:read'] });
    assert.equal(result.accessToken, 'machine-token');
    assert.equal(result.scope, 'api:read');
    assert.equal(result.serviceData, undefined);
    await assert.rejects(protocol.clientCredentials({ scopes: ['openid'] }), /Invalid OAuth scopes/);
    await assert.rejects(fixture({ client_secret: undefined }).protocol.clientCredentials(), /confidential/);
});

test('refresh preserves omitted credentials and returns rotated refresh tokens', async () => {
    const { protocol } = fixture();
    const previous = { accessToken: 'old', refreshToken: 'keep', scope: 'api:read', id: 'alice' };
    const result = await protocol.refresh(previous);
    assert.equal(result.accessToken, 'renewed-access');
    assert.equal(result.refreshToken, 'keep');
    assert.equal(result.scope, 'api:read');
    assert.equal(previous.accessToken, 'old');
    const rotated = await protocol.refresh({ refreshToken: 'rotate' });
    assert.equal(rotated.refreshToken, 'rotated-token');
    await assert.rejects(protocol.refresh({ refreshToken: 'invalid' }));
    await assert.rejects(protocol.refresh({}), /refresh token/);
});
