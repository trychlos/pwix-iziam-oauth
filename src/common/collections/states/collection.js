/*
 * pwix:iziam-oauth:/src/common/collections/states/collection.js
 */

import _ from 'lodash';
import { strict as assert } from 'node:assert';

import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';

export const States = {
    collectionName: 'iz_oauth_states',
    collection: null,
    fieldSet: new ReactiveVar( null ),
    schemaAttached: false
};

States.collection = new Mongo.Collection( States.collectionName );

// we need the collection name both here to name the collection, and when publishing to tabular...
