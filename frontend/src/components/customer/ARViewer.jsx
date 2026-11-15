import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const MODEL_VIEWER_VERSION = "3.5.0";
let modelViewerPromise;

function loadModelViewer() {
  if (!modelViewerPromise) {
    modelViewerPromise = new Promise((resolve, reject) => {
      const existing = customElements.get("model-viewer");
      if (existing) {
        existing.meshoptDecoderLocation = "https://unpkg.com/meshoptimizer@0.18.1/meshopt_decoder.js";
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.type = "module";
      script.dataset.modelViewer = "true";
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.src = `https://unpkg.com/@google/model-viewer@${MODEL_VIEWER_VERSION}/dist/model-viewer.min.js`;
      script.onload = async () => {
        try {
          await customElements.whenDefined("model-viewer");
          const ModelViewerElement = customElements.get("model-viewer");
          ModelViewerElement.meshoptDecoderLocation =
            "https://unpkg.com/meshoptimizer@0.18.1/meshopt_decoder.js";
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = () => reject(new Error("The 3D viewer could not be downloaded. Check your connection and try again."));
      document.head.appendChild(script);
    }).catch((error) => {
      modelViewerPromise = null;
      throw error;
    });
  }
  return modelViewerPromise;
}

export default function ARViewer({ item, onClose }) {
  const viewerRef = useRef(null);
  const [modelViewerReady, setModelViewerReady] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadModelViewer()
      .then(() => { if (!cancelled) setModelViewerReady(true); })
      .catch((error) => { if (!cancelled) setViewerError(error.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setModelLoaded(false);
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    const onLoad = () => setModelLoaded(true);
    const onError = () => setViewerError("This 3D model could not be loaded. Please try again later.");
    viewer.addEventListener("load", onLoad);
    viewer.addEventListener("error", onError);
    return () => {
      viewer.removeEventListener("load", onLoad);
      viewer.removeEventListener("error", onError);
    };
  }, [modelViewerReady, item?.model_3d_url]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!item) return null;
  const hasModel = Boolean(item.model_3d_url);
  const showPhotoFallback = !hasModel || Boolean(viewerError);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label={`3D view of ${item.name}`}>
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-white">
          <p className="font-semibold text-sm">{item.name}</p>
          {item.price !== undefined && <p className="text-xs text-white/70">{item.price}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close 3D viewer"
          className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white"
        >
          <X size={18} />
        </button>
      </div>

      {hasModel && modelViewerReady && !viewerError && (
        <>
          {/* eslint-disable-next-line react/no-unknown-property */}
          <model-viewer
            ref={viewerRef}
            src={item.model_3d_url}
            alt={item.name}
            poster={item.image_url || undefined}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="auto"
            ar-placement="floor"
            camera-controls
            camera-orbit="0deg 75deg 105%"
            auto-rotate
            interaction-prompt="auto"
            shadow-intensity="1"
            exposure="1.1"
            loading="eager"
            reveal="auto"
            style={{ width: "100%", height: "100%", backgroundColor: "#0a0a0a" }}
          >
            <button slot="ar-button" className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-900 shadow-xl">
              View in your space
            </button>
          </model-viewer>
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent text-center">
            <p className="text-white text-sm font-medium">
              {modelLoaded ? "Rotate and explore the dish. Use the AR control on supported devices to place it on your table." : "Loading 3D model…"}
            </p>
          </div>
        </>
      )}

      {hasModel && !modelViewerReady && !viewerError && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/70 text-sm">Preparing 3D viewer…</p>
        </div>
      )}

      {showPhotoFallback && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="max-w-full max-h-[70vh] rounded-2xl object-contain" />
          ) : (
            <p className="text-white/60 text-sm">No image available</p>
          )}
          <p className="text-white/70 text-xs mt-6 text-center max-w-xs">
            {viewerError || "A 3D AR view isn't available for this item yet."}
          </p>
        </div>
      )}
    </div>
  );
}
