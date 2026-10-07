# OAuth / OIDC consolidation

The initial working trees, including untracked files, were committed before
implementation: oauth `ca2d8e2`, oidc `4643f0e`, accounts `0f5db94`.

There are no production consumers. This is a direct replacement, without aliases
or a compatibility package. Applications use `pwix:accounts-iziam`; it delegates
protocol work to `pwix:iziam-oauth`. `pwix:iziam-oidc` is retired.

## Contract

- Keep the `iziam` service, `services.iziam`, `Meteor.loginWithIzIAM`, and the
  login/change-password/logout components.
- Use `iziamOAuth` internally and `AccountsIziam` as the application facade.
- Use Meteor's `/_oauth/iziam` callback for interactive flows; no FlowRouter
  dependency or second callback route.
- Keep credentials in private environment settings under `iziam`. Browser
  options cannot override the issuer, client credentials or callback endpoint.
- Separate OIDC login from OAuth authorization: only validated OIDC identity
  establishes a Meteor account. Client credentials and refresh are server APIs.
- Use one openid-client v6 implementation, with native server loading rather
  than modifying application node_modules during a package build.

## Commit-sized work

1. Record the architecture and migration contract (this document).
2. Consolidate the authorization-code engine, configuration and Meteor adapter.
3. Secure single-use state, credential ownership and browser-facing responses.
4. Switch accounts-iziam and its components directly to the new facade.
5. Establish executable protocol and Meteor integration regression checks.
6. Complete OAuth-only authorization, client credentials and refresh grants,
   with a separate commit for each feature.
7. Retire the old package and update package consumer/documentation references.

Validation uses an isolated application and local test issuer, without modifying
real identity records. Publishing packages or deploying applications is outside
this local implementation task.

## Implementation decisions

OAuth-only authorization is a server API. It uses an explicitly configured
application callback (`oauth_redirect_uri`) and requires the credentialToken
saved in the initiating session. It cannot use the Meteor login callback to
create an account. OIDC login retains `/_oauth/iziam`; no FlowRouter callback is
installed. Client credentials and refresh are also server-only.

Runtime support is now Meteor 3.3.1+ / Node 22.12+, with openid-client >=6.8.4 <7.
The existing application-facing login service remains `iziam`.

A separate isolated Meteor application is used for validation. Existing sibling
application worktrees are not modified by this package consolidation.
