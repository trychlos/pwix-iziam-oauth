import { Mongo } from 'meteor/mongo';

// Never published. Raw Mongo operations make redemption atomic across servers.
const collection = new Mongo.Collection('iz_oauth_states');
collection.deny({ insert: () => true, update: () => true, remove: () => true });
let ready;

export const states = {
    async initialize() {
        if (!ready) ready = collection.rawCollection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        return ready;
    },
    async insert(transaction) {
        await this.initialize();
        return collection.rawCollection().insertOne(transaction);
    },
    async consume(state, now) {
        await this.initialize();
        // Explicit expiry check: Mongo's TTL cleanup is asynchronous.
        return collection.rawCollection().findOneAndDelete(
            { state, expiresAt: { $gt: now } }, { includeResultMetadata: false }
        );
    }
};
