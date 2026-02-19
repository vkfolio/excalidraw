import { exportToCanvas } from "@excalidraw/utils/export";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

type Orientation = "auto" | "portrait" | "landscape";
type Quality = "standard" | "high";

// PDF dimensions in mm (A4)
const PDF_WIDTH_MM = 210;
const PDF_HEIGHT_MM = 297;

const QUALITY_SCALE: Record<Quality, number> = {
  standard: 1.5,
  high: 3,
};

/**
 * Determine whether a given frame should be rendered in landscape or portrait.
 * If orientation is "auto", the frame's aspect ratio decides.
 */
const resolveOrientation = (
  width: number,
  height: number,
  orientation: Orientation,
): "portrait" | "landscape" => {
  if (orientation === "auto") {
    return width > height ? "landscape" : "portrait";
  }
  return orientation;
};

/**
 * Calculate the image dimensions to fit inside the PDF page while preserving
 * aspect ratio, with a small margin.
 */
const fitToPdfPage = (
  imgWidth: number,
  imgHeight: number,
  pageWidth: number,
  pageHeight: number,
  marginMm: number = 10,
): { x: number; y: number; w: number; h: number } => {
  const usableW = pageWidth - marginMm * 2;
  const usableH = pageHeight - marginMm * 2;

  const imgAspect = imgWidth / imgHeight;
  const pageAspect = usableW / usableH;

  let w: number;
  let h: number;

  if (imgAspect > pageAspect) {
    // Image is wider relative to page
    w = usableW;
    h = usableW / imgAspect;
  } else {
    // Image is taller relative to page
    h = usableH;
    w = usableH * imgAspect;
  }

  const x = (pageWidth - w) / 2;
  const y = (pageHeight - h) / 2;

  return { x, y, w, h };
};

/**
 * Export each frame as a separate PDF page.
 * Each frame is rendered as a high-quality PNG, then placed on a PDF page
 * sized to match the frame's orientation.
 */
export const exportToPdfFrames = async (
  api: ExcalidrawImperativeAPI,
  frames: ExcalidrawFrameLikeElement[],
  orientation: Orientation = "auto",
  quality: Quality = "standard",
): Promise<Blob> => {
  const { jsPDF } = await import("jspdf");

  if (frames.length === 0) {
    throw new Error("No frames provided for PDF export.");
  }

  const elements = api.getSceneElements();
  const files = api.getFiles();
  const appState = api.getAppState();

  // Determine first page orientation to initialize the document
  const firstFrame = frames[0];
  const firstOrientation = resolveOrientation(
    firstFrame.width,
    firstFrame.height,
    orientation,
  );

  const doc = new jsPDF({
    orientation: firstOrientation === "landscape" ? "l" : "p",
    unit: "mm",
    format: "a4",
  });

  const scale = QUALITY_SCALE[quality];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    const pageOrientation = resolveOrientation(
      frame.width,
      frame.height,
      orientation,
    );

    // Add a new page for frames after the first
    if (i > 0) {
      doc.addPage("a4", pageOrientation === "landscape" ? "l" : "p");
    }

    const pageWidth =
      pageOrientation === "landscape" ? PDF_HEIGHT_MM : PDF_WIDTH_MM;
    const pageHeight =
      pageOrientation === "landscape" ? PDF_WIDTH_MM : PDF_HEIGHT_MM;

    const canvas = await exportToCanvas({
      elements,
      files,
      appState: {
        ...appState,
        exportBackground: true,
        exportScale: scale,
      },
      exportingFrame: frame,
    });

    const imgDataUrl = canvas.toDataURL("image/png");
    const { x, y, w, h } = fitToPdfPage(
      canvas.width,
      canvas.height,
      pageWidth,
      pageHeight,
    );

    doc.addImage(imgDataUrl, "PNG", x, y, w, h);
  }

  return doc.output("blob");
};

/**
 * Export the entire visible canvas as a single-page PDF.
 */
export const exportToPdfFullCanvas = async (
  api: ExcalidrawImperativeAPI,
  orientation: Orientation = "auto",
  quality: Quality = "standard",
): Promise<Blob> => {
  const { jsPDF } = await import("jspdf");

  const elements = api.getSceneElements();
  const files = api.getFiles();
  const appState = api.getAppState();
  const scale = QUALITY_SCALE[quality];

  const canvas = await exportToCanvas({
    elements,
    files,
    appState: {
      ...appState,
      exportBackground: true,
      exportScale: scale,
    },
  });

  const pageOrientation = resolveOrientation(
    canvas.width,
    canvas.height,
    orientation,
  );

  const doc = new jsPDF({
    orientation: pageOrientation === "landscape" ? "l" : "p",
    unit: "mm",
    format: "a4",
  });

  const pageWidth =
    pageOrientation === "landscape" ? PDF_HEIGHT_MM : PDF_WIDTH_MM;
  const pageHeight =
    pageOrientation === "landscape" ? PDF_WIDTH_MM : PDF_HEIGHT_MM;

  const imgDataUrl = canvas.toDataURL("image/png");
  const { x, y, w, h } = fitToPdfPage(
    canvas.width,
    canvas.height,
    pageWidth,
    pageHeight,
  );

  doc.addImage(imgDataUrl, "PNG", x, y, w, h);

  return doc.output("blob");
};
