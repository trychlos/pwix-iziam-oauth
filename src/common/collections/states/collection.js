/*
 * pwix:iziam-oauth/src/common/collections/states/collection.js
 */

import _ from 'lodash';

import { check } from 'meteor/check';
import { Mongo } from 'meteor/mongo';

export const States = {
    collection: undefined,
    collectionName: 'iz_oauth_states'
};

if( States.collection ){
    check( States.collection, Mongo.Collection );
} else {
    States.collection = new Mongo.Collection( States.collectionName, { _preventAutopublish: true });
}

if( Meteor.isServer ){
    States.collection.deny({
        insert(){ return true; },
        update(){ return true; },
        remove(){ return true; },
    });
}
