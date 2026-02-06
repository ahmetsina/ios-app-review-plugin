import { EventEmitter } from 'events';
import type { ProgressEvent, ProgressCallback } from './types.js';

export class ProgressReporter extends EventEmitter {
  private total = 0;
  private completed = 0;
  private callback?: ProgressCallback | undefined;

  constructor(callback?: ProgressCallback) {
    super();
    this.callback = callback;
  }

  scanStart(totalAnalyzers: number): void {
    this.total = totalAnalyzers;
    this.completed = 0;
    const event: ProgressEvent = {
      type: 'scan:start',
      total: this.total,
      completed: 0,
    };
    this.emit('scan:start', event);
    this.callback?.(event);
  }

  analyzerStart(name: string): void {
    const event: ProgressEvent = {
      type: 'analyzer:start',
      analyzer: name,
      total: this.total,
      completed: this.completed,
    };
    this.emit('analyzer:start', event);
    this.callback?.(event);
  }

  analyzerComplete(name: string, duration: number): void {
    this.completed++;
    const event: ProgressEvent = {
      type: 'analyzer:complete',
      analyzer: name,
      total: this.total,
      completed: this.completed,
      duration,
    };
    this.emit('analyzer:complete', event);
    this.callback?.(event);
  }

  scanComplete(totalDuration: number): void {
    const event: ProgressEvent = {
      type: 'scan:complete',
      total: this.total,
      completed: this.completed,
      duration: totalDuration,
    };
    this.emit('scan:complete', event);
    this.callback?.(event);
  }

  get percentage(): number {
    if (this.total === 0) return 0;
    return Math.round((this.completed / this.total) * 100);
  }
}
