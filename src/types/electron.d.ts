import type { BackgroundStatus } from "@/lib/backgroundStatus";

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      toggleOverlay: () => Promise<boolean>;
      setBackgroundStatus: (status: BackgroundStatus) => void;
      studyMemory: {
        getSources: () => Promise<Array<{ id: string; name: string }>>;
        capture: (sourceId: string) => Promise<{ sourceName: string; imageDataUrl: string } | null>;
      };
    };
    overlayAPI?: {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
      ready: () => void;
    };
    statusAPI?: {
      ready: () => void;
      onUpdate: (handler: (status: BackgroundStatus) => void) => () => void;
    };
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

export {};
