import test from 'node:test';
import assert from 'node:assert/strict';
import { changeHeight, createMap, getCell, normalizeMap, roundHeight } from '../model.js';

test('指定サイズのX/Zセルを作成する', () => {
  const map = createMap('試験', 20, 16);
  assert.equal(map.cells.length, 320);
  assert.deepEqual(getCell(map, 19, 15), { x:19, z:15, height:0, color:'#7a8b79', impassable:false, memo:'' });
  assert.equal(getCell(map, 20, 15), null);
});

test('Heightは0.5刻みで加減算し0未満にならない', () => {
  const cell = createMap('試験', 1, 1).cells[0];
  changeHeight(cell, 1.5);
  assert.equal(cell.height, 1.5);
  changeHeight(cell, -3);
  assert.equal(cell.height, 0);
  assert.equal(roundHeight(1.26), 1.5);
});

test('JSON入力を正規化し不正セル数を拒否する', () => {
  const source = createMap('案A', 2, 2);
  source.cells[0].height = 1.25;
  source.cells[0].memo = '岩';
  const map = normalizeMap(source);
  assert.equal(map.cells[0].height, 1.5);
  assert.equal(map.cells[0].memo, '岩');
  assert.throws(() => normalizeMap({ width:2, depth:2, cells:[] }), /セル数/);
});

test('JSON入力の侵入禁止とメモを保持する', () => {
  const source = createMap('属性', 1, 1);
  source.cells[0].impassable = true;
  source.cells[0].memo = '救助対象';
  const restored = normalizeMap(JSON.parse(JSON.stringify(source)));
  assert.equal(restored.cells[0].impassable, true);
  assert.equal(restored.cells[0].memo, '救助対象');
});
