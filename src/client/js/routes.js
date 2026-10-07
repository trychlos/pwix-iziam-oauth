/*
 * pwix:iziam-oauth/src/client/init/routes.js
 */

import _ from 'lodash';
import { strict as assert } from 'node:assert';

import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Logger } from 'meteor/pwix:logger';
import { Tracker } from 'meteor/tracker';

const logger = Logger.get();

// define a client-side route to handle the izIAM callbacks

Tracker.autorun(() => {
    FlowRouter.route( iziamOAuth.configure().iziamRoute, {
        async action( params, queryParams ){
            // if queryParams has a reason, then just terminate
            const reason = queryParams.reason;
            if( reason ){
                logger.info( 'reason', reason );
                FlowRouter.go( iziamOAuth.configure().afterRoute );
                return;
            }
            // else ask the server to handle what has been received
            let res = await Meteor.callAsync( 'pwix.iziamOAuth.m.handle', params, queryParams );
            logger.debug( 'res', res );
        }
    });
});
