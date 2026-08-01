/**
 * Minimal typings for WebGazer 3.x — the package ships none.
 *
 * Only the surface we actually call is declared; everything else on the real
 * object is left off deliberately so a typo fails the build instead of
 * silently doing nothing at runtime.
 */
declare module "webgazer" {
  /** A single gaze prediction in viewport (CSS pixel) coordinates. */
  export interface GazePrediction {
    x: number;
    y: number;
  }

  export interface WebGazerParams {
    /** Directory the MediaPipe face-mesh WASM + model files are served from. */
    faceMeshSolutionPath: string;
    /** Milliseconds between gaze-listener callbacks. */
    dataTimestep: number;
    videoViewerWidth: number;
    videoViewerHeight: number;
    showVideo: boolean;
    showFaceOverlay: boolean;
    showFaceFeedbackBox: boolean;
    showGazeDot: boolean;
    camConstraints: MediaStreamConstraints;
  }

  export interface WebGazer {
    params: WebGazerParams;
    /** Resolves once the camera is live; rejects if access is refused. */
    begin(onFail?: () => void): Promise<WebGazer>;
    end(): WebGazer;
    /** Releases the camera. `end()` alone leaves the stream running. */
    stopVideo(): WebGazer;
    pause(): WebGazer;
    resume(): Promise<WebGazer>;
    isReady(): boolean;
    /** `data` is null on frames where no face was found. */
    setGazeListener(listener: (data: GazePrediction | null, elapsedTime: number) => void): WebGazer;
    clearGazeListener(): WebGazer;
    setRegression(name: "ridge" | "weightedRidge" | "threadedRidge"): WebGazer;
    setTracker(name: string): WebGazer;
    saveDataAcrossSessions(val: boolean): WebGazer;
    applyKalmanFilter(val: boolean): WebGazer;
    showVideoPreview(val: boolean): WebGazer;
    showVideo(val: boolean): WebGazer;
    showFaceOverlay(val: boolean): WebGazer;
    showFaceFeedbackBox(val: boolean): WebGazer;
    showPredictionPoints(val: boolean): WebGazer;
    setVideoViewerSize(width: number, height: number): WebGazer;
    clearData(): Promise<void>;
    getCurrentPrediction(): GazePrediction | null;
    detectCompatibility(): boolean;
  }

  const webgazer: WebGazer;
  export default webgazer;
}

/**
 * The prebuilt bundle we actually load — see `useFocusTracking`. Same object,
 * but the webpack build publishes it as `module.exports.webgazer`, so the
 * useful export here is named, not default.
 */
declare module "webgazer/dist/webgazer.commonjs2.js" {
  import type { WebGazer } from "webgazer";

  export const webgazer: WebGazer;
  /** CommonJS namespace, as seen through ESM interop. */
  const exports: { webgazer: WebGazer };
  export default exports;
}
