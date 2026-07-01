import React, { useEffect, useRef } from "react";
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

  useEffect(() => {
    // Loads the <model-viewer> custom element script once, only when needed
    if (!customElements.get("model-viewer")) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
      document.head.appendChild(script);
    }
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

      {hasModel ? (
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
