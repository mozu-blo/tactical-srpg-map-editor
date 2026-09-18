import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFixedContinuousHeight, getContinuousTargetHeight } from '../continuous-height.js';
import { changeHeight } from '../model.js';

test('Y方向連続編集ONでは再通過時に通常の加算を許可する', () => {
  const cell = { height:1 };
  changeHeight(cell, 1);
  assert.equal(cell.height, 2);
});

test('Y方向連続編集OFFの配置は開始セル由来の固定Heightまでだけ上げる', () => {
  const target = getContinuousTargetHeight(0, 1, 'add');
  const cells = [{ height:0 }, { height:0 }, { height:1 }, { height:2 }];
  cells.forEach((cell) => applyFixedContinuousHeight(cell, target, 'add'));
  assert.deepEqual(cells.map((cell) => cell.height), [1, 1, 1, 2]);
});

test('Y方向連続編集OFFの消去は開始セル由来の固定Heightまでだけ下げる', () => {
  const target = getContinuousTargetHeight(2, 1, 'remove');
  const cells = [{ height:0 }, { height:1 }, { height:2 }, { height:3 }];
  cells.forEach((cell) => applyFixedContinuousHeight(cell, target, 'remove'));
  assert.deepEqual(cells.map((cell) => cell.height), [0, 1, 1, 1]);
});
