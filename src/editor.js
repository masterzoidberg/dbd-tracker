// Ownership exists only inside the native exclusive lock callback. Closing the
// document releases it; denied windows retry only on an explicit user action.
export class EditorGuard {
  constructor(locks) { this.locks = locks; this.state = 'readonly'; this.pending = null; }
  assertWriter() {
    if (this.state !== 'editing') throw new Error('Read-only: editing requires ownership. Close the other tracker window, then choose Enable editing.');
  }
  acquire() {
    if (this.state === 'editing') return Promise.resolve(true);
    if (this.pending) return this.pending;
    this.state = 'requesting';
    const attempt = new Promise(resolve => {
      try {
        if (!this.locks?.request) throw new Error('Web Locks unavailable');
        Promise.resolve(this.locks.request('dbdTracker-editor', { mode: 'exclusive', ifAvailable: true }, lock => {
          this.state = lock ? 'editing' : 'readonly';
          resolve(Boolean(lock));
          if (lock) return new Promise(() => {});
        })).catch(() => { this.state = 'unavailable'; resolve(false); });
      } catch { this.state = 'unavailable'; resolve(false); }
    });
    this.pending = attempt.finally(() => { this.pending = null; });
    return this.pending;
  }
}
