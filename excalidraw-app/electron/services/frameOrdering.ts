import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

/**
 * Sort frames spatially: top-to-bottom rows, left-to-right within rows.
 * Frames within `ROW_THRESHOLD` pixels vertically are treated as the same row.
 *
 * If a custom order array of element IDs is provided, that ordering takes
 * precedence and any frames not in the custom list are appended at the end.
 */
export const getOrderedFrames = (
  frames: ExcalidrawFrameLikeElement[],
  customOrder?: string[],
): ExcalidrawFrameLikeElement[] => {
  if (frames.length === 0) {
    return [];
  }

  if (customOrder && customOrder.length > 0) {
    const orderMap = new Map(customOrder.map((id, i) => [id, i]));
    return [...frames].sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? Infinity;
      const bIdx = orderMap.get(b.id) ?? Infinity;
      if (aIdx === bIdx) {
        // Both unknown -- fall back to spatial Y then X
        return a.y - b.y || a.x - b.x;
      }
      return aIdx - bIdx;
    });
  }

  // Spatial sort: group into rows, then sort within each row by X
  const ROW_THRESHOLD = 50;
  const sorted = [...frames].sort((a, b) => a.y - b.y);

  const rows: ExcalidrawFrameLikeElement[][] = [];
  let currentRow: ExcalidrawFrameLikeElement[] = [];
  let rowY = -Infinity;

  for (const frame of sorted) {
    if (currentRow.length === 0 || Math.abs(frame.y - rowY) <= ROW_THRESHOLD) {
      currentRow.push(frame);
      if (currentRow.length === 1) {
        rowY = frame.y;
      }
    } else {
      rows.push(currentRow);
      currentRow = [frame];
      rowY = frame.y;
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
};
