import type { BackgroundStatus, StudyMemoryDesktopStatus } from "@/lib/backgroundStatus";
import type { Companion } from "@/lib/types";

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      toggleOverlay: () => Promise<boolean>;
      closeOverlay: () => void;
      setBackgroundStatus: (status: BackgroundStatus) => void;
      updateCompanion: (companion: Companion) => void;
      studyMemory: {
        getSources: () => Promise<Array<{ id: string; name: string }>>;
        capture: (sourceId: string) => Promise<{ sourceName: string; imageDataUrl: string } | null>;
        setStatus: (status: StudyMemoryDesktopStatus) => void;
        onManualCapture: (handler: () => void) => () => void;
      };
    };
    overlayAPI?: {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
      ready: () => void;
      onTargetAppFocus: (
        handler: (payload: { name: string; position: { x: number; y: number } }) => void,
      ) => () => void;
      onTargetAppBlur: (handler: (payload: { name: string }) => void) => () => void;
      targetAppReached: (name: string) => void;
      onCompanionUpdate: (handler: (companion: Companion) => void) => () => void;
    };
    statusAPI?: {
      ready: () => void;
      onUpdate: (handler: (status: BackgroundStatus) => void) => () => void;
      onMemoryUpdate: (handler: (status: StudyMemoryDesktopStatus) => void) => () => void;
      requestManualCapture: () => void;
    };
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

export {};
