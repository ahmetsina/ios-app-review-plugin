export interface ProgressEvent {
  type: 'analyzer:start' | 'analyzer:complete' | 'scan:start' | 'scan:complete';
  analyzer?: string;
  total?: number;
  completed?: number;
  duration?: number;
}

export type ProgressCallback = (event: ProgressEvent) => void;
