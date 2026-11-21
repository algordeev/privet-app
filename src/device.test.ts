import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceName} from './device.ts';

test('an iPad is recognised, including iPadOS desktop-style user agents',()=>{
 assert.equal(deviceName({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',maxTouchPoints:5}),'iPhone');
 assert.equal(deviceName({userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',maxTouchPoints:5}),'iPad');
 assert.equal(deviceName({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',maxTouchPoints:5}),'iPad');
 assert.equal(deviceName({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',maxTouchPoints:0}),'iPhone','A real Mac (browser preview) reads as iPhone');
 assert.equal(deviceName(undefined),'iPhone');
});
