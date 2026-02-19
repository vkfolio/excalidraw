import {
  DefaultSidebar,
  Sidebar,
  THEME,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import {
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { getFrameLikeElements, newFrameElement } from "@excalidraw/element";

import React, { useCallback, useEffect, useState } from "react";

import { isElectron } from "../electron/ElectronProvider";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import { getOrderedFrames } from "../electron/services/frameOrdering";

import "./AppSidebar.scss";

const _isElectron = isElectron();

const DEFAULT_FRAME_WIDTH = 1280;
const DEFAULT_FRAME_HEIGHT = 720;

const ElectronPresentationPanel: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onPresent: () => void;
  onExportPdf: () => void;
}> = ({ excalidrawAPI, onPresent, onExportPdf }) => {
  const [frames, setFrames] = useState<ExcalidrawFrameLikeElement[]>([]);

  const refreshFrames = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const elements = excalidrawAPI.getSceneElements();
    const allFrames = getFrameLikeElements(elements);
    const ordered = getOrderedFrames(allFrames);
    setFrames(ordered);
  }, [excalidrawAPI]);

  // Refresh when the panel is visible
  useEffect(() => {
    refreshFrames();
    // Poll for changes every 2s while the panel is open
    const interval = setInterval(refreshFrames, 2000);
    return () => clearInterval(interval);
  }, [refreshFrames]);

  const handleScrollToFrame = useCallback(
    (frame: ExcalidrawFrameLikeElement) => {
      if (!excalidrawAPI) {
        return;
      }
      excalidrawAPI.scrollToContent(frame, {
        animate: true,
        fitToContent: true,
      });
    },
    [excalidrawAPI],
  );

  const handleAddSlide = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    const appState = excalidrawAPI.getAppState();
    const elements = excalidrawAPI.getSceneElements();

    // Place new frame below the last existing frame, or at viewport center
    let x: number;
    let y: number;

    const existingFrames = getFrameLikeElements(elements);

    if (existingFrames.length > 0) {
      // Find the bottommost frame
      let maxBottom = -Infinity;
      let refX = 0;
      for (const f of existingFrames) {
        const bottom = f.y + f.height;
        if (bottom > maxBottom) {
          maxBottom = bottom;
          refX = f.x;
        }
      }
      x = refX;
      y = maxBottom + 80; // 80px gap below the last frame
    } else {
      // Place at center of the viewport
      const centerX =
        -appState.scrollX + appState.width / 2 / appState.zoom.value;
      const centerY =
        -appState.scrollY + appState.height / 2 / appState.zoom.value;
      x = centerX - DEFAULT_FRAME_WIDTH / 2;
      y = centerY - DEFAULT_FRAME_HEIGHT / 2;
    }

    const slideNumber = existingFrames.length + 1;

    const frame = newFrameElement({
      x,
      y,
      width: DEFAULT_FRAME_WIDTH,
      height: DEFAULT_FRAME_HEIGHT,
      name: `Slide ${slideNumber}`,
    });

    excalidrawAPI.updateScene({
      elements: [...elements, frame],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    // Scroll to and select the new frame
    setTimeout(() => {
      excalidrawAPI.scrollToContent(frame, {
        animate: true,
        fitToContent: true,
      });
      refreshFrames();
    }, 50);
  }, [excalidrawAPI, refreshFrames]);

  return (
    <div className="electron-presentation-panel">
      <div className="electron-presentation-panel__header">
        <h3 className="electron-presentation-panel__title">Slides</h3>
        <div className="electron-presentation-panel__header-actions">
          <button
            className="electron-presentation-panel__add-btn"
            onClick={handleAddSlide}
            type="button"
            title="Add new slide"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className="electron-presentation-panel__refresh"
            onClick={refreshFrames}
            type="button"
            title="Refresh frame list"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {frames.length === 0 ? (
        <div className="electron-presentation-panel__empty">
          <p>No frames found.</p>
          <p className="electron-presentation-panel__hint">
            Add frames to your canvas using the frame tool, or click + above to
            create a slide.
          </p>
        </div>
      ) : (
        <>
          <ul className="electron-presentation-panel__frame-list">
            {frames.map((frame, index) => (
              <li
                key={frame.id}
                className="electron-presentation-panel__frame-item"
              >
                <button
                  className="electron-presentation-panel__frame-btn"
                  onClick={() => handleScrollToFrame(frame)}
                  type="button"
                  title={`Go to ${frame.name || `Slide ${index + 1}`}`}
                >
                  <span className="electron-presentation-panel__frame-number">
                    {index + 1}
                  </span>
                  <span className="electron-presentation-panel__frame-details">
                    <span className="electron-presentation-panel__frame-name">
                      {frame.name || `Slide ${index + 1}`}
                    </span>
                    <span className="electron-presentation-panel__frame-size">
                      {Math.round(frame.width)} x {Math.round(frame.height)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="electron-presentation-panel__actions">
            <button
              className="electron-presentation-panel__action-btn electron-presentation-panel__action-btn--add"
              onClick={handleAddSlide}
              type="button"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Slide
            </button>
            <button
              className="electron-presentation-panel__action-btn electron-presentation-panel__action-btn--primary"
              onClick={onPresent}
              type="button"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Present ({frames.length} slide
              {frames.length !== 1 ? "s" : ""})
            </button>
            <button
              className="electron-presentation-panel__action-btn electron-presentation-panel__action-btn--secondary"
              onClick={onExportPdf}
              type="button"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Export PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const AppSidebar: React.FC<{
  excalidrawAPI?: ExcalidrawImperativeAPI | null;
  onPresent?: () => void;
  onExportPdf?: () => void;
}> = ({ excalidrawAPI, onPresent, onExportPdf }) => {
  const { theme, openSidebar } = useUIAppState();

  if (_isElectron) {
    return (
      <DefaultSidebar>
        <DefaultSidebar.TabTriggers>
          <Sidebar.TabTrigger
            tab="presentation"
            style={{
              opacity: openSidebar?.tab === "presentation" ? 1 : 0.4,
            }}
          >
            {presentationIcon}
          </Sidebar.TabTrigger>
        </DefaultSidebar.TabTriggers>
        <Sidebar.Tab tab="presentation" className="px-3">
          <ElectronPresentationPanel
            excalidrawAPI={excalidrawAPI ?? null}
            onPresent={onPresent ?? (() => {})}
            onExportPdf={onExportPdf ?? (() => {})}
          />
        </Sidebar.Tab>
      </DefaultSidebar>
    );
  }

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="comments"
          style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
        >
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="comments">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_comments_${
                theme === THEME.DARK ? "dark" : "light"
              }.jpg)`,
              opacity: 0.7,
            }}
          />
          <div className="app-sidebar-promo-text">
            Make comments with Excalidraw+
          </div>
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=comments_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_presentations_${
                theme === THEME.DARK ? "dark" : "light"
              }.svg)`,
              backgroundSize: "60%",
              opacity: 0.4,
            }}
          />
          <div className="app-sidebar-promo-text">
            Create presentations with Excalidraw+
          </div>
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=presentations_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
