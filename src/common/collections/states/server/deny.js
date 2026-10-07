/*
 * pwix:iziam-oauth:/src/common/collections/states/server/deny.js
 */

import _ from 'lodash';
import { strict as assert } from 'node:assert';

import { States } from '../index.js';

// Deny all client-side updates
// cf. https://guide.meteor.com/security.html#allow-deny

States.collection.deny({
    insert(){ return true; },
    update(){ return true; },
    remove(){ return true; },
});
