import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import { useSetAtom } from "../../app-jotai";
import { electronViewAtom } from "../../app-jotai";
import { getFrameLikeElements } from "@excalidraw/element";
import { exportToCanvas } from "@excalidraw/utils/export";
import { getOrderedFrames } from "../services/frameOrdering";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import "./PresentationMode.scss";

interface PresentationModeProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onExit?: () => void;
}

const TRANSITION_DURATION_MS = 250;

// ── Icon components ──────────────────────────────────────────────

const ChevronLeftIcon: React.FC = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const PresentationMode: React.FC<PresentationModeProps> = ({
  excalidrawAPI,
  onExit,
}) => {
  const setElectronView = useSetAtom(electronViewAtom);

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      setElectronView("editor");
    }
  }, [onExit, setElectronView]);

  const [orderedFrames, setOrderedFrames] = useState<
    ExcalidrawFrameLikeElement[]
  >([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideCanvas, setSlideCanvas] = useState<HTMLCanvasElement | null>(
    null,
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // Track screen dimensions for getDimensions callback
  const [screenDims, setScreenDims] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  }));

  useEffect(() => {
    const handleResize = () => {
      setScreenDims({
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Collect and order frames on mount
  useEffect(() => {
    const elements = excalidrawAPI.getSceneElements();
    const frames = getFrameLikeElements(elements);
    const ordered = getOrderedFrames(frames);
    setOrderedFrames(ordered);
    setIsLoading(false);
  }, [excalidrawAPI]);

  // Request fullscreen on mount, exit on unmount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const enterFullscreen = async () => {
      try {
        if (document.fullscreenElement !== container) {
          await container.requestFullscreen();
        }
      } catch {
        // Fullscreen may be blocked by browser policy -- continue anyway
      }
    };

    enterFullscreen();

    return () => {
      mountedRef.current = false;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Listen for external fullscreen exit (e.g. user presses Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && mountedRef.current) {
        handleExit();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [handleExit]);

  // Render the current slide whenever currentIndex or orderedFrames change.
  // Uses getDimensions to always scale content to fill the screen at device
  // pixel density - this scales both UP and DOWN unlike maxWidthOrHeight.
  useEffect(() => {
    if (orderedFrames.length === 0) {
      return;
    }

    const currentFrame = orderedFrames[currentIndex];
    if (!currentFrame) {
      return;
    }

    let cancelled = false;

    const renderSlide = async () => {
      try {
        const elements = excalidrawAPI.getSceneElements();
        const files = excalidrawAPI.getFiles();
        const appState = excalidrawAPI.getAppState();

        const { w, h, dpr } = screenDims;

        const canvas = await exportToCanvas({
          elements,
          files,
          appState: {
            ...appState,
            exportBackground: true,
          },
          exportingFrame: currentFrame,
          getDimensions: (contentW, contentH) => {
            // Scale to fill the screen while maintaining aspect ratio
            const scale = Math.min(
              (w * dpr) / contentW,
              (h * dpr) / contentH,
            );
            return {
              width: Math.round(contentW * scale),
              height: Math.round(contentH * scale),
              scale,
            };
          },
        });

        if (!cancelled) {
          setSlideCanvas(canvas);
        }
      } catch (err) {
        console.error("Failed to render presentation slide:", err);
      }
    };

    renderSlide();

    return () => {
      cancelled = true;
    };
  }, [currentIndex, orderedFrames, excalidrawAPI, screenDims]);

  // Paint the exported canvas onto the display container
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || !slideCanvas) {
      return;
    }

    // Clear previous content
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Style the canvas to fill the viewport while preserving aspect ratio
    slideCanvas.style.width = "100%";
    slideCanvas.style.height = "100%";
    slideCanvas.style.objectFit = "contain";
    slideCanvas.className = "PresentationMode__canvas";

    container.appendChild(slideCanvas);
  }, [slideCanvas]);

  // ── Slide navigation ──────────────────────────────────────────

  const goToSlide = useCallback(
    (index: number) => {
      if (
        index < 0 ||
        index >= orderedFrames.length ||
        index === currentIndex ||
        isTransitioning
      ) {
        return;
      }

      setIsTransitioning(true);

      // Fade out
      setTimeout(() => {
        setCurrentIndex(index);
        // Fade in after index updates and canvas renders
        setTimeout(() => {
          setIsTransitioning(false);
        }, TRANSITION_DURATION_MS);
      }, TRANSITION_DURATION_MS);
    },
    [currentIndex, orderedFrames.length, isTransitioning],
  );

  const goNext = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [currentIndex, goToSlide]);

  const goPrev = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [currentIndex, goToSlide]);

  const exitPresentation = useCallback(() => {
    handleExit();
  }, [handleExit]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "Escape":
          e.preventDefault();
          exitPresentation();
          break;
        case "Home":
          e.preventDefault();
          goToSlide(0);
          break;
        case "End":
          e.preventDefault();
          goToSlide(orderedFrames.length - 1);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [goNext, goPrev, exitPresentation, goToSlide, orderedFrames.length]);

  if (isLoading) {
    return (
      <div className="PresentationMode" ref={containerRef}>
        <div className="PresentationMode__loading">Loading slides...</div>
      </div>
    );
  }

  if (orderedFrames.length === 0) {
    return (
      <div className="PresentationMode" ref={containerRef}>
        <div className="PresentationMode__empty">
          <p className="PresentationMode__empty-title">No frames found</p>
          <p className="PresentationMode__empty-message">
            Add frames to your canvas to create slides.
          </p>
          <button
            className="PresentationMode__empty-exit"
            onClick={exitPresentation}
            type="button"
          >
            Back to Editor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="PresentationMode" ref={containerRef}>
      <div
        className={`PresentationMode__slide ${
          isTransitioning ? "PresentationMode__slide--fading" : ""
        }`}
        ref={canvasContainerRef}
      />

      {/* Click zones for mouse navigation */}
      <div
        className="PresentationMode__click-zone PresentationMode__click-zone--left"
        onClick={goPrev}
        role="button"
        tabIndex={-1}
        aria-label="Previous slide"
      />
      <div
        className="PresentationMode__click-zone PresentationMode__click-zone--right"
        onClick={goNext}
        role="button"
        tabIndex={-1}
        aria-label="Next slide"
      />

      {/* Bottom control bar */}
      <div className="PresentationMode__controls">
        <button
          className="PresentationMode__nav-btn"
          onClick={goPrev}
          disabled={currentIndex === 0}
          type="button"
          aria-label="Previous slide"
        >
          <ChevronLeftIcon />
        </button>

        <span className="PresentationMode__counter">
          {currentIndex + 1} / {orderedFrames.length}
        </span>

        <button
          className="PresentationMode__nav-btn"
          onClick={goNext}
          disabled={currentIndex === orderedFrames.length - 1}
          type="button"
          aria-label="Next slide"
        >
          <ChevronRightIcon />
        </button>

        <div className="PresentationMode__controls-spacer" />

        <button
          className="PresentationMode__exit-btn"
          onClick={exitPresentation}
          type="button"
          aria-label="Exit presentation"
        >
          <CloseIcon />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
};

export default PresentationMode;
