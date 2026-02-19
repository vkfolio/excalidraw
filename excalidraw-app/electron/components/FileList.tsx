import React, { useState, useCallback, useEffect } from "react";

import type { DirEntry } from "../electron.d";

import "./FileList.scss";

interface FileListProps {
  entries: DirEntry[];
  folderColors: Record<string, string>;
  sortBy: "name" | "date";
  onSortChange: (sort: "name" | "date") => void;
  onOpen: (entry: DirEntry) => void;
  onDelete: (entry: DirEntry) => void;
  onRename: (entry: DirEntry) => void;
  onSetColor?: (entry: DirEntry) => void;
}

const FolderIconSmall: React.FC<{ color?: string }> = ({ color }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={color || "#6965db"}
    stroke="none"
  >
    <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
  </svg>
);

const FileIconSmall: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9494a8"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
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

export const FileList: React.FC<FileListProps> = ({
  entries,
  folderColors,
  sortBy,
  onSortChange,
  onOpen,
  onDelete,
  onRename,
  onSetColor,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: DirEntry;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

  const handleDoubleClick = useCallback(
    (entry: DirEntry) => {
      onOpen(entry);
    },
    [onOpen],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: DirEntry) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, entry });
    },
    [],
  );

  const handleRenameClick = useCallback(() => {
    if (!contextMenu) {
      return;
    }
    onRename(contextMenu.entry);
    setContextMenu(null);
  }, [contextMenu, onRename]);

  const handleDeleteClick = useCallback(() => {
    if (!contextMenu) {
      return;
    }
    onDelete(contextMenu.entry);
    setContextMenu(null);
  }, [contextMenu, onDelete]);

  const handleSetColorClick = useCallback(() => {
    if (!contextMenu) {
      return;
    }
    if (onSetColor) {
      onSetColor(contextMenu.entry);
    }
    setContextMenu(null);
  }, [contextMenu, onSetColor]);

  const getSortIndicator = useCallback(
    (column: "name" | "date") => {
      if (sortBy !== column) {
        return null;
      }
      return <span className="FileList__sort-indicator">&#9660;</span>;
    },
    [sortBy],
  );

  return (
    <>
      <table className="FileList">
        <thead className="FileList__header">
          <tr>
            <th aria-label="Icon" />
            <th onClick={() => onSortChange("name")}>
              Name {getSortIndicator("name")}
            </th>
            <th onClick={() => onSortChange("date")}>
              Modified {getSortIndicator("date")}
            </th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr className="FileList__empty">
              <td colSpan={4}>No files or folders</td>
            </tr>
          )}
          {entries.map((entry) => (
            <tr
              key={entry.path}
              className="FileList__row"
              onDoubleClick={() => handleDoubleClick(entry)}
              onContextMenu={(e) => handleContextMenu(e, entry)}
            >
              <td>
                <div className="FileList__icon">
                  {entry.isDirectory ? (
                    <FolderIconSmall color={folderColors[entry.path]} />
                  ) : (
                    <FileIconSmall />
                  )}
                </div>
              </td>
              <td>
                <span className="FileList__name" title={entry.name}>
                  {entry.isDirectory
                    ? entry.name
                    : entry.name.replace(/\.excalidraw$/, "")}
                </span>
              </td>
              <td className="FileList__date">
                {new Date(entry.mtime).toLocaleDateString()}
              </td>
              <td className="FileList__size">
                {entry.isDirectory ? "\u2014" : formatSize(entry.size)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {contextMenu && (
        <div
          className="FileList__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="FileList__context-menu-item"
            onClick={handleRenameClick}
            type="button"
          >
            <RenameIcon />
            Rename
          </button>
          {contextMenu.entry.isDirectory && onSetColor && (
            <button
              className="FileList__context-menu-item"
              onClick={handleSetColorClick}
              type="button"
            >
              <PaletteIcon />
              Set Color
            </button>
          )}
          <button
            className="FileList__context-menu-item FileList__context-menu-item--danger"
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

export default FileList;
