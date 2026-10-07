Package.describe({
    name: 'pwix:iziam-oauth',
    version: '1.0.0-rc.1',
    summary: 'izIAM OAuth 2 and OpenID Connect protocol client',
    git: 'https://github.com/trychlos/pwix-iziam-oauth.git',
    documentation: 'README.md'
});

Package.onUse(api => {
    api.versionsFrom('3.3.1');
    api.use(['ecmascript', 'check', 'mongo', 'oauth', 'oauth2', 'reactive-var', 'service-configuration']);
    api.use('pwix:env-settings@2.1.0', 'server');
    api.use('pwix:env-settings-ext@1.2.0', 'server');
    api.use('pwix:i18n@1.7.0');
    api.export('iziamOAuth');
    api.mainModule('src/client/js/index.js', 'client');
    api.mainModule('src/server/js/index.js', 'server');
});

Package.onTest(api => {
    api.versionsFrom('3.3.1');
    api.use(['ecmascript', 'tinytest', 'oauth', 'pwix:iziam-oauth']);
    api.mainModule('test/js/index.js', 'client');
    api.mainModule('test/js/server.js', 'server');
});
