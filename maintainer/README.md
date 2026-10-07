# Maintaining pwix:iziam-oauth

The dependency direction is application → accounts-iziam → iziam-oauth.
See [consolidation.md](consolidation.md) for the contract and initial commits.
Each feature and migration step has its own commit. The old OIDC repository
retains history and a startup error for obsolete consumers, without a wrapper.

## Node regression suite

This suite runs **plain Node**, not Meteor. The protocol class must not import
`meteor/*`, directly or through a collection. Its `states` constructor argument
is supplied by an in-memory store in the Node tests and `States.s` in Meteor.
Do not install an npm package named `meteor` to resolve a failure here.

From this repository (Node 22.12+):

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

Use two terminals. In terminal 1, create a fresh test app (the random suffix
avoids copying into an existing directory):

```sh
cd /home/pierre/data/dev/pwix-iziam-oauth
iziam_test_dir=$(mktemp -d /tmp/iziam-suite.XXXXXX)
cp -R test/meteor/. "$iziam_test_dir/"
cd "$iziam_test_dir"
npm install
unset MONGO_URL MONGO_OPLOG_URL
ROOT_URL=http://localhost:3970/ METEOR_PACKAGE_DIRS=/home/pierre/data/dev meteor run --once --port 3970
```

Wait for `App running at http://localhost:3970/`. Leave terminal 1 running.
Meteor starts an isolated Mongo instance. Unsetting the Mongo variables prevents
an inherited application database connection from being used. Port 3970 (and
3971 for its Mongo instance) must be free.


The package directory must include both this repository and accounts-iziam, plus
any local pwix dependencies being tested. The template pins Meteor 3.5.2 and
includes npm peers required by the local pwix packages. Adjust peer versions if
those packages change. Keep the test app outside the repositories.

In terminal 2 (requires Chromium and ChromeDriver):

```sh
cd /home/pierre/data/dev/pwix-iziam-oauth
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
Stop terminal 1 with Ctrl+C after the test. After code changes, restart the Meteor
command in that same test directory, then rerun the Python command. `--once`
does not rebuild on changes. For Node-only testing, run `npm test` directly;
neither Meteor nor the browser runner is required.

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
