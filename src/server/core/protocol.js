// Protocol engine, independent of Meteor. Credentials never leave this module
// except through its server-side result (or an explicitly public launch object).
export class Protocol {
    constructor({ client, states, settings, now = () => Date.now() }) {
        Object.assign(this, { client, states, settings, now });
        this.configuration = null;
    }

    async config() {
        if (!this.configuration) {
            this.configuration = this.discover().catch(error => {
                this.configuration = null;
                throw error;
            });
        }
        return this.configuration;
    }

    async discover() {
        const c = this.client;
        const s = this.settings;
        if (!s.issuerUrl || !s.client_id) throw new Error('Missing iziam issuerUrl or client_id');
        const authMethod = s.token_endpoint_auth_method || (s.client_secret ? 'client_secret_basic' : 'none');
        const authentication = {
            client_secret_basic: () => c.ClientSecretBasic(s.client_secret),
            client_secret_post: () => c.ClientSecretPost(s.client_secret),
            none: () => c.None()
        }[authMethod];
        if (!authentication || (authMethod !== 'none' && !s.client_secret)) {
            throw new Error('Invalid iziam token endpoint authentication configuration');
        }
        const options = s.allowInsecureLocalhost ? { execute: [c.allowInsecureRequests] } : undefined;
        if (s.allowInsecureLocalhost && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(s.issuerUrl).hostname)) {
            throw new Error('Insecure discovery is only available for a loopback issuer');
        }
        return c.discovery(new URL(s.issuerUrl), s.client_id, {
            client_secret: s.client_secret,
            token_endpoint_auth_method: authMethod
        }, authentication(), options);
    }

    async start(options = {}, context = {}) {
        const allowed = ['loginStyle', 'popupOptions', 'scopes', 'mobileHint'];
        if (!options || typeof options !== 'object' || Array.isArray(options) ||
            Object.keys(options).some(key => !allowed.includes(key))) {
            throw new Error('Invalid authorization options');
        }
        const config = await this.config();
        const s = this.settings;
        const loginStyle = options.mobileHint ? 'redirect' : (options.loginStyle || s.loginStyle || 'popup');
        if (!['popup', 'redirect'].includes(loginStyle)) throw new Error('Invalid login style');
        const scopes = options.scopes ?? s.scopes ?? ['openid'];
        if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== 'string' || !scope || /\s/.test(scope))) {
            throw new Error('Invalid scopes');
        }
        const requestedScopes = [...new Set([...scopes, 'openid'])];
        const credentialToken = this.client.randomState();
        const verifier = this.client.randomPKCECodeVerifier();
        const nonce = this.client.randomNonce();
        // Meteor needs this envelope to close its popup or resume a redirect.
        // Only random correlation data and the application return URL are public.
        const state = Buffer.from(JSON.stringify({
            loginStyle, credentialToken, redirectUrl: s.afterUrl
        })).toString('base64');
        const parameters = new URLSearchParams({
            redirect_uri: s.redirect_uri,
            scope: requestedScopes.join(' '),
            code_challenge: await this.client.calculatePKCECodeChallenge(verifier),
            code_challenge_method: 'S256', state, nonce
        });
        for (const resource of s.resources || []) parameters.append('resource', resource);
        if (context.purpose === 'change_password') parameters.set('prompt', 'change_password');
        const url = this.client.buildAuthorizationUrl(config, parameters).toString();
        await this.states.insert({
            _id: credentialToken, state, verifier, nonce,
            redirectUri: s.redirect_uri,
            expectedSubject: context.expectedSubject,
            expiresAt: new Date(this.now() + 10 * 60 * 1000)
        });
        const popupOptions = options.popupOptions || s.popupOptions || { width: 900, height: 450 };
        if (!popupOptions || typeof popupOptions !== 'object' || Array.isArray(popupOptions)) {
            throw new Error('popupOptions must be an object');
        }
        return { url, credentialToken, loginStyle, popupOptions };
    }

    async complete(query) {
        if (!query || typeof query.state !== 'string' || query.state.length > 4096) {
            throw new Error('Missing or invalid authorization state');
        }
        const transaction = await this.states.consume(query.state, new Date(this.now()));
        if (!transaction) throw new Error('Unknown, expired or already used authorization state');
        const callback = new URL(transaction.redirectUri);
        for (const [key, value] of Object.entries(query)) {
            if (typeof value !== 'string') throw new Error('Invalid authorization response');
            callback.searchParams.set(key, value);
        }
        const config = await this.config();
        const tokens = await this.client.authorizationCodeGrant(config, callback, {
            pkceCodeVerifier: transaction.verifier,
            expectedState: transaction.state,
            expectedNonce: transaction.nonce,
            idTokenExpected: true
        });
        const claims = tokens.claims();
        if (!claims?.sub || (transaction.expectedSubject && transaction.expectedSubject !== claims.sub)) {
            throw new Error('Unexpected iziam identity');
        }
        const userinfo = config.serverMetadata().userinfo_endpoint
            ? await this.client.fetchUserInfo(config, tokens.access_token, claims.sub)
            : claims;
        // Do not copy arbitrary provider claims into Meteor's service record.
        const serviceData = {
            id: claims.sub, issuer: claims.iss,
            accessToken: tokens.access_token,
            idToken: tokens.id_token,
            ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
            ...(tokens.expires_in !== undefined ? { expiresAt: this.now() + tokens.expires_in * 1000 } : {}),
            ...(tokens.scope ? { scope: tokens.scope } : {})
        };
        for (const field of ['name', 'preferred_username', 'email', 'email_verified', 'picture']) {
            if (userinfo[field] !== undefined) serviceData[field] = userinfo[field];
        }
        if (userinfo.preferred_username) serviceData.username = userinfo.preferred_username;
        return { serviceData, options: { profile: {} } };
    }

    async logout(serviceData) {
        const config = await this.config();
        if (!config.serverMetadata().end_session_endpoint || !serviceData?.idToken) return null;
        const parameters = { id_token_hint: serviceData.idToken };
        if (this.settings.post_logout_redirect_uri) parameters.post_logout_redirect_uri = this.settings.post_logout_redirect_uri;
        return { url: this.client.buildEndSessionUrl(config, parameters).toString() };
    }
}
