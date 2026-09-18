import test from 'node:test';
import assert from 'node:assert/strict';
import { EditHistory } from '../history.js';
import { cloneMap, createMap, getCell } from '../model.js';

test('編集を戻して進める', () => {
  let map = createMap('履歴', 2, 2);
  const history = new EditHistory();
  const before = cloneMap(map);
  getCell(map, 1, 1).height = 2;
  assert.equal(history.commit(before, map), true);
  map = history.undo(map);
  assert.equal(getCell(map, 1, 1).height, 0);
  map = history.redo(map);
  assert.equal(getCell(map, 1, 1).height, 2);
});

test('変更がない操作は履歴へ追加しない', () => {
  const map = createMap();
  const history = new EditHistory();
  assert.equal(history.commit(map, cloneMap(map)), false);
  assert.equal(history.canUndo, false);
});
