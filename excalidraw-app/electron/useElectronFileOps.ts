import { useEffect, useState, useCallback, useRef } from "react";

import { useAtom } from "../app-jotai";
import { currentFilePathAtom } from "../app-jotai";
import { isElectron, getElectronAPI } from "./ElectronProvider";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export const useElectronFileOps = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const electronAPI = getElectronAPI();
  const [currentFilePath, setCurrentFilePath] = useAtom(currentFilePathAtom);
  const [isModified, setIsModified] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
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
  }, [electronAPI, excalidrawAPI, setCurrentFilePath]);

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
          canvasGridStyle: appState.canvasGridStyle,
        },
        files,
      },
      null,
      2,
    );
  }, [excalidrawAPI]);

  // Load a file from disk into the editor
  const loadFile = useCallback(
    async (filePath: string) => {
      if (!electronAPI || !excalidrawAPI) {
        return;
      }

      try {
        const content = await electronAPI.file.readContent(filePath);
        const parsed = JSON.parse(content);
        excalidrawAPI.updateScene({
          elements: parsed.elements || [],
          appState: parsed.appState || {},
        });
        if (parsed.files) {
          excalidrawAPI.addFiles(
            Object.values(parsed.files) as any[],
          );
        }
        setCurrentFilePath(filePath);
        setIsModified(false);
      } catch (error) {
        console.error("Error loading file:", error);
      }
    },
    [electronAPI, excalidrawAPI, setCurrentFilePath],
  );

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
  }, [electronAPI, excalidrawAPI, setCurrentFilePath]);

  // Save: if we have a current file path, save directly; otherwise show dialog
  const handleSave = useCallback(async () => {
    if (!electronAPI || !excalidrawAPI) {
      return;
    }

    if (currentFilePath) {
      // Save directly to the current file
      const content = serializeScene();
      try {
        await electronAPI.file.writeContent(currentFilePath, content);
        setIsModified(false);
      } catch (error) {
        console.error("Error saving file:", error);
        // Fall back to save dialog
        const result = await electronAPI.file.save(content);
        if (result?.success) {
          setCurrentFilePath(result.path);
          setIsModified(false);
        }
      }
    } else {
      // No current file - show save to folder dialog
      setShowSaveDialog(true);
    }
  }, [electronAPI, excalidrawAPI, currentFilePath, serializeScene, setCurrentFilePath]);

  const handleSaveAs = useCallback(async () => {
    if (!electronAPI || !excalidrawAPI) {
      return;
    }

    // Always show save dialog for Save As
    setShowSaveDialog(true);
  }, [electronAPI, excalidrawAPI]);

  // Called when the user picks a file path from SaveToFolderDialog
  const handleSaveToPath = useCallback(
    async (filePath: string) => {
      if (!electronAPI || !excalidrawAPI) {
        return;
      }

      const content = serializeScene();
      try {
        await electronAPI.file.writeContent(filePath, content);
        setCurrentFilePath(filePath);
        setIsModified(false);
        setShowSaveDialog(false);
      } catch (error) {
        console.error("Error saving file:", error);
      }
    },
    [electronAPI, excalidrawAPI, serializeScene, setCurrentFilePath],
  );

  const handleNew = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    excalidrawAPI.resetScene();
    setCurrentFilePath(null);
    setIsModified(false);
  }, [excalidrawAPI, setCurrentFilePath]);

  return {
    handleOpen,
    handleSave,
    handleSaveAs,
    handleSaveToPath,
    handleNew,
    loadFile,
    currentFilePath,
    isModified,
    setIsModified,
    showSaveDialog,
    setShowSaveDialog,
    serializeScene,
  };
};
