Package.describe({
    name: 'pwix:iziam-oauth',
    version: '1.0.0-rc',
    summary: 'izIAM OAuth client',
    git: 'https://github.com/trychlos/pwix-iziam-oauth.git',
    documentation: 'README.md'
});

Package.onUse( function( api ){
    configure( api );
    api.mainModule( 'src/client/js/index.js', 'client' );
    api.mainModule( 'src/server/js/index.js', 'server' );
});

Package.onTest( function( api ){
    configure( api );
    api.use( 'tinytest' );
    api.use( 'pwix:iziam-oauth' );
    api.mainModule( 'test/js/index.js' );
});

function configure( api ){
    api.versionsFrom([ '2.9.0', '3.0-rc.1' ]);
    api.export([
        'iziamOAuth'
    ]);
    api.use( 'aldeed:simple-schema@2.0.0' );
    api.use( 'ecmascript' );
    api.use( 'fetch' );
    api.use( 'mongo' );
    api.use( 'oauth' );
    api.use( 'oauth2' );
    api.use( 'ostrio:flow-router-extra@3.0.0' );
    api.use( 'pwix:collection-timestampable@2.4.0' );
    api.use( 'pwix:env-settings-ext@1.2.0' );
    api.use( 'pwix:field@1.8.0' );
    api.use( 'pwix:forms@1.9.0' );
    api.use( 'pwix:i18n@1.7.0' );
    api.use( 'pwix:logger@1.0.0' );
    api.use( 'random' );
    api.use( 'reactive-var' );
    api.use( 'service-configuration' );
    api.use( 'tmeasday:check-npm-versions@2.0.0', 'server' );
    api.use( 'tracker' );
}

// NPM dependencies are checked in /src/server/js/check_npms.js
// See also https://guide.meteor.com/writing-atmosphere-packages.html#npm-dependencies
