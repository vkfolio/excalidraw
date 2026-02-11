import { useEffect } from "react";

import { exportToBlob, exportToSvg } from "@excalidraw/excalidraw";

import { isElectron, getElectronAPI } from "./ElectronProvider";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

export const useElectronMenu = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
  fileOps: {
    handleOpen: () => void;
    handleSave: () => void;
    handleSaveAs: () => void;
    handleNew: () => void;
  },
) => {
  const electronAPI = getElectronAPI();

  useEffect(() => {
    if (!isElectron() || !electronAPI || !excalidrawAPI) {
      return;
    }

    electronAPI.menu.onNew(fileOps.handleNew);
    electronAPI.menu.onOpen(fileOps.handleOpen);
    electronAPI.menu.onSave(fileOps.handleSave);
    electronAPI.menu.onSaveAs(fileOps.handleSaveAs);

    electronAPI.menu.onExport(async (type: string) => {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      if (type === "png") {
        const blob = await exportToBlob({
          elements,
          appState,
          files,
          mimeType: "image/png",
        });
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        electronAPI.file.export(base64, "png");
      } else if (type === "svg") {
        const svg = await exportToSvg({
          elements,
          appState,
          files,
        });
        const svgString = new XMLSerializer().serializeToString(svg);
        electronAPI.file.export(svgString, "svg");
      }
    });

    electronAPI.menu.onZoomIn(() => {
      const zoom = excalidrawAPI.getAppState().zoom;
      excalidrawAPI.updateScene({
        appState: {
          zoom: {
            value: (zoom.value * 1.1) as NormalizedZoomValue,
          },
        },
      });
    });

    electronAPI.menu.onZoomOut(() => {
      const zoom = excalidrawAPI.getAppState().zoom;
      excalidrawAPI.updateScene({
        appState: {
          zoom: {
            value: (zoom.value * 0.9) as NormalizedZoomValue,
          },
        },
      });
    });

    electronAPI.menu.onZoomReset(() => {
      excalidrawAPI.updateScene({
        appState: {
          zoom: { value: 1 as NormalizedZoomValue },
        },
      });
    });
  }, [electronAPI, excalidrawAPI, fileOps]);
};
