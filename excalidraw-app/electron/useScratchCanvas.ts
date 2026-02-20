import { useEffect, useRef, useCallback } from "react";

import { useAtomValue } from "../app-jotai";
import { currentFilePathAtom } from "../app-jotai";
import { getElectronAPI } from "./ElectronProvider";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const DEBOUNCE_MS = 2000;

/**
 * Manages scratch canvas persistence for when the user is on the editor view
 * without a specific file open (i.e. currentFilePathAtom is null).
 *
 * On mount, if no file is open, the scratch canvas is loaded from the
 * Electron config store and restored into the Excalidraw instance.
 *
 * While the user works without a file, scene changes are auto-saved
 * (debounced at 2 seconds) to the scratch canvas config.
 *
 * When the user opens a file (currentFilePathAtom transitions from null
 * to a path), the current scratch state is saved before the switch.
 */
export const useScratchCanvas = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const currentFilePath = useAtomValue(currentFilePathAtom);
  const prevFilePathRef = useRef<string | null | undefined>(undefined);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // ── Serialize current scene to JSON ──────────────────

  const serializeScene = useCallback((): string => {
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

  // ── Save scratch canvas to config ────────────────────

  const saveScratch = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI || !excalidrawAPI) {
      return;
    }

    try {
      const content = serializeScene();
      if (content) {
        await electronAPI.config.setScratchCanvas(content);
      }
    } catch (err) {
      console.error("Failed to save scratch canvas:", err);
    }
  }, [excalidrawAPI, serializeScene]);

  // ── Load scratch canvas from config ──────────────────

  const loadScratch = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI || !excalidrawAPI) {
      return;
    }

    try {
      const content = await electronAPI.config.getScratchCanvas();
      if (!content || !isMountedRef.current) {
        return;
      }

      const parsed = JSON.parse(content);
      excalidrawAPI.updateScene({
        elements: parsed.elements || [],
        appState: parsed.appState || {},
      });

      if (parsed.files) {
        excalidrawAPI.addFiles(Object.values(parsed.files) as any[]);
      }
    } catch (err) {
      console.error("Failed to load scratch canvas:", err);
    }
  }, [excalidrawAPI]);

  // ── Clear scratch canvas ─────────────────────────────

  const clearScratch = useCallback(async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      return;
    }

    try {
      await electronAPI.config.setScratchCanvas(
        JSON.stringify(
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
        ),
      );
    } catch (err) {
      console.error("Failed to clear scratch canvas:", err);
    }
  }, []);

  // ── Load scratch on mount when no file is open ───────

  useEffect(() => {
    isMountedRef.current = true;

    if (currentFilePath === null && excalidrawAPI) {
      loadScratch();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [excalidrawAPI]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle file path transitions ─────────────────────
  //    When transitioning from null (scratch) to a file path,
  //    save the scratch state before switching.

  useEffect(() => {
    const prevPath = prevFilePathRef.current;
    prevFilePathRef.current = currentFilePath;

    // Skip the initial render (prevPath is undefined)
    if (prevPath === undefined) {
      return;
    }

    // Transitioning from scratch (null) to a file: save scratch first
    if (prevPath === null && currentFilePath !== null) {
      saveScratch();
    }
  }, [currentFilePath, saveScratch]);

  // ── Debounced auto-save while in scratch mode ────────

  useEffect(() => {
    if (!excalidrawAPI || currentFilePath !== null) {
      return;
    }

    const handleChange = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          saveScratch();
        }
      }, DEBOUNCE_MS);
    };

    // Listen for scene changes via the onChange callback.
    // Excalidraw fires this when elements or appState change.
    const unsubscribe = excalidrawAPI.onChange(handleChange);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [excalidrawAPI, currentFilePath, saveScratch]);

  // ── Save scratch on unmount if in scratch mode ───────

  useEffect(() => {
    return () => {
      if (currentFilePath === null) {
        saveScratch();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { loadScratch, clearScratch };
};
