# pwix:iziam-oauth

## What is it ?

`pwix:iziam-oauth` is OAuth 2 and OpenID Connect 1.0 protocol support for izIAM.

Applications install and use [`pwix:accounts-iziam`](https://github.com/trychlos/pwix-accounts-iziam),
which delegates to this package.

The former`pwix:iziam-oidc` implementation is retired; there is no compatibility wrapper.

## Runtime and installation

Requires Meteor 3.3.1 or later and a Node runtime with native ESM `require`
(Node 22.12 or later). Tested with Meteor 3.5.2. Meteor 2 is not supported.

Install the application's peer dependency:

```sh
    meteor add pwix:iziam-oauth
    meteor npm install lodash openid-client
```

Only openid-client v6 is supported at the moment.

## Responsibilities

- OIDC authorization code with PKCE: discovery, state/nonce checks, ID-token
  signature and claims validation, UserInfo subject validation, and Meteor's
  credential exchange at `/_oauth/iziam`.

- OAuth-only authorization code with or without PKCE: server API, using an application-owned
  callback; returns tokens without creating a Meteor account.

- Client credentials and refresh-token grants: server APIs only.

- End-session URL construction and izIAM's change password interaction.

The OAuth-only API intentionally does not install a client-side router or log in
an application user. OIDC is the identity layer on OAuth 2.

This implementation does not claim complete OAuth 2.1 nor complete OpenID 1.0 Connect conformance.

## Private settings

Settings come from `private.iziam` in the selected environment managed by
`pwix:env-settings-ext`. A direct `Meteor.settings.private.iziam` object is also
supported and takes precedence. Never put client secrets in public settings.

```json
    {
        "private": {
            "iziam": {
                "issuerUrl": "https://identity.example/tenant",
                "client_id": "application-client",
                "client_secret": "configure-outside-source-control",
                "token_endpoint_auth_method": "client_secret_basic",
                "loginStyle": "popup",
                "popupOptions": { "width": 900, "height": 450 },
                "scopes": [ "openid", "profile", "email" ],
                "post_logout_redirect_uri": "https://application.example/",
                "oauth_redirect_uri": "https://application.example/authorization/callback",
                "oauth_scopes": [ "api:read" ],
                "resources": []
            }
        }
    }
```

`issuerUrl` and `client_id` are required.

Supported token-endpoint authentication methods are `client_secret_basic`, `client_secret_post`, and `none`; omitting a
secret selects `none`. Client credentials requires a secret.

`redirect_uri` is computed equal to `Meteor.absoluteUrl('_oauth/iziam')`; configure `ROOT_URL` accordingly.
Though it is not needed to register this redirect URL in the application settings, you still MUST register it with izIAM.

`oauth_redirect_uri` is needed only for OAuth-only authorization and must point
to an application server handler, distinct from the Meteor login callback.

`allowInsecureLocalhost: true` enables HTTP for an explicitly configured loopback
issuer in local tests; HTTPS remains the default.

Configuration and discovery are cached after first use.
Configure the application before starting a flow; restart after changing private provider settings.

## Application APIs

Use `AccountsIziam` from `meteor/pwix:accounts-iziam`, including on the server.
The lower-level equivalents on `iziamOAuth` are implementation APIs.

```js
    // Client
    Meteor.loginWithIzIAM({ loginStyle: 'popup' }, error => { /* completed */ });
    AccountsIziam.changePassword({}, error => { /* completed */ });
    await AccountsIziam.logout();

    // Both client and server, before the first request
    AccountsIziam.configure({ afterRoute: '/' });
```

Login options are restricted to `loginStyle`, `popupOptions`, `scopes`, and
`mobileHint` (selects redirect). Issuer, credentials and callback overrides are
rejected. OIDC login always includes `openid`.

```js
    // Server only: machine authorization
    const credentials = await AccountsIziam.authorizationFlow( 'client_credentials', {
        scopes: [ 'api:read' ]
    });

    // Server only: refresh. Persist returned rotated credentials atomically in the
    // application's token store, and serialize refreshes for each stored grant.
    const updated = await AccountsIziam.authorizationFlow( 'refresh_token', {
        credentials,
        scopes: [ 'api:read' ]
    });

    // Server only: begin OAuth authorization for an authenticated application session.
    const launch = await AccountsIziam.authorizationFlow( 'authorization_code', {
        scopes: [ 'api:read' ]
    });
    // Save launch.credentialToken in that session; redirect its browser to launch.url.

    // In oauth_redirect_uri's server handler, recover the saved value from the same
    // session (never trust a query parameter as the expected credentialToken).
    const granted = await AccountsIziam.completeAuthorization( query, savedCredentialToken );
```

Grant responses contain `accessToken`, `tokenType`, and, when provided,
`refreshToken`, `idToken`, `scope`, and `expiresAt` (milliseconds since epoch).
Refresh preserves omitted refresh tokens and scope, replaces rotated tokens,
and does not mutate the input. Account/token persistence for these server grant
APIs belongs to the application. Tokens are never returned by an anonymous DDP
method. An OAuth-only request cannot be redeemed by the Meteor login callback.

## State and credentials

Pending authorization transactions use a server-only Mongo collection with
10-minute expiry and atomic consumption. PKCE verifiers and nonces remain there;
the browser receives only launch information and correlation data. OIDC tokens
are stored in the individual user's `services.iziam`, without a global token set.
The accounts package publishes only selected public identity fields.

`AccountsIziam.logout()` obtains the end-session URL before ending the local
session. Plain `Meteor.logout()` ends only the local Meteor session. Password
change requires a logged-in izIAM user and rejects a different returned identity.
Provider cancellation or callback errors do not create a login. Meteor skips the
provider handler on cancellation, so abandoned transactions expire by TTL.

## Validation and maintenance

```sh
    npm ci
    npm test
```

The Node suite uses a local issuer and signed tokens. Meteor package tests also
exercise native library loading, the real callback, pending credentials, and
atomic Mongo state consumption. See [maintainer/README.md](maintainer/README.md)
for the isolated Meteor/browser test procedure and the
[consolidation contract](maintainer/consolidation.md).

## Configuration

The package's behavior can be configured through a call to the `iziamOAuth.configure()` method, with just a single javascript object argument, which itself should only contains the options you want override.

Known configuration options are:

- `afterRoute`

    The route to be routed to after a successful login.

    Defaults to `/`.

- `verbosity`

    Defines the expected verbosity level.

    The accepted value can be any or-ed combination of following:

    - `iziamOAuth.C.Verbose.NONE`

        Do not display any trace log to the console

    - `iziamOAuth.C.Verbose.CONFIGURE`

        Display the configuration options and result.

    - `iziamOAuth.C.Verbose.DEBUG`

        Display debug informations.

    Defaults to `iziamOAuth.C.Verbose.CONFIGURE`.

Please note that `iziamOAuth.configure()` method should be called in the same terms both in client and server sides.

Remind too that Meteor packages are instanciated at application level. They are so only configurable once, or, in other words, only one instance has to be or can be configured. Addtionnal calls to `iziamOAuth.configure()` will just override the previous one. You have been warned: **only the application should configure a package**.

## NPM peer dependencies

Starting with v 1.0.0, and in accordance with advices from [the Meteor Guide](https://guide.meteor.com/writing-atmosphere-packages.html#peer-npm-dependencies), we no more hardcode NPM dependencies in the `Npm.depends` clause of the `package.js`.

Instead we check npm versions of installed packages at runtime, on server startup, in development environment.

Dependencies as of v 1.3.0:

```js
    'lodash': '^4.17.0'
    'openid-client': '^6.8.4'
```

## Translations

None at the moment.

## Cookies and comparable technologies

None at the moment.

## Issues & help

In case of support or error, please report your issue request to our [Issues tracker](https://github.com/trychlos/pwix-iziam-oauth/issues).

---
P. Wieser
- Last updated on 2026, Oct. 7th
