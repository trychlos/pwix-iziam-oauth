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
        const mode = context.mode || 'oidc';
        if (!['oidc', 'oauth'].includes(mode)) throw new Error('Invalid authorization mode');
        const s = this.settings;
        const redirectUri = mode === 'oidc' ? s.redirect_uri : s.oauth_redirect_uri;
        if (!redirectUri) throw new Error('Configure oauth_redirect_uri for the application server callback');
        const redirect = new URL(redirectUri);
        if (!['https:', 'http:'].includes(redirect.protocol) || redirect.search || redirect.hash) {
            throw new Error('Invalid authorization callback URL');
        }
        const loginStyle = options.mobileHint ? 'redirect' : (options.loginStyle || s.loginStyle || 'popup');
        if (!['popup', 'redirect'].includes(loginStyle)) throw new Error('Invalid login style');
        const scopes = options.scopes ?? (mode === 'oidc' ? (s.scopes ?? ['openid']) : (s.oauth_scopes ?? []));
        if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== 'string' || !scope || /\s/.test(scope))) {
            throw new Error('Invalid scopes');
        }
        if (mode === 'oauth' && scopes.includes('openid')) throw new Error('Use OIDC login for the openid scope');
        const requestedScopes = [...new Set(mode === 'oidc' ? [...scopes, 'openid'] : scopes)];
        const credentialToken = this.client.randomState();
        const verifier = this.client.randomPKCECodeVerifier();
        const nonce = mode === 'oidc' ? this.client.randomNonce() : undefined;
        // Meteor needs this envelope to close its popup or resume a redirect.
        // Only random correlation data and the application return URL are public.
        const state = Buffer.from(JSON.stringify({
            loginStyle, credentialToken, redirectUrl: s.afterUrl
        })).toString('base64');
        const parameters = new URLSearchParams({
            redirect_uri: redirectUri,
            scope: requestedScopes.join(' '),
            code_challenge: await this.client.calculatePKCECodeChallenge(verifier),
            code_challenge_method: 'S256', state
        });
        if (nonce) parameters.set('nonce', nonce);
        for (const resource of s.resources || []) parameters.append('resource', resource);
        if (context.purpose === 'change_password') parameters.set('prompt', 'change_password');
        const url = this.client.buildAuthorizationUrl(config, parameters).toString();
        await this.states.insert({
            _id: credentialToken, state, verifier, nonce, mode,
            redirectUri,
            expectedSubject: context.expectedSubject,
            expiresAt: new Date(this.now() + 10 * 60 * 1000)
        });
        const popupOptions = options.popupOptions || s.popupOptions || { width: 900, height: 450 };
        if (!popupOptions || typeof popupOptions !== 'object' || Array.isArray(popupOptions)) {
            throw new Error('popupOptions must be an object');
        }
        return { url, credentialToken, loginStyle, popupOptions };
    }

    async complete(query, mode = 'oidc') {
        if (!query || typeof query.state !== 'string' || query.state.length > 4096) {
            throw new Error('Missing or invalid authorization state');
        }
        const transaction = await this.states.consume(query.state, new Date(this.now()), mode);
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
            idTokenExpected: mode === 'oidc'
        });
        if (mode === 'oauth') return this.tokenData(tokens);
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
            ...this.tokenData(tokens)
        };
        for (const field of ['name', 'preferred_username', 'email', 'email_verified', 'picture']) {
            if (userinfo[field] !== undefined) serviceData[field] = userinfo[field];
        }
        if (userinfo.preferred_username) serviceData.username = userinfo.preferred_username;
        return { serviceData, options: { profile: {} } };
    }

    grantParameters(options = {}) {
        if (!options || typeof options !== 'object' || Array.isArray(options) ||
            Object.keys(options).some(key => !['scopes', 'resources'].includes(key))) {
            throw new Error('Invalid grant options');
        }
        const parameters = new URLSearchParams();
        if (options.scopes !== undefined) {
            if (!Array.isArray(options.scopes) || options.scopes.some(scope =>
                typeof scope !== 'string' || !scope || /\s/.test(scope) || scope === 'openid')) {
                throw new Error('Invalid OAuth scopes');
            }
            parameters.set('scope', [...new Set(options.scopes)].join(' '));
        }
        const resources = options.resources ?? this.settings.resources ?? [];
        if (!Array.isArray(resources) || resources.some(resource => typeof resource !== 'string' || !resource)) {
            throw new Error('Invalid resources');
        }
        for (const resource of resources) parameters.append('resource', resource);
        return parameters;
    }

    async clientCredentials(options = {}) {
        if (!this.settings.client_secret || this.settings.token_endpoint_auth_method === 'none') {
            throw new Error('Client credentials requires a confidential client');
        }
        const parameters = this.grantParameters({ scopes: this.settings.oauth_scopes || [], ...options });
        return this.tokenData(await this.client.clientCredentialsGrant(await this.config(), parameters));
    }

    async refresh(previous, options = {}) {
        if (!previous || typeof previous.refreshToken !== 'string' || !previous.refreshToken) {
            throw new Error('A server-side refresh token is required');
        }
        const parameters = this.grantParameters(options);
        const tokens = await this.client.refreshTokenGrant(await this.config(), previous.refreshToken, parameters);
        const claims = tokens.claims();
        if (claims && ((previous.id && claims.sub !== previous.id) ||
            (previous.issuer && claims.iss !== previous.issuer))) {
            throw new Error('Unexpected refreshed identity');
        }
        // Providers may omit refresh_token or scope. Preserve the existing
        // values in that case, and return any rotated token to the caller.
        const result = { ...previous, ...this.tokenData(tokens) };
        if (tokens.expires_in === undefined) delete result.expiresAt;
        return result;
    }

    tokenData(tokens) {
        return {
            accessToken: tokens.access_token,
            tokenType: tokens.token_type,
            ...(tokens.id_token ? { idToken: tokens.id_token } : {}),
            ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
            ...(tokens.expires_in !== undefined ? { expiresAt: this.now() + tokens.expires_in * 1000 } : {}),
            ...(tokens.scope !== undefined ? { scope: tokens.scope } : {})
        };
    }

    async logout(serviceData) {
        const config = await this.config();
        if (!config.serverMetadata().end_session_endpoint || !serviceData?.idToken) return null;
        const parameters = { id_token_hint: serviceData.idToken };
        if (this.settings.post_logout_redirect_uri) parameters.post_logout_redirect_uri = this.settings.post_logout_redirect_uri;
        return { url: this.client.buildEndSessionUrl(config, parameters).toString() };
    }
}
