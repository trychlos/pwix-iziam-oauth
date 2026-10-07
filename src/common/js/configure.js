/*
 * pwix:iziam-oauth/src/common/js/configure.js
 */

import _ from 'lodash';

import { check } from 'meteor/check';
import { Logger } from 'meteor/pwix:logger';
import { ReactiveVar } from 'meteor/reactive-var';

const logger = Logger.get();

let _conf = {};

iziamOAuth._conf = new ReactiveVar( _conf );

iziamOAuth._defaults = {
    afterRoute: '/',
    verbosity: iziamOAuth.C.Verbose.CONFIGURE
};

/**
 * @summary Get/set the package configuration
 *  Should be called *in same terms* both by the client and the server.
 * @param {Object} o configuration options
 * @returns {Object} the package configuration
 */
iziamOAuth.configure = function( o ){
    if( o ){
        check( o, Object );
        if( o.afterRoute !== undefined && ( typeof o.afterRoute !== 'string' ||
            !o.afterRoute.startsWith( '/' ) || o.afterRoute.startsWith( '//' ))){
            throw new Error( 'afterRoute must be an application-relative path' );
        }
        // check that keys exist
        const built_conf = {};
        Object.keys( o ).forEach(( it ) => {
            if( Object.keys( iziamOAuth._defaults ).includes( it )){
                built_conf[it] = o[it];
            } else {
                logger.warn( 'configure() ignore unmanaged key \''+it+'\'' );
            }
        });
        if( Object.keys( built_conf ).length ){
            _conf = _.merge( {}, iziamOAuth._defaults, _conf, built_conf );
            iziamOAuth._conf.set( _conf );
            logger.verbose({ verbosity: _conf.verbosity, against: iziamOAuth.C.Verbose.CONFIGURE }, 'configure() with', built_conf );
        }
    }
    // also acts as a getter
    return { ...iziamOAuth._conf.get() };
}

_conf = _.merge( {}, iziamOAuth._defaults );
iziamOAuth._conf.set( _conf );
