# Maintaining pwix:iziam-oauth

The dependency direction is application → accounts-iziam → iziam-oauth.
See [consolidation.md](consolidation.md) for the contract and initial commits.
Each feature and migration step has its own commit. The old OIDC repository
retains history and a startup error for obsolete consumers, without a wrapper.

## Node regression suite

From this repository:

```sh
    npm ci
    npm test
```

Uses openid-client 6.8.4 and jose 6.2.2 against an ephemeral loopback issuer.
Covers signed ID tokens, nonce/audience/issuer/expiry/signature failures, concurrent
identities, PKCE, state tampering/expiry/replay, callback ownership, password-change
identity binding, logout, OAuth-only authorization, client credentials, and refresh
rotation/error handling. No real izIAM account or external provider is used.

## Meteor and Chromium integration

**Use an isolated test app and database. Tinytest clears Mongo collections.**

Do not point this suite at an existing application's database.

Copy the checked-in template to a new directory under /tmp:

```sh
    cp -R test/meteor /tmp/iziam-consolidation-test
    cd /tmp/iziam-consolidation-test
    npm install
    METEOR_PACKAGE_DIRS=/path/to/parent/of/pwix-repositories meteor run --once --port 3970
```

The package directory must include both this repository and accounts-iziam, plus
any local pwix dependencies being tested. The template pins Meteor 3.5.2 and
includes npm peers required by the local pwix packages. Adjust peer versions if
those packages change. Keep the test app outside the repositories.

From this repository in another terminal (requires Chromium and ChromeDriver):

```sh
    python3 test/browser/check.py --url http://localhost:3970/
```

The runner explicitly starts the exported test-in-console runner, then exercises
popup login, password change, redirect login to the same user, provider logout,
and rejection of anonymous password changes. `autopublish` is deliberately enabled
to check that only public identity fields are visible and authorization state and
tokens stay private. The browser profile and ChromeDriver process are temporary.

The server integration test uses native openid-client loading, real Meteor OAuth
callback and pending-credential handling, and real Mongo atomic state redemption.
Test-only provider setup methods are included exclusively by Package.onTest.
Stop the Meteor process after the test. Rerun it after source changes when using
`--once`.

## Release preparation

Review the three repositories and run both suites. Publish iziam-oauth before
accounts-iziam when explicitly requested. Remove direct iziam-oidc dependencies
and lower-level client calls from development applications. The old client-side
`iziamOAuth.authorizationFlow()` draft is replaced by server APIs on AccountsIziam;
OAuth-only applications must supply a server callback and bind it to the initiating
session. Check private provider settings and registered callback URLs before
exercising a real tenant. No publication or deployment is performed by the tests.

## References

- [openid-client v6 API](https://github.com/panva/openid-client/tree/v6.8.4/docs)
- [Meteor OAuth integration](https://docs.meteor.com/api/accounts.html)

The implementation was also checked against the installed Meteor oauth 3.0.4,
oauth2 1.3.3 and accounts-oauth 1.4.7 sources. Meteor's state envelope is retained
for popup/redirect completion; secrets are stored separately on the server.
