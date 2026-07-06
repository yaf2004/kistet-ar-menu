import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// REAL AR viewer using Google's <model-viewer>. This replaces the old
// version, which just dragged a flat 2D photo on top of the camera feed —
// that was not real AR. This version loads an actual 3D model (.glb file)
// and uses the phone's native AR system (WebXR / Android Scene Viewer /
// iOS Quick Look) to place it on a real surface with proper tracking.
//
// IMPORTANT: this only works if the menu item has a model_3d_url set
// (a .glb file uploaded in the admin panel). If there's no 3D model,
// we show the dish photo full-screen instead as a graceful fallback.
export default function ARViewer({ item, onClose }) {
  const viewerRef = useRef(null);
  const [modelViewerReady, setModelViewerReady] = useState(false);

  useEffect(() => {
    // Loads the <model-viewer> custom element script once, only when needed.
    // Also configures the Meshopt decoder — our .glb files are compressed
    // with EXT_meshopt_compression (via gltf.report), and model-viewer's
    // GLTFLoader throws "setMeshoptDecoder must be called before loading
    // compressed files" if this isn't set BEFORE a model-viewer element
    // gets a src. That's why we gate rendering on modelViewerReady below.
    const existing = customElements.get("model-viewer");
    if (existing) {
      existing.meshoptDecoderLocation =
        "https://unpkg.com/meshoptimizer@0.18.1/meshopt_decoder.js";
      setModelViewerReady(true);
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    script.onload = () => {
      const ModelViewerElement = customElements.get("model-viewer");
      if (ModelViewerElement) {
        ModelViewerElement.meshoptDecoderLocation =
          "https://unpkg.com/meshoptimizer@0.18.1/meshopt_decoder.js";
      }
      setModelViewerReady(true);
    };
    document.head.appendChild(script);
  }, []);

  if (!item) return null;

  const hasModel = Boolean(item.model_3d_url);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-white">
          <p className="font-semibold text-sm">{item.name}</p>
          {item.price && <p className="text-xs text-white/70">{item.price}</p>}
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white"
        >
          <X size={18} />
        </button>
      </div>

      {hasModel && modelViewerReady ? (
        <>
          {/* eslint-disable-next-line react/no-unknown-property */}
          <model-viewer
            ref={viewerRef}
            src={item.model_3d_url}
            alt={item.name}
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="1.1"
            style={{ width: "100%", height: "100%", backgroundColor: "#0a0a0a" }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent text-center">
            <p className="text-white text-sm font-medium">
              Tap the AR icon in the bottom-right of the viewer to place this on your table
            </p>
          </div>
        </>
      ) : hasModel && !modelViewerReady ? (
        // Model exists but the viewer script/decoder isn't ready yet
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/60 text-sm">Loading viewer...</p>
        </div>
      ) : (
        // Fallback when this item has no 3D model yet — show the photo instead
        // of pretending to offer AR that doesn't exist.
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="max-w-full max-h-[70vh] rounded-2xl object-contain" />
          ) : (
            <p className="text-white/60 text-sm">No image available</p>
          )}
          <p className="text-white/60 text-xs mt-6 text-center max-w-xs">
            A 3D AR view isn't available for this item yet.
          </p>
        </div>
      )}
    </div>
  );
}