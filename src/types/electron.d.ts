import type { BackgroundStatus } from "@/lib/backgroundStatus";

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      toggleOverlay: () => Promise<boolean>;
      setBackgroundStatus: (status: BackgroundStatus) => void;
    };
    overlayAPI?: {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
      ready: () => void;
      onTargetAppFocus: (
        handler: (payload: { name: string; position: { x: number; y: number } }) => void,
      ) => () => void;
      onTargetAppBlur: (handler: (payload: { name: string }) => void) => () => void;
      targetAppReached: (name: string) => void;
    };
    statusAPI?: {
      ready: () => void;
      onUpdate: (handler: (status: BackgroundStatus) => void) => () => void;
    };
  }
}

export {};
