import test from 'node:test';
import assert from 'node:assert/strict';
import {printSeconds} from './printActivity.ts';

test('the printing island counts down from the paper\'s estimated time', () => {
 assert.equal(printSeconds(607,32),19);
 assert.equal(printSeconds(640,32),20);
 assert.equal(printSeconds(30,32),2,'never less than two seconds');
 assert.equal(printSeconds(100,0),100,'a missing speed counts as one row a second, not infinity');
});
