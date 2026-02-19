import React, { useState, useCallback, useEffect } from "react";

import { getElectronAPI } from "../ElectronProvider";

import type { DirEntry } from "../electron.d";

import "./FileCard.scss";

interface FileCardProps {
  entry: DirEntry;
  folderColor?: string;
  onOpen: (entry: DirEntry) => void;
  onDelete: (entry: DirEntry) => void;
  onRename: (entry: DirEntry) => void;
  onSetColor?: (entry: DirEntry) => void;
}

const FolderIcon: React.FC<{ color?: string }> = ({ color }) => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Folder back */}
    <rect
      x="4"
      y="14"
      width="48"
      height="34"
      rx="4"
      fill={color || "#6965db"}
      opacity="0.85"
    />
    {/* Folder tab */}
    <path
      d="M4 10C4 7.79 5.79 6 8 6H20L24 14H4V10Z"
      fill={color || "#6965db"}
    />
    {/* Folder front */}
    <rect
      x="4"
      y="18"
      width="48"
      height="30"
      rx="3"
      fill={color || "#6965db"}
      opacity="0.95"
    />
    {/* Highlight */}
    <rect
      x="8"
      y="22"
      width="24"
      height="2"
      rx="1"
      fill="#fff"
      opacity="0.3"
    />
  </svg>
);

const FileIcon: React.FC = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Page */}
    <rect x="8" y="4" width="26" height="36" rx="3" fill="#e8e8ed" />
    {/* Fold corner */}
    <path d="M28 4L34 10H28V4Z" fill="#c8c8d0" />
    {/* Lines representing content */}
    <rect x="13" y="16" width="16" height="2" rx="1" fill="#c0c0c8" />
    <rect x="13" y="22" width="12" height="2" rx="1" fill="#c0c0c8" />
    <rect x="13" y="28" width="14" height="2" rx="1" fill="#c0c0c8" />
    {/* Excalidraw-style pencil accent */}
    <circle cx="36" cy="36" r="8" fill="#6965db" opacity="0.15" />
    <path
      d="M33 39L36 33L39 39"
      stroke="#6965db"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const RenameIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const PaletteIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="13.5" cy="6.5" r="2" />
    <circle cx="17.5" cy="10.5" r="2" />
    <circle cx="8.5" cy="7.5" r="2" />
    <circle cx="6.5" cy="12.5" r="2" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const formatSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

// Simple thumbnail generator - reads the file and renders a tiny preview
const useThumbnail = (entry: DirEntry) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (entry.isDirectory || !entry.path.endsWith(".excalidraw")) {
      return;
    }

    let cancelled = false;
    const loadThumbnail = async () => {
      const electronAPI = getElectronAPI();
      if (!electronAPI) {
        return;
      }

      try {
        const content = await electronAPI.file.readContent(entry.path);
        const data = JSON.parse(content);
        const elements = data.elements || [];

        if (elements.length === 0) {
          return;
        }

        // Calculate bounding box of all elements
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const el of elements) {
          if (el.isDeleted) {
            continue;
          }
          const x1 = el.x;
          const y1 = el.y;
          const x2 = el.x + (el.width || 0);
          const y2 = el.y + (el.height || 0);
          minX = Math.min(minX, x1);
          minY = Math.min(minY, y1);
          maxX = Math.max(maxX, x2);
          maxY = Math.max(maxY, y2);
        }

        if (!isFinite(minX)) {
          return;
        }

        // Create a simple preview canvas
        const canvas = document.createElement("canvas");
        const PREVIEW_W = 320;
        const PREVIEW_H = 240;
        canvas.width = PREVIEW_W;
        canvas.height = PREVIEW_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }

        // Background
        const bgColor = data.appState?.viewBackgroundColor || "#ffffff";
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

        // Scale to fit
        const contentW = maxX - minX || 1;
        const contentH = maxY - minY || 1;
        const padding = 20;
        const scale = Math.min(
          (PREVIEW_W - padding * 2) / contentW,
          (PREVIEW_H - padding * 2) / contentH,
        );
        const offsetX =
          padding + ((PREVIEW_W - padding * 2 - contentW * scale) / 2);
        const offsetY =
          padding + ((PREVIEW_H - padding * 2 - contentH * scale) / 2);

        // Draw simple shapes
        for (const el of elements) {
          if (el.isDeleted) {
            continue;
          }
          const x = (el.x - minX) * scale + offsetX;
          const y = (el.y - minY) * scale + offsetY;
          const w = (el.width || 0) * scale;
          const h = (el.height || 0) * scale;

          ctx.strokeStyle = el.strokeColor || "#1e1e1e";
          ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * scale * 0.5);
          ctx.fillStyle =
            el.backgroundColor && el.backgroundColor !== "transparent"
              ? el.backgroundColor
              : "transparent";

          if (el.type === "rectangle" || el.type === "image") {
            if (ctx.fillStyle !== "transparent") {
              ctx.fillRect(x, y, w, h);
            }
            ctx.strokeRect(x, y, w, h);
          } else if (el.type === "ellipse") {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            if (ctx.fillStyle !== "transparent") {
              ctx.fill();
            }
            ctx.stroke();
          } else if (el.type === "diamond") {
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w / 2, y + h);
            ctx.lineTo(x, y + h / 2);
            ctx.closePath();
            if (ctx.fillStyle !== "transparent") {
              ctx.fill();
            }
            ctx.stroke();
          } else if (el.type === "text") {
            ctx.fillStyle = el.strokeColor || "#1e1e1e";
            const fontSize = Math.max(6, (el.fontSize || 16) * scale * 0.5);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillText(
              (el.text || "").substring(0, 30),
              x,
              y + fontSize,
            );
          } else if (el.type === "line" || el.type === "arrow") {
            // Draw a simple line from start to end
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y + h);
            ctx.stroke();
          } else if (el.type === "freedraw") {
            // Draw a simple line representation
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y + h);
            ctx.stroke();
          } else {
            // Generic: draw bounding box
            ctx.strokeRect(x, y, w, h);
          }
        }

        if (!cancelled) {
          setThumbnailUrl(canvas.toDataURL("image/png", 0.6));
        }
      } catch {
        // Silently fail - show placeholder icon instead
      }
    };

    // Use requestIdleCallback for lazy loading
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(loadThumbnail);
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    } else {
      const timer = setTimeout(loadThumbnail, 100);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [entry.path, entry.isDirectory, entry.mtime]);

  return thumbnailUrl;
};

export const FileCard: React.FC<FileCardProps> = ({
  entry,
  folderColor,
  onOpen,
  onDelete,
  onRename,
  onSetColor,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const thumbnailUrl = useThumbnail(entry);

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

  const handleDoubleClick = useCallback(() => {
    onOpen(entry);
  }, [entry, onOpen]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleRenameClick = useCallback(() => {
    setContextMenu(null);
    onRename(entry);
  }, [entry, onRename]);

  const handleDeleteClick = useCallback(() => {
    setContextMenu(null);
    onDelete(entry);
  }, [entry, onDelete]);

  const handleSetColorClick = useCallback(() => {
    setContextMenu(null);
    if (onSetColor) {
      onSetColor(entry);
    }
  }, [entry, onSetColor]);

  return (
    <>
      <div
        className="FileCard"
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
      >
        {entry.isDirectory ? (
          <div className="FileCard__folder-icon">
            <FolderIcon color={folderColor} />
          </div>
        ) : (
          <div className="FileCard__thumbnail">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={entry.name}
                loading="lazy"
              />
            ) : (
              <FileIcon />
            )}
          </div>
        )}

        <div className="FileCard__info">
          <p className="FileCard__name" title={entry.name}>
            {entry.isDirectory
              ? entry.name
              : entry.name.replace(/\.excalidraw$/, "")}
          </p>
          <p className="FileCard__meta">
            {entry.isDirectory
              ? "Folder"
              : `${formatSize(entry.size)} \u00B7 ${new Date(entry.mtime).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {contextMenu && (
        <div
          className="FileCard__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="FileCard__context-menu-item"
            onClick={handleRenameClick}
            type="button"
          >
            <RenameIcon />
            Rename
          </button>
          {entry.isDirectory && onSetColor && (
            <button
              className="FileCard__context-menu-item"
              onClick={handleSetColorClick}
              type="button"
            >
              <PaletteIcon />
              Set Color
            </button>
          )}
          <button
            className="FileCard__context-menu-item FileCard__context-menu-item--danger"
            onClick={handleDeleteClick}
            type="button"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      )}
    </>
  );
};

export default FileCard;
