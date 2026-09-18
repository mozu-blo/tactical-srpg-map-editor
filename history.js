import { cloneMap } from './model.js';

export class EditHistory {
  constructor(limit = 80) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }

  reset() {
    this.past = [];
    this.future = [];
  }

  commit(before, current) {
    if (JSON.stringify(before) === JSON.stringify(current)) return false;
    this.past.push(cloneMap(before));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    return true;
  }

  undo(current) {
    if (!this.past.length) return null;
    const previous = this.past.pop();
    this.future.push(cloneMap(current));
    return cloneMap(previous);
  }

  redo(current) {
    if (!this.future.length) return null;
    const next = this.future.pop();
    this.past.push(cloneMap(current));
    return cloneMap(next);
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
