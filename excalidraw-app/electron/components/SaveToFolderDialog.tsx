import React, { useState, useEffect, useCallback, useRef } from "react";

import { useAtomValue } from "../../app-jotai";
import { currentPathAtom } from "../atoms";
import { getElectronAPI } from "../ElectronProvider";

import type { DirEntry } from "../electron.d";

import "./SaveToFolderDialog.scss";

// ── Icon Components ──────────────────────────────────────

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
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

const NewFolderIcon: React.FC = () => (
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

// ── Helpers ──────────────────────────────────────────────

const PATH_SEPARATOR = /[\\/]/;

const getPathSeparator = (path: string): string =>
  path.includes("\\") ? "\\" : "/";

const getPathSegments = (
  currentPath: string,
  rootPath: string,
): { name: string; path: string }[] => {
  if (!currentPath || !rootPath || currentPath === rootPath) {
    return [];
  }

  const relativePart = currentPath
    .slice(rootPath.length)
    .replace(/^[\\/]/, "");
  if (!relativePart) {
    return [];
  }

  const parts = relativePart.split(PATH_SEPARATOR);
  const segments: { name: string; path: string }[] = [];
  let accumulated = rootPath;
  const sep = getPathSeparator(rootPath);

  for (const part of parts) {
    if (part) {
      accumulated = accumulated + sep + part;
      segments.push({ name: part, path: accumulated });
    }
  }

  return segments;
};

// ── Props ────────────────────────────────────────────────

interface SaveToFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filePath: string) => void;
  content: string;
}

// ── Component ────────────────────────────────────────────

export const SaveToFolderDialog: React.FC<SaveToFolderDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  content,
}) => {
  const rootPath = useAtomValue(currentPathAtom);

  const [browsePath, setBrowsePath] = useState<string>("");
  const [folders, setFolders] = useState<DirEntry[]>([]);
  const [fileName, setFileName] = useState<string>("Untitled.excalidraw");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New folder inline creation
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);

  // ── Initialize browse path from root ────────────────

  useEffect(() => {
    if (isOpen && rootPath) {
      setBrowsePath(rootPath);
      setFileName("Untitled.excalidraw");
      setError(null);
      setIsCreatingFolder(false);
      setNewFolderName("");
    }
  }, [isOpen, rootPath]);

  // ── Focus filename input on open ────────────────────

  useEffect(() => {
    if (isOpen && fileNameInputRef.current) {
      // Small delay so the dialog is fully rendered
      const timer = setTimeout(() => {
        if (fileNameInputRef.current) {
          fileNameInputRef.current.focus();
          // Select the name part without extension
          const dotIndex = fileNameInputRef.current.value.lastIndexOf(".");
          if (dotIndex > 0) {
            fileNameInputRef.current.setSelectionRange(0, dotIndex);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ── Fetch directory listing (folders only) ──────────

  const fetchFolders = useCallback(async (dirPath: string) => {
    const electronAPI = getElectronAPI();
    if (!electronAPI || !dirPath) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const entries = await electronAPI.dir.list(dirPath);
      const dirEntries = entries
        .filter((e) => e.isDirectory)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
      setFolders(dirEntries);
    } catch (err) {
      console.error("Failed to list directories:", err);
      setError(
        err instanceof Error ? err.message : "Failed to list directories.",
      );
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && browsePath) {
      fetchFolders(browsePath);
    }
  }, [isOpen, browsePath, fetchFolders]);

  // ── Focus new folder input ──────────────────────────

  useEffect(() => {
    if (isCreatingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

  // ── Navigate into a folder ──────────────────────────

  const handleNavigate = useCallback((path: string) => {
    setBrowsePath(path);
    setIsCreatingFolder(false);
    setNewFolderName("");
  }, []);

  // ── Breadcrumb segments ─────────────────────────────

  const breadcrumbSegments = getPathSegments(browsePath, rootPath);

  // ── Create new folder ───────────────────────────────

  const handleCreateFolder = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI || !browsePath) {
      return;
    }

    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const result = await electronAPI.dir.create(browsePath, trimmedName);
      setIsCreatingFolder(false);
      setNewFolderName("");
      // Navigate into the new folder
      setBrowsePath(result.path);
    } catch (err) {
      console.error("Failed to create folder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create folder.",
      );
    }
  }, [browsePath, newFolderName]);

  const handleNewFolderKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleCreateFolder();
      } else if (e.key === "Escape") {
        setIsCreatingFolder(false);
        setNewFolderName("");
      }
    },
    [handleCreateFolder],
  );

  // ── Save file ───────────────────────────────────────

  const handleSave = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI || !browsePath) {
      return;
    }

    const trimmedName = fileName.trim();
    if (!trimmedName) {
      setError("Please enter a file name.");
      return;
    }

    // Ensure .excalidraw extension
    const finalName = trimmedName.endsWith(".excalidraw")
      ? trimmedName
      : `${trimmedName}.excalidraw`;

    const sep = getPathSeparator(browsePath);
    const fullPath = browsePath + sep + finalName;

    setIsSaving(true);
    setError(null);

    try {
      await electronAPI.file.writeContent(fullPath, content);
      onSave(fullPath);
    } catch (err) {
      console.error("Failed to save file:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save file.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [browsePath, fileName, content, onSave]);

  // ── Handle filename input keydown ───────────────────

  const handleFileNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSave, onClose],
  );

  // ── Handle overlay click ────────────────────────────

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // ── Render ──────────────────────────────────────────

  if (!isOpen) {
    return null;
  }

  return (
    <div className="SaveToFolderDialog__overlay" onClick={handleOverlayClick}>
      <div
        className="SaveToFolderDialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h3 className="SaveToFolderDialog__title">Save Drawing</h3>

        {/* Breadcrumb navigation */}
        <div className="SaveToFolderDialog__breadcrumbs">
          <button
            className={`SaveToFolderDialog__breadcrumb${
              breadcrumbSegments.length === 0
                ? " SaveToFolderDialog__breadcrumb--active"
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
              <span className="SaveToFolderDialog__breadcrumb-separator">
                /
              </span>
              <button
                className={`SaveToFolderDialog__breadcrumb${
                  index === breadcrumbSegments.length - 1
                    ? " SaveToFolderDialog__breadcrumb--active"
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

        {/* Folder list */}
        <div className="SaveToFolderDialog__folder-list">
          {isLoading ? (
            <div className="SaveToFolderDialog__loading">Loading...</div>
          ) : folders.length === 0 && !isCreatingFolder ? (
            <div className="SaveToFolderDialog__empty">
              No subfolders in this directory
            </div>
          ) : (
            <>
              {folders.map((folder) => (
                <button
                  key={folder.path}
                  className="SaveToFolderDialog__folder-item"
                  onClick={() => handleNavigate(folder.path)}
                  type="button"
                  title={folder.name}
                >
                  <FolderIcon className="SaveToFolderDialog__folder-icon" />
                  <span className="SaveToFolderDialog__folder-name">
                    {folder.name}
                  </span>
                </button>
              ))}

              {/* Inline new folder creation */}
              {isCreatingFolder && (
                <div className="SaveToFolderDialog__new-folder-row">
                  <FolderIcon className="SaveToFolderDialog__folder-icon" />
                  <input
                    ref={newFolderInputRef}
                    className="SaveToFolderDialog__new-folder-input"
                    type="text"
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={handleNewFolderKeyDown}
                    onBlur={() => {
                      if (!newFolderName.trim()) {
                        setIsCreatingFolder(false);
                        setNewFolderName("");
                      }
                    }}
                  />
                  <button
                    className="SaveToFolderDialog__new-folder-confirm"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    type="button"
                    title="Create folder"
                  >
                    Create
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* New folder button */}
        <button
          className="SaveToFolderDialog__new-folder-btn"
          onClick={() => {
            setIsCreatingFolder(true);
            setNewFolderName("");
          }}
          type="button"
          disabled={isCreatingFolder}
        >
          <NewFolderIcon />
          New Folder
        </button>

        {/* File name input */}
        <div className="SaveToFolderDialog__filename-section">
          <label
            className="SaveToFolderDialog__label"
            htmlFor="save-dialog-filename"
          >
            File name
          </label>
          <input
            ref={fileNameInputRef}
            id="save-dialog-filename"
            className="SaveToFolderDialog__filename-input"
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={handleFileNameKeyDown}
            placeholder="Untitled.excalidraw"
          />
        </div>

        {/* Error display */}
        {error && <p className="SaveToFolderDialog__error">{error}</p>}

        {/* Action buttons */}
        <div className="SaveToFolderDialog__actions">
          <button
            className="SaveToFolderDialog__btn SaveToFolderDialog__btn--secondary"
            onClick={onClose}
            type="button"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="SaveToFolderDialog__btn SaveToFolderDialog__btn--primary"
            onClick={handleSave}
            type="button"
            disabled={isSaving || !fileName.trim()}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveToFolderDialog;
