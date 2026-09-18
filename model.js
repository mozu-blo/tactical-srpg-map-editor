export const DEFAULT_COLOR = '#7a8b79';
export const HEIGHT_STEP = 0.5;

export function roundHeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number / HEIGHT_STEP) * HEIGHT_STEP);
}

export function createMap(mapName = '新しいマップ', width = 16, depth = 16) {
  width = Math.max(1, Math.min(64, Math.trunc(Number(width) || 16)));
  depth = Math.max(1, Math.min(64, Math.trunc(Number(depth) || 16)));
  const cells = [];
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({ x, z, height: 0, color: DEFAULT_COLOR, impassable: false, memo: '' });
    }
  }
  return { schemaVersion: 1, mapName: String(mapName || '新しいマップ'), width, depth, cells };
}

export function cellIndex(map, x, z) {
  return z * map.width + x;
}

export function getCell(map, x, z) {
  if (x < 0 || z < 0 || x >= map.width || z >= map.depth) return null;
  return map.cells[cellIndex(map, x, z)] || null;
}

export function changeHeight(cell, amount) {
  cell.height = roundHeight(cell.height + Number(amount || 0));
  return cell.height;
}

export function normalizeMap(input) {
  if (!input || typeof input !== 'object') throw new Error('JSONがマップ形式ではありません。');
  const width = Math.trunc(Number(input.width));
  const depth = Math.trunc(Number(input.depth));
  if (width < 1 || depth < 1 || width > 64 || depth > 64) throw new Error('横・縦サイズは1〜64で指定してください。');
  if (!Array.isArray(input.cells) || input.cells.length !== width * depth) throw new Error('セル数がマップサイズと一致しません。');
  const map = createMap(input.mapName || '読み込みマップ', width, depth);
  for (const source of input.cells) {
    const x = Math.trunc(Number(source.x));
    const z = Math.trunc(Number(source.z));
    const cell = getCell(map, x, z);
    if (!cell) throw new Error(`境界外セルがあります: (${x}, ${z})`);
    cell.height = roundHeight(source.height);
    cell.color = /^#[0-9a-f]{6}$/i.test(source.color) ? source.color : DEFAULT_COLOR;
    cell.impassable = Boolean(source.impassable);
    cell.memo = String(source.memo || '').slice(0, 500);
  }
  return map;
}

export function cloneMap(map) {
  return structuredClone(map);
}
