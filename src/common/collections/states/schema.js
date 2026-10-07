/*
 * pwix:iziam-oauth:/src/common/collections/states/schema.js
 */

import _ from 'lodash';
import SimpleSchema from 'meteor/aldeed:simple-schema';
import { strict as assert } from 'node:assert';

import { Tracker } from 'meteor/tracker';

import { States } from './index.js';

Tracker.autorun(() => {
    const fieldSet = States.fieldSet.get();
    if( fieldSet && !States.schemaAttached ){
        States.collection.attachSchema( new SimpleSchema( fieldSet.toSchema()), { replace: true });
        States.collection.attachBehaviour( 'timestampable', { replace: true });
        States.schemaAttached = true;
    }
});
