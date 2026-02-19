import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";

import { useAtom, useSetAtom } from "../../app-jotai";
import { electronViewAtom, currentFilePathAtom } from "../../app-jotai";
import { currentPathAtom, viewModeAtom, searchQueryAtom, sortByAtom } from "../atoms";
import { getElectronAPI } from "../ElectronProvider";
import { FileCard } from "./FileCard";
import { FileList } from "./FileList";
import { FolderColorPicker } from "./FolderColorPicker";

import type { DirEntry, FolderMeta } from "../electron.d";

import "./FolderBrowser.scss";

// ── Icon Components ─────────────────────────────────────

const PlusIcon: React.FC = () => (
  <svg
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
);

const FolderPlusIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const GridIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const ListIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const EmptyFolderIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const HomeIcon: React.FC = () => (
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
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

// ── Helpers ─────────────────────────────────────────────

const PATH_SEPARATOR = /[\\/]/;

const getPathSegments = (
  currentPath: string,
  rootPath: string,
): { name: string; path: string }[] => {
  if (!currentPath || !rootPath) {
    return [];
  }

  // If we are at the root, no segments to show beyond home
  if (currentPath === rootPath) {
    return [];
  }

  // Get the relative part after the root
  const relativePart = currentPath.slice(rootPath.length).replace(/^[\\/]/, "");
  if (!relativePart) {
    return [];
  }

  const parts = relativePart.split(PATH_SEPARATOR);
  const segments: { name: string; path: string }[] = [];
  let accumulated = rootPath;

  for (const part of parts) {
    if (part) {
      // Use the same separator that appears in the rootPath
      const sep = rootPath.includes("\\") ? "\\" : "/";
      accumulated = accumulated + sep + part;
      segments.push({ name: part, path: accumulated });
    }
  }

  return segments;
};

const createNewDrawingContent = (): string => {
  return JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: "excalidraw-desktop",
      elements: [],
      appState: {
        viewBackgroundColor: "#ffffff",
      },
      files: {},
    },
    null,
    2,
  );
};

// ── FolderBrowser Component ─────────────────────────────

export const FolderBrowser: React.FC = () => {
  const [currentPath, setCurrentPath] = useAtom(currentPathAtom);
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [sortBy, setSortBy] = useAtom(sortByAtom);
  const setElectronView = useSetAtom(electronViewAtom);
  const setCurrentFilePath = useSetAtom(currentFilePathAtom);

  const [rootPath, setRootPath] = useState<string>("");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [folderColors, setFolderColors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New folder dialog
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Rename dialog - entry and value are separate so typing doesn't re-trigger focus
  const [renameEntry, setRenameEntry] = useState<DirEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameDialogInputRef = useRef<HTMLInputElement>(null);

  // Color picker
  const [colorPickerState, setColorPickerState] = useState<{
    entry: DirEntry;
    position: { x: number; y: number };
  } | null>(null);

  // ── Initialize root path ──────────────────────────────

  useEffect(() => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      return;
    }

    const loadRoot = async () => {
      try {
        const root = await electronAPI.config.getRootFolder();
        if (root) {
          setRootPath(root);
          if (!currentPath) {
            setCurrentPath(root);
          }
        }
      } catch (err) {
        console.error("Failed to load root folder:", err);
      }
    };

    loadRoot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch directory listing ───────────────────────────

  const fetchEntries = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI || !currentPath) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dirEntries = await electronAPI.dir.list(currentPath);
      setEntries(dirEntries);

      // Load folder colors for directories
      const colors: Record<string, string> = {};
      for (const entry of dirEntries) {
        if (entry.isDirectory) {
          try {
            const meta = await electronAPI.dir.readMeta(entry.path);
            if (meta?.color) {
              colors[entry.path] = meta.color;
            }
          } catch {
            // Meta file might not exist, that is fine
          }
        }
      }
      setFolderColors(colors);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to list directory.",
      );
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Focus new folder input ────────────────────────────

  useEffect(() => {
    if (showNewFolderDialog && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [showNewFolderDialog]);

  // ── Focus rename dialog input ───────────────────────────

  useEffect(() => {
    if (renameEntry && renameDialogInputRef.current) {
      renameDialogInputRef.current.focus();
      const val = renameDialogInputRef.current.value;
      const dotIndex = val.lastIndexOf(".");
      if (dotIndex > 0 && !renameEntry.isDirectory) {
        renameDialogInputRef.current.setSelectionRange(0, dotIndex);
      } else {
        renameDialogInputRef.current.select();
      }
    }
  }, [renameEntry]);

  // ── Filtering and sorting ─────────────────────────────

  const filteredAndSortedEntries = useMemo(() => {
    let result = entries;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(query));
    }

    // Sort: directories first, then by chosen sort
    result = [...result].sort((a, b) => {
      // Directories always first
      if (a.isDirectory && !b.isDirectory) {
        return -1;
      }
      if (!a.isDirectory && b.isDirectory) {
        return 1;
      }

      if (sortBy === "name") {
        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
      }
      // Sort by date descending (newest first)
      return b.mtime - a.mtime;
    });

    return result;
  }, [entries, searchQuery, sortBy]);

  // ── Breadcrumb segments ───────────────────────────────

  const breadcrumbSegments = useMemo(
    () => getPathSegments(currentPath, rootPath),
    [currentPath, rootPath],
  );

  // ── Event Handlers ────────────────────────────────────

  const handleNavigate = useCallback(
    (path: string) => {
      setCurrentPath(path);
      setSearchQuery("");
    },
    [setCurrentPath, setSearchQuery],
  );

  const handleOpen = useCallback(
    (entry: DirEntry) => {
      if (entry.isDirectory) {
        handleNavigate(entry.path);
      } else {
        // Open file in editor
        setCurrentFilePath(entry.path);
        setElectronView("editor");
      }
    },
    [handleNavigate, setCurrentFilePath, setElectronView],
  );

  const handleDelete = useCallback(
    async (entry: DirEntry) => {
      const electronAPI = getElectronAPI();
      if (!electronAPI) {
        return;
      }

      const confirmMessage = entry.isDirectory
        ? `Delete folder "${entry.name}" and all its contents?`
        : `Delete "${entry.name}"?`;

      if (!window.confirm(confirmMessage)) {
        return;
      }

      try {
        if (entry.isDirectory) {
          await electronAPI.dir.delete(entry.path);
        } else {
          await electronAPI.file.delete(entry.path);
        }
        await fetchEntries();
      } catch (err) {
        console.error("Delete failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to delete item.",
        );
      }
    },
    [fetchEntries],
  );

  const handleRename = useCallback(
    async (entry: DirEntry, newName: string) => {
      const electronAPI = getElectronAPI();
      if (!electronAPI) {
        return;
      }

      try {
        if (entry.isDirectory) {
          await electronAPI.dir.rename(entry.path, newName);
        } else {
          await electronAPI.file.rename(entry.path, newName);
        }
        await fetchEntries();
      } catch (err) {
        console.error("Rename failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to rename item.",
        );
      }
    },
    [fetchEntries],
  );

  const handleNewDrawing = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI || !currentPath) {
      return;
    }

    try {
      // Generate a unique file name
      let name = "Untitled.excalidraw";
      let counter = 1;
      const existingNames = new Set(entries.map((e) => e.name));
      while (existingNames.has(name)) {
        name = `Untitled ${counter}.excalidraw`;
        counter++;
      }

      const sep = currentPath.includes("\\") ? "\\" : "/";
      const filePath = currentPath + sep + name;
      const content = createNewDrawingContent();
      await electronAPI.file.writeContent(filePath, content);

      setCurrentFilePath(filePath);
      setElectronView("editor");
    } catch (err) {
      console.error("Failed to create new drawing:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create drawing.",
      );
    }
  }, [currentPath, entries, setCurrentFilePath, setElectronView]);

  const handleNewFolder = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI || !currentPath) {
      return;
    }

    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      await electronAPI.dir.create(currentPath, trimmedName);
      setShowNewFolderDialog(false);
      setNewFolderName("");
      await fetchEntries();
    } catch (err) {
      console.error("Failed to create folder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create folder.",
      );
    }
  }, [currentPath, newFolderName, fetchEntries]);

  const handleNewFolderKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleNewFolder();
      } else if (e.key === "Escape") {
        setShowNewFolderDialog(false);
        setNewFolderName("");
      }
    },
    [handleNewFolder],
  );

  // ── Rename dialog handlers ─────────────────────────────

  const openRenameDialog = useCallback((entry: DirEntry) => {
    setRenameValue(entry.name);
    setRenameEntry(entry);
  }, []);

  const closeRenameDialog = useCallback(() => {
    setRenameEntry(null);
    setRenameValue("");
  }, []);

  const handleRenameDialogCommit = useCallback(async () => {
    if (!renameEntry) {
      return;
    }
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== renameEntry.name) {
      await handleRename(renameEntry, trimmed);
    }
    closeRenameDialog();
  }, [renameEntry, renameValue, handleRename, closeRenameDialog]);

  const handleRenameDialogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleRenameDialogCommit();
      } else if (e.key === "Escape") {
        closeRenameDialog();
      }
    },
    [handleRenameDialogCommit, closeRenameDialog],
  );

  const handleSetColor = useCallback((entry: DirEntry) => {
    // Position the color picker near center screen as a fallback
    setColorPickerState({
      entry,
      position: {
        x: Math.min(window.innerWidth - 200, window.innerWidth / 2),
        y: Math.min(window.innerHeight - 250, window.innerHeight / 2),
      },
    });
  }, []);

  const handleColorChange = useCallback(
    async (color: string) => {
      const electronAPI = getElectronAPI();
      if (!electronAPI || !colorPickerState) {
        return;
      }

      try {
        const existingMeta =
          (await electronAPI.dir.readMeta(colorPickerState.entry.path)) || {};
        const newMeta: FolderMeta = {
          ...existingMeta,
          color: color || undefined,
        };
        await electronAPI.dir.writeMeta(colorPickerState.entry.path, newMeta);

        // Update local state
        setFolderColors((prev) => {
          const next = { ...prev };
          if (color) {
            next[colorPickerState.entry.path] = color;
          } else {
            delete next[colorPickerState.entry.path];
          }
          return next;
        });
      } catch (err) {
        console.error("Failed to set folder color:", err);
      }
    },
    [colorPickerState],
  );

  const handleSortChange = useCallback(
    (newSort: "name" | "date") => {
      setSortBy(newSort);
    },
    [setSortBy],
  );

  // ── File / Folder counts ──────────────────────────────

  const fileCount = useMemo(() => {
    const folders = filteredAndSortedEntries.filter((e) => e.isDirectory).length;
    const files = filteredAndSortedEntries.filter((e) => !e.isDirectory).length;
    const parts: string[] = [];
    if (folders > 0) {
      parts.push(`${folders} folder${folders !== 1 ? "s" : ""}`);
    }
    if (files > 0) {
      parts.push(`${files} file${files !== 1 ? "s" : ""}`);
    }
    return parts.length > 0 ? parts.join(", ") : "Empty folder";
  }, [filteredAndSortedEntries]);

  // ── Render ────────────────────────────────────────────

  return (
    <div className="FolderBrowser">
      {/* Top Bar */}
      <div className="FolderBrowser__topbar">
        <div className="FolderBrowser__breadcrumbs">
          <button
            className={`FolderBrowser__breadcrumb${
              breadcrumbSegments.length === 0
                ? " FolderBrowser__breadcrumb--active"
                : ""
            }`}
            onClick={() => handleNavigate(rootPath)}
            type="button"
            title="Home"
          >
            <HomeIcon />
          </button>

          {breadcrumbSegments.map((segment, index) => (
            <React.Fragment key={segment.path}>
              <span className="FolderBrowser__breadcrumb-separator">/</span>
              <button
                className={`FolderBrowser__breadcrumb${
                  index === breadcrumbSegments.length - 1
                    ? " FolderBrowser__breadcrumb--active"
                    : ""
                }`}
                onClick={() => handleNavigate(segment.path)}
                type="button"
                title={segment.path}
              >
                {segment.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="FolderBrowser__actions">
          <button
            className="FolderBrowser__btn FolderBrowser__btn--primary"
            onClick={handleNewDrawing}
            type="button"
          >
            <PlusIcon />
            New Drawing
          </button>
          <button
            className="FolderBrowser__btn FolderBrowser__btn--secondary"
            onClick={() => {
              setNewFolderName("");
              setShowNewFolderDialog(true);
            }}
            type="button"
          >
            <FolderPlusIcon />
            New Folder
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="FolderBrowser__toolbar">
        <input
          className="FolderBrowser__search"
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="FolderBrowser__toolbar-spacer" />

        <select
          className="FolderBrowser__sort-select"
          value={sortBy}
          onChange={(e) =>
            handleSortChange(e.target.value as "name" | "date")
          }
        >
          <option value="name">Sort by Name</option>
          <option value="date">Sort by Date</option>
        </select>

        <div className="FolderBrowser__view-toggle">
          <button
            className={`FolderBrowser__view-btn${
              viewMode === "grid" ? " FolderBrowser__view-btn--active" : ""
            }`}
            onClick={() => setViewMode("grid")}
            type="button"
            title="Grid view"
            aria-label="Grid view"
          >
            <GridIcon />
          </button>
          <button
            className={`FolderBrowser__view-btn${
              viewMode === "list" ? " FolderBrowser__view-btn--active" : ""
            }`}
            onClick={() => setViewMode("list")}
            type="button"
            title="List view"
            aria-label="List view"
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="FolderBrowser__content">
        {isLoading ? (
          <div className="FolderBrowser__loading">Loading...</div>
        ) : error ? (
          <div className="FolderBrowser__error">
            <p>{error}</p>
            <button
              className="FolderBrowser__btn FolderBrowser__btn--secondary"
              onClick={fetchEntries}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : filteredAndSortedEntries.length === 0 ? (
          <div className="FolderBrowser__empty">
            <EmptyFolderIcon />
            <p className="FolderBrowser__empty-text">
              {searchQuery
                ? "No files match your search"
                : "This folder is empty"}
            </p>
            <p className="FolderBrowser__empty-hint">
              {searchQuery
                ? "Try a different search term"
                : 'Click "New Drawing" to get started'}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="FolderBrowser__grid">
            {filteredAndSortedEntries.map((entry) => (
              <FileCard
                key={entry.path}
                entry={entry}
                folderColor={folderColors[entry.path]}
                onOpen={handleOpen}
                onDelete={handleDelete}
                onRename={openRenameDialog}
                onSetColor={
                  entry.isDirectory ? handleSetColor : undefined
                }
              />
            ))}
          </div>
        ) : (
          <FileList
            entries={filteredAndSortedEntries}
            folderColors={folderColors}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onRename={openRenameDialog}
            onSetColor={handleSetColor}
          />
        )}
      </div>

      {/* Bottom Bar */}
      <div className="FolderBrowser__bottombar">
        <span className="FolderBrowser__file-count">{fileCount}</span>
        <span className="FolderBrowser__current-path" title={currentPath}>
          {currentPath}
        </span>
      </div>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div
          className="FolderBrowser__dialog-overlay"
          onClick={() => {
            setShowNewFolderDialog(false);
            setNewFolderName("");
          }}
        >
          <div
            className="FolderBrowser__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="FolderBrowser__dialog-title">New Folder</h3>
            <input
              ref={newFolderInputRef}
              className="FolderBrowser__dialog-input"
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={handleNewFolderKeyDown}
            />
            <div className="FolderBrowser__dialog-actions">
              <button
                className="FolderBrowser__btn FolderBrowser__btn--secondary"
                onClick={() => {
                  setShowNewFolderDialog(false);
                  setNewFolderName("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="FolderBrowser__btn FolderBrowser__btn--primary"
                onClick={handleNewFolder}
                disabled={!newFolderName.trim()}
                type="button"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {renameEntry && (
        <div
          className="FolderBrowser__dialog-overlay"
          onClick={closeRenameDialog}
        >
          <div
            className="FolderBrowser__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="FolderBrowser__dialog-title">Rename</h3>
            <input
              ref={renameDialogInputRef}
              className="FolderBrowser__dialog-input"
              type="text"
              placeholder={
                renameEntry.isDirectory ? "Folder name" : "File name"
              }
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameDialogKeyDown}
            />
            <div className="FolderBrowser__dialog-actions">
              <button
                className="FolderBrowser__btn FolderBrowser__btn--secondary"
                onClick={closeRenameDialog}
                type="button"
              >
                Cancel
              </button>
              <button
                className="FolderBrowser__btn FolderBrowser__btn--primary"
                onClick={handleRenameDialogCommit}
                disabled={
                  !renameValue.trim() ||
                  renameValue.trim() === renameEntry.name
                }
                type="button"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Color Picker */}
      {colorPickerState && (
        <FolderColorPicker
          currentColor={folderColors[colorPickerState.entry.path]}
          onColorChange={handleColorChange}
          onClose={() => setColorPickerState(null)}
          position={colorPickerState.position}
        />
      )}
    </div>
  );
};

export default FolderBrowser;
