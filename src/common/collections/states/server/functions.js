/*
 * pwix:iziam-oauth/src/common/collections/states/server/functions.js
 */

import _ from 'lodash';

import { States } from '../index.js';

let _ready = undefined;

States.s = {
    // create an index before first use
    async initialize(){
        if( !_ready ){
            _ready = States.collection.rawCollection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        }
        return _ready;
    },

    // insert a state
    async insert( transaction ){
        if( await this.initialize()){
            return States.collection.rawCollection().insertOne( transaction );
        }
        return _ready;
    },

    // consume a state
    async consume( state, now, mode, credentialToken ){
        if( await this.initialize()){
            // Explicit expiry check: Mongo's TTL cleanup is asynchronous.
            return States.collection.rawCollection().findOneAndDelete(
                { state, mode, ...(credentialToken ? { _id: credentialToken } : {}), expiresAt: { $gt: now } }, { includeResultMetadata: false }
            );
        }
        return _ready;
    }
};
