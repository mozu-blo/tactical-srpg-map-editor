import test from 'node:test';
import assert from 'node:assert/strict';
import { heightLabelText, panTargetDelta } from './view-utils.js';

test('Height numbers omit unnecessary decimal places', () => {
  assert.deepEqual([0, .5, 1, 1.5, 7].map(heightLabelText), ['0', '0.5', '1', '1.5', '7']);
});

test('horizontal drag pans the camera target along the screen plane', () => {
  const params = { dx: 100, dy: 0, yaw: 0, pitch: 42, top: 10, bottom: -10, zoom: 1, viewportHeight: 1000 };
  const front = panTargetDelta(params);
  assert.ok(Math.abs(front.x + 2) < 1e-10);
  assert.ok(Math.abs(front.z) < 1e-10);
  const side = panTargetDelta({ ...params, yaw: 90 });
  assert.ok(Math.abs(side.x) < 1e-10);
  assert.ok(Math.abs(side.z - 2) < 1e-10);
  const zoomed = panTargetDelta({ ...params, zoom: 2 });
  assert.ok(Math.abs(zoomed.x + 1) < 1e-10);
});

test('vertical drag retains a horizontal pan at battle and top views', () => {
  for (const pitch of [42, 90]) {
    const delta = panTargetDelta({ dx: 0, dy: 50, yaw: 45, pitch, top: 10, bottom: -10, zoom: 1, viewportHeight: 1000 });
    assert.ok(delta.x < 0 && delta.z < 0);
    assert.ok(Number.isFinite(delta.x) && Number.isFinite(delta.z));
  }
});
