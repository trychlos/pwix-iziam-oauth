Package.describe({
    name: 'pwix:iziam-oauth',
    version: '1.0.1',
    summary: 'izIAM OAuth 2 and OpenID Connect protocol client',
    git: 'https://github.com/trychlos/pwix-iziam-oauth.git',
    documentation: 'README.md'
});

Package.onUse( api => {
    api.versionsFrom( '3.3.1' );
    api.use( 'check' );
    api.use( 'ecmascript' );
    api.use( 'mongo' );
    api.use( 'oauth' );
    api.use( 'oauth2' );
    api.use( 'pwix:env-settings@2.1.0', 'server' );
    api.use( 'pwix:env-settings-ext@1.2.0', 'server' );
    api.use( 'pwix:logger@1.0.0' );
    api.use( 'reactive-var' );
    api.use( 'service-configuration' );
    api.use( 'tmeasday:check-npm-versions@1.0.2 || 2.0.0-beta.0', 'server' );
    api.export( 'iziamOAuth' );
    api.mainModule( 'src/client/js/index.js', 'client' );
    api.mainModule( 'src/server/js/index.js', 'server' );
});

Package.onTest( api => {
    api.versionsFrom( '3.3.1' );
    api.use( 'ecmascript' );
    api.use( 'oauth' );
    api.use( 'pwix:iziam-oauth' );
    api.use( 'service-configuration' );
    api.use( 'tinytest' );
    api.mainModule( 'test/js/index.js', 'client' );
    api.mainModule( 'test/js/server.js', 'server' );
});
