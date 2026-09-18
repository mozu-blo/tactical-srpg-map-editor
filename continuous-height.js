import { roundHeight } from './model.js';

export function getContinuousTargetHeight(startHeight, amount, action) {
  const delta = Number(amount || 0) * (action === 'remove' ? -1 : 1);
  return roundHeight(Number(startHeight || 0) + delta);
}

export function applyFixedContinuousHeight(cell, targetHeight, action) {
  if (action === 'add') {
    if (cell.height < targetHeight) cell.height = targetHeight;
  } else if (cell.height > targetHeight) {
    cell.height = targetHeight;
  }
  return cell.height;
}
