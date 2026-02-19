import React, { useState, useEffect, useCallback, useRef } from "react";

import { getFrameLikeElements } from "@excalidraw/element";
import { getElectronAPI } from "../ElectronProvider";
import { getOrderedFrames } from "../services/frameOrdering";
import { exportToPdfFrames, exportToPdfFullCanvas } from "../services/pdfExport";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import "./PdfExportDialog.scss";

type ExportMode = "frames" | "full-canvas";
type Orientation = "auto" | "portrait" | "landscape";
type Quality = "standard" | "high";

interface PdfExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const PdfExportDialog: React.FC<PdfExportDialogProps> = ({
  isOpen,
  onClose,
  excalidrawAPI,
}) => {
  const [exportMode, setExportMode] = useState<ExportMode>("frames");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [quality, setQuality] = useState<Quality>("standard");
  const [frames, setFrames] = useState<ExcalidrawFrameLikeElement[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Refresh frame list whenever dialog opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    const allFrames = getFrameLikeElements(elements);
    const ordered = getOrderedFrames(allFrames);
    setFrames(ordered);
    setError(null);
  }, [isOpen, excalidrawAPI]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Close when clicking overlay background
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      let blob: Blob;

      if (exportMode === "frames") {
        if (frames.length === 0) {
          setError("No frames found on the canvas.");
          setIsExporting(false);
          return;
        }
        blob = await exportToPdfFrames(
          excalidrawAPI,
          frames,
          orientation,
          quality,
        );
      } else {
        blob = await exportToPdfFullCanvas(excalidrawAPI, orientation, quality);
      }

      // Convert blob to ArrayBuffer for Electron file save
      const arrayBuffer = await blob.arrayBuffer();

      const electronAPI = getElectronAPI();
      if (electronAPI) {
        const result = await electronAPI.fs.fileSave(arrayBuffer, {
          fileName: "excalidraw-export.pdf",
          description: "PDF files",
          extensions: [".pdf"],
        });

        if (result) {
          onClose();
        }
      } else {
        // Fallback for non-Electron: trigger browser download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "excalidraw-export.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
      }
    } catch (err) {
      console.error("PDF export failed:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [exportMode, frames, excalidrawAPI, orientation, quality, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="PdfExportDialog__overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className="PdfExportDialog" role="dialog" aria-modal="true">
        <h2 className="PdfExportDialog__title">Export to PDF</h2>

        {/* Export Mode */}
        <fieldset className="PdfExportDialog__fieldset">
          <legend className="PdfExportDialog__legend">Export mode</legend>

          <label className="PdfExportDialog__radio-label">
            <input
              type="radio"
              name="exportMode"
              value="frames"
              checked={exportMode === "frames"}
              onChange={() => setExportMode("frames")}
              disabled={isExporting}
            />
            <span className="PdfExportDialog__radio-text">
              Frames as pages
              {frames.length > 0 && (
                <span className="PdfExportDialog__frame-count">
                  {frames.length} frame{frames.length !== 1 ? "s" : ""} found
                </span>
              )}
              {frames.length === 0 && (
                <span className="PdfExportDialog__frame-count PdfExportDialog__frame-count--warning">
                  No frames found
                </span>
              )}
            </span>
          </label>

          <label className="PdfExportDialog__radio-label">
            <input
              type="radio"
              name="exportMode"
              value="full-canvas"
              checked={exportMode === "full-canvas"}
              onChange={() => setExportMode("full-canvas")}
              disabled={isExporting}
            />
            <span className="PdfExportDialog__radio-text">
              Full canvas as single page
            </span>
          </label>
        </fieldset>

        {/* Orientation */}
        <fieldset className="PdfExportDialog__fieldset">
          <legend className="PdfExportDialog__legend">Orientation</legend>

          <div className="PdfExportDialog__radio-group">
            <label className="PdfExportDialog__radio-label">
              <input
                type="radio"
                name="orientation"
                value="auto"
                checked={orientation === "auto"}
                onChange={() => setOrientation("auto")}
                disabled={isExporting}
              />
              <span className="PdfExportDialog__radio-text">Auto</span>
            </label>

            <label className="PdfExportDialog__radio-label">
              <input
                type="radio"
                name="orientation"
                value="portrait"
                checked={orientation === "portrait"}
                onChange={() => setOrientation("portrait")}
                disabled={isExporting}
              />
              <span className="PdfExportDialog__radio-text">Portrait</span>
            </label>

            <label className="PdfExportDialog__radio-label">
              <input
                type="radio"
                name="orientation"
                value="landscape"
                checked={orientation === "landscape"}
                onChange={() => setOrientation("landscape")}
                disabled={isExporting}
              />
              <span className="PdfExportDialog__radio-text">Landscape</span>
            </label>
          </div>
        </fieldset>

        {/* Quality */}
        <fieldset className="PdfExportDialog__fieldset">
          <legend className="PdfExportDialog__legend">Quality</legend>

          <div className="PdfExportDialog__radio-group">
            <label className="PdfExportDialog__radio-label">
              <input
                type="radio"
                name="quality"
                value="standard"
                checked={quality === "standard"}
                onChange={() => setQuality("standard")}
                disabled={isExporting}
              />
              <span className="PdfExportDialog__radio-text">Standard</span>
            </label>

            <label className="PdfExportDialog__radio-label">
              <input
                type="radio"
                name="quality"
                value="high"
                checked={quality === "high"}
                onChange={() => setQuality("high")}
                disabled={isExporting}
              />
              <span className="PdfExportDialog__radio-text">High</span>
            </label>
          </div>
        </fieldset>

        {/* Error */}
        {error && <p className="PdfExportDialog__error">{error}</p>}

        {/* Actions */}
        <div className="PdfExportDialog__actions">
          <button
            className="PdfExportDialog__btn PdfExportDialog__btn--secondary"
            onClick={onClose}
            disabled={isExporting}
            type="button"
          >
            Cancel
          </button>
          <button
            className="PdfExportDialog__btn PdfExportDialog__btn--primary"
            onClick={handleExport}
            disabled={isExporting || (exportMode === "frames" && frames.length === 0)}
            type="button"
          >
            {isExporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfExportDialog;
