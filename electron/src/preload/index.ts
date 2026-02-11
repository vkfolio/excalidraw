import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  isElectron: () => ipcRenderer.invoke("electron:isElectron") as Promise<boolean>,
  getVersion: () => ipcRenderer.invoke("electron:getVersion") as Promise<string>,

  file: {
    open: () =>
      ipcRenderer.invoke("file:open") as Promise<{
        content: string;
        path: string;
        name: string;
      } | null>,
    save: (content: string) =>
      ipcRenderer.invoke("file:save", content) as Promise<{
        success: boolean;
        path: string;
      } | null>,
    saveAs: (content: string) =>
      ipcRenderer.invoke("file:saveAs", content) as Promise<{
        success: boolean;
        path: string;
      } | null>,
    export: (content: string, type: string) =>
      ipcRenderer.invoke("file:export", content, type) as Promise<string | null>,
    onOpened: (
      callback: (data: { content: string; path: string; name: string }) => void,
    ) => {
      ipcRenderer.on("file:opened", (_event, data) => callback(data));
    },
    setModified: (modified: boolean) => {
      ipcRenderer.send("file:modified", modified);
    },
  },

  menu: {
    onNew: (callback: () => void) => {
      ipcRenderer.on("menu:new", () => callback());
    },
    onOpen: (callback: () => void) => {
      ipcRenderer.on("menu:open", () => callback());
    },
    onSave: (callback: () => void) => {
      ipcRenderer.on("menu:save", () => callback());
    },
    onSaveAs: (callback: () => void) => {
      ipcRenderer.on("menu:saveAs", () => callback());
    },
    onExport: (callback: (type: string) => void) => {
      ipcRenderer.on("menu:export", (_event, type) => callback(type));
    },
    onZoomIn: (callback: () => void) => {
      ipcRenderer.on("menu:zoomIn", () => callback());
    },
    onZoomOut: (callback: () => void) => {
      ipcRenderer.on("menu:zoomOut", () => callback());
    },
    onZoomReset: (callback: () => void) => {
      ipcRenderer.on("menu:zoomReset", () => callback());
    },
  },
};

export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld("electron", electronAPI);
