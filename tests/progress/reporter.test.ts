import { ProgressReporter } from '../../src/progress/reporter.js';
import type { ProgressEvent } from '../../src/progress/types.js';

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;

  beforeEach(() => {
    reporter = new ProgressReporter();
  });

  describe('scanStart', () => {
    it('should emit scan:start event', () => {
      const events: ProgressEvent[] = [];
      reporter.on('scan:start', (e: ProgressEvent) => events.push(e));

      reporter.scanStart(5);

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('scan:start');
      expect(events[0]!.total).toBe(5);
      expect(events[0]!.completed).toBe(0);
    });
  });

  describe('analyzerStart', () => {
    it('should emit analyzer:start event', () => {
      const events: ProgressEvent[] = [];
      reporter.on('analyzer:start', (e: ProgressEvent) => events.push(e));

      reporter.scanStart(3);
      reporter.analyzerStart('code');

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('analyzer:start');
      expect(events[0]!.analyzer).toBe('code');
    });
  });

  describe('analyzerComplete', () => {
    it('should emit analyzer:complete event with duration', () => {
      const events: ProgressEvent[] = [];
      reporter.on('analyzer:complete', (e: ProgressEvent) => events.push(e));

      reporter.scanStart(3);
      reporter.analyzerComplete('code', 150);

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('analyzer:complete');
      expect(events[0]!.analyzer).toBe('code');
      expect(events[0]!.duration).toBe(150);
      expect(events[0]!.completed).toBe(1);
    });

    it('should increment completed count', () => {
      reporter.scanStart(3);
      reporter.analyzerComplete('a', 10);
      reporter.analyzerComplete('b', 20);

      expect(reporter.percentage).toBe(67); // 2/3 = 66.67 -> 67
    });
  });

  describe('scanComplete', () => {
    it('should emit scan:complete event', () => {
      const events: ProgressEvent[] = [];
      reporter.on('scan:complete', (e: ProgressEvent) => events.push(e));

      reporter.scanStart(2);
      reporter.analyzerComplete('a', 10);
      reporter.analyzerComplete('b', 20);
      reporter.scanComplete(30);

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('scan:complete');
      expect(events[0]!.duration).toBe(30);
      expect(events[0]!.completed).toBe(2);
    });
  });

  describe('percentage', () => {
    it('should return 0 when no analyzers', () => {
      expect(reporter.percentage).toBe(0);
    });

    it('should return 0 at start', () => {
      reporter.scanStart(5);
      expect(reporter.percentage).toBe(0);
    });

    it('should return 100 when all complete', () => {
      reporter.scanStart(2);
      reporter.analyzerComplete('a', 10);
      reporter.analyzerComplete('b', 10);
      expect(reporter.percentage).toBe(100);
    });
  });

  describe('callback', () => {
    it('should call callback on all events', () => {
      const events: ProgressEvent[] = [];
      const callbackReporter = new ProgressReporter((e) => events.push(e));

      callbackReporter.scanStart(1);
      callbackReporter.analyzerStart('code');
      callbackReporter.analyzerComplete('code', 100);
      callbackReporter.scanComplete(100);

      expect(events).toHaveLength(4);
      expect(events.map((e) => e.type)).toEqual([
        'scan:start',
        'analyzer:start',
        'analyzer:complete',
        'scan:complete',
      ]);
    });
  });
});
