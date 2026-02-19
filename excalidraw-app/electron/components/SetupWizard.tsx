import React, { useState, useCallback } from "react";

import { useSetAtom } from "../../app-jotai";
import { electronViewAtom } from "../../app-jotai";
import { currentPathAtom } from "../atoms";
import { getElectronAPI } from "../ElectronProvider";

import "./SetupWizard.scss";

const FolderIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
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

const ExcalidrawLogo: React.FC = () => (
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="10"
      y="10"
      width="108"
      height="108"
      rx="20"
      fill="#6965db"
      opacity="0.12"
    />
    <path
      d="M64 28L96 96H32L64 28Z"
      fill="none"
      stroke="#6965db"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="64"
      cy="72"
      r="12"
      fill="none"
      stroke="#6965db"
      strokeWidth="6"
    />
  </svg>
);

export const SetupWizard: React.FC = () => {
  const setElectronView = useSetAtom(electronViewAtom);
  const setCurrentPath = useSetAtom(currentPathAtom);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleChooseFolder = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      setError("Electron API is not available.");
      return;
    }

    setIsSelecting(true);
    setError(null);

    try {
      const path = await electronAPI.dir.selectRoot();
      if (path) {
        setSelectedPath(path);
        await electronAPI.config.setRootFolder(path);
        setCurrentPath(path);
        setElectronView("home");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to select folder.",
      );
    } finally {
      setIsSelecting(false);
    }
  }, [setCurrentPath, setElectronView]);

  return (
    <div className="SetupWizard">
      <div className="SetupWizard__card">
        <div className="SetupWizard__logo">
          <ExcalidrawLogo />
        </div>

        <h1 className="SetupWizard__heading">Welcome to Excalidraw Desktop</h1>

        <p className="SetupWizard__description">
          Choose a folder to store your drawings. This will be your workspace
          where all files and folders are organized.
        </p>

        {selectedPath && (
          <p className="SetupWizard__selected-path">{selectedPath}</p>
        )}

        {error && <p className="SetupWizard__error">{error}</p>}

        <button
          className="SetupWizard__button"
          onClick={handleChooseFolder}
          disabled={isSelecting}
          type="button"
        >
          <FolderIcon />
          {isSelecting ? "Selecting..." : "Choose Folder"}
        </button>
      </div>
    </div>
  );
};

export default SetupWizard;
