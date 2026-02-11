import { useEffect, useState, useCallback, useRef } from "react";

import { isElectron, getElectronAPI } from "./ElectronProvider";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export const useElectronFileOps = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const electronAPI = getElectronAPI();
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const isModifiedRef = useRef(isModified);
  isModifiedRef.current = isModified;

  // Notify main process of modification state
  useEffect(() => {
    if (!isElectron() || !electronAPI) {
      return;
    }
    electronAPI.file.setModified(isModified);
  }, [isModified, electronAPI]);

  // Listen for file opened event (from file association or native menu)
  useEffect(() => {
    if (!isElectron() || !electronAPI || !excalidrawAPI) {
      return;
    }

    electronAPI.file.onOpened((data) => {
      try {
        const parsed = JSON.parse(data.content);
        excalidrawAPI.updateScene({
          elements: parsed.elements || [],
          appState: parsed.appState || {},
        });
        if (parsed.files) {
          excalidrawAPI.addFiles(
            Object.values(parsed.files) as any[],
          );
        }
        setCurrentFilePath(data.path);
        setIsModified(false);
      } catch (error) {
        console.error("Error loading file from association:", error);
      }
    });
  }, [electronAPI, excalidrawAPI]);

  const serializeScene = useCallback(() => {
    if (!excalidrawAPI) {
      return "";
    }

    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();

    return JSON.stringify(
      {
        type: "excalidraw",
        version: 2,
        source: "excalidraw-desktop",
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files,
      },
      null,
      2,
    );
  }, [excalidrawAPI]);

  const handleOpen = useCallback(async () => {
    if (!electronAPI || !excalidrawAPI) {
      return;
    }

    const result = await electronAPI.file.open();
    if (!result) {
      return;
    }

    try {
      const parsed = JSON.parse(result.content);
      excalidrawAPI.updateScene({
        elements: parsed.elements || [],
        appState: parsed.appState || {},
      });
      if (parsed.files) {
        excalidrawAPI.addFiles(
          Object.values(parsed.files) as any[],
        );
      }
      setCurrentFilePath(result.path);
      setIsModified(false);
    } catch (error) {
      console.error("Error loading file:", error);
    }
  }, [electronAPI, excalidrawAPI]);

  const handleSave = useCallback(async () => {
    if (!electronAPI || !excalidrawAPI) {
      return;
    }

    const content = serializeScene();
    const result = await electronAPI.file.save(content);
    if (result?.success) {
      setCurrentFilePath(result.path);
      setIsModified(false);
    }
  }, [electronAPI, excalidrawAPI, serializeScene]);

  const handleSaveAs = useCallback(async () => {
    if (!electronAPI || !excalidrawAPI) {
      return;
    }

    const content = serializeScene();
    const result = await electronAPI.file.saveAs(content);
    if (result?.success) {
      setCurrentFilePath(result.path);
      setIsModified(false);
    }
  }, [electronAPI, excalidrawAPI, serializeScene]);

  const handleNew = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    excalidrawAPI.resetScene();
    setCurrentFilePath(null);
    setIsModified(false);
  }, [excalidrawAPI]);

  return {
    handleOpen,
    handleSave,
    handleSaveAs,
    handleNew,
    currentFilePath,
    isModified,
    setIsModified,
  };
};
