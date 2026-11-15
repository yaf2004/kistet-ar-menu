import React, { useEffect, useRef, useState } from "react";
import { X, RotateCcw, ZoomIn, ZoomOut, Rotate3D, Smartphone, AlertCircle } from "lucide-react";
import "@google/model-viewer";

const MESHOPT_DECODER_URL = "https://unpkg.com/meshoptimizer@0.18.1/meshopt_decoder.js";

export default function ARViewer({ item, onClose }) {
  const viewerRef = useRef(null);
  const [viewerError, setViewerError] = useState("");
  const [modelLoaded, setModelLoaded] = useState(false);
  const [arAvailable, setArAvailable] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    const ModelViewerElement = customElements.get("model-viewer");
    if (ModelViewerElement) {
      ModelViewerElement.meshoptDecoderLocation = MESHOPT_DECODER_URL;
    }
  }, []);

  useEffect(() => {
    setModelLoaded(false);
    setViewerError("");
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    const onLoad = () => {
      setModelLoaded(true);
      setArAvailable(Boolean(viewer.canActivateAR));
    };
    const onError = () => setViewerError("This 3D model could not be loaded. Try again or view the dish photo.");
    const onArStatus = () => setArAvailable(Boolean(viewer.canActivateAR));
    viewer.addEventListener("load", onLoad);
    viewer.addEventListener("error", onError);
    viewer.addEventListener("ar-status", onArStatus);
    return () => {
      viewer.removeEventListener("load", onLoad);
      viewer.removeEventListener("error", onError);
      viewer.removeEventListener("ar-status", onArStatus);
    };
  }, [item?.model_3d_url]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!item) return null;
  const hasModel = Boolean(item.model_3d_url);

  const resetView = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.cameraOrbit = "0deg 75deg 105%";
    viewer.cameraTarget = "auto";
    viewer.fieldOfView = "auto";
    viewer.jumpCameraToGoal();
  };

  const zoom = (direction) => {
    const viewer = viewerRef.current;
    if (viewer) viewer.zoom(direction * 1.15);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#090909] text-white flex flex-col" role="dialog" aria-modal="true" aria-label={`3D view of ${item.name}`}>
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 py-3 bg-black/50">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{item.name}</p>
          {item.price !== undefined && <p className="text-xs text-white/65">{item.price}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close 3D viewer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
          <X size={19} />
        </button>
      </header>

      {hasModel && !viewerError ? (
        <div className="relative flex-1 min-h-0">
          <model-viewer
            ref={viewerRef}
            src={item.model_3d_url}
            alt={`3D model of ${item.name}`}
            poster={item.image_url || undefined}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="auto"
            ar-placement="floor"
            camera-controls
            camera-orbit="0deg 75deg 105%"
            auto-rotate={autoRotate}
            auto-rotate-delay="1500"
            rotation-per-second="18deg"
            interaction-prompt="auto"
            shadow-intensity="1"
            shadow-softness="0.8"
            exposure="1"
            environment-image="neutral"
            loading="eager"
            reveal="auto"
            touch-action="pan-y"
            style={{ width: "100%", height: "100%", backgroundColor: "#090909", "--poster-color": "#090909" }}
          >
            <button slot="ar-button" className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-900 shadow-xl flex items-center gap-2">
              <Smartphone size={16} /> View on your table
            </button>
          </model-viewer>

          {!modelLoaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-white/25 border-t-white rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-white/75">Preparing 3D model…</p>
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button type="button" onClick={() => zoom(1)} aria-label="Zoom in" className="w-10 h-10 rounded-full bg-black/55 border border-white/15 flex items-center justify-center"><ZoomIn size={18} /></button>
            <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out" className="w-10 h-10 rounded-full bg-black/55 border border-white/15 flex items-center justify-center"><ZoomOut size={18} /></button>
            <button type="button" onClick={resetView} aria-label="Reset camera" className="w-10 h-10 rounded-full bg-black/55 border border-white/15 flex items-center justify-center"><RotateCcw size={17} /></button>
            <button type="button" onClick={() => setAutoRotate(value => !value)} aria-label={autoRotate ? "Pause rotation" : "Resume rotation"} className={`w-10 h-10 rounded-full border border-white/15 flex items-center justify-center ${autoRotate ? "bg-violet-600" : "bg-black/55"}`}><Rotate3D size={18} /></button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 pt-12 bg-gradient-to-t from-black/85 to-transparent pointer-events-none">
            <p className="text-center text-xs text-white/75">
              {modelLoaded ? (arAvailable ? "Drag to rotate · Pinch to zoom · Tap View on your table for AR" : "Drag to rotate · Pinch to zoom · AR placement depends on your device and browser") : "Loading your 3D dish…"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {item.image_url ? <img src={item.image_url} alt={item.name} className="max-w-full max-h-[65vh] rounded-2xl object-contain" /> : <AlertCircle size={36} className="text-white/40" />}
          <p className="text-white/70 text-sm mt-5 max-w-sm">{viewerError || "A 3D model is not available for this item yet."}</p>
        </div>
      )}
    </div>
  );
}
