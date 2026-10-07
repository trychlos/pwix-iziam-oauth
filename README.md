# pwix:iziam-oauth

## What is it ?

An OAuth 2 client for izIAM Identity and Access Manager.

This package is expected to be implemented by any application which would take advantage of izIAM authentication features.

### Important notes

- This package handles OAUth 2 connection flows. It is not compatible - and this wouldn't make sense either - with `pwix:iziam-oidc` package which handles OpenID 1 flows.

- This package does its best to implement [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) specification as of March 2026.

- This is a `MeteorJS` package. Its goal is not only to test and validate the OAUth 2 connection flows, but also to eventually log-in a user: when the Authorization Flow is successfully terminated, we log the user in.

## Provides

### `iziamOAuth`

A global object which holds all the needed resources.

#### ``

## Configuration

The package's behavior can be configured through a call to the `iziamOAuth.configure()` method, with just a single javascript object argument, which itself should only contains the options you want override.

Known configuration options are:

- `verbosity`

    Define the expected verbosity level.

    The accepted value can be any or-ed combination of following:

    - `iziamOAuth.C.Verbose.NONE`

        Do not display any trace log to the console

    - `iziamOAuth.C.Verbose.CONFIGURE`

        Trace `iziamOAuth.configure()` calls and their result

Please note that `iziamOAuth.configure()` method should be called in the same terms both in client and server sides.

Remind too that Meteor packages are instanciated at application level. They are so only configurable once, or, in other words, only one instance has to be or can be configured. Addtionnal calls to `iziamOAuth.configure()` will just override the previous one. You have been warned: **only the application should configure a package**.

## NPM peer dependencies

Starting with v 1.0.0, and in accordance with advices from [the Meteor Guide](https://guide.meteor.com/writing-atmosphere-packages.html#npm-dependencies), we no more hardcode NPM dependencies in the `Npm.depends` clause of the `package.js`. 

Instead we check npm versions of installed packages at runtime, on server startup, in development environment.

Dependencies as of v 1.0.0:

```
    'lodash': '^4.17.0'
```

Each of these dependencies should be installed at application level:
```
    meteor npm install <package> --save
```

## Translations

None at the moment.

## Cookies and comparable technologies

None at the moment.

---
P. Wieser
- Last updated on 2024, Nov. 29th
