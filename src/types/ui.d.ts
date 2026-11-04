export type AnyCallback = (...args: any[]) => any;

export interface GlobeEarthHandle {
  ready: () => Promise<boolean>;
  focusLocation: (location: any) => boolean;
  focusLocationWithHighlight: (location: any, label?: string) => Promise<boolean>;
  clearFocusBubble: () => void;
}
