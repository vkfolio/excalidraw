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
    readContent: (filePath: string) =>
      ipcRenderer.invoke("file:readContent", filePath) as Promise<string>,
    writeContent: (filePath: string, content: string) =>
      ipcRenderer.invoke("file:writeContent", filePath, content) as Promise<void>,
    delete: (filePath: string) =>
      ipcRenderer.invoke("file:delete", filePath) as Promise<void>,
    rename: (oldPath: string, newName: string) =>
      ipcRenderer.invoke("file:rename", oldPath, newName) as Promise<{ path: string }>,
    stat: (filePath: string) =>
      ipcRenderer.invoke("file:stat", filePath) as Promise<{ size: number; mtime: number }>,
  },

  fs: {
    fileOpen: (options: {
      extensions?: string[];
      description?: string;
      multiple?: boolean;
    }) =>
      ipcRenderer.invoke("fs:fileOpen", options) as Promise<{
        data: ArrayBuffer;
        name: string;
        lastModified: number;
        path: string;
      } | {
        data: ArrayBuffer;
        name: string;
        lastModified: number;
        path: string;
      }[] | null>,
    fileSave: (data: ArrayBuffer, options: {
      fileName?: string;
      description?: string;
      extensions?: string[];
      existingHandlePath?: string;
    }) =>
      ipcRenderer.invoke("fs:fileSave", data, options) as Promise<{
        name: string;
        kind: string;
        path: string;
      } | null>,
  },

  dir: {
    selectRoot: () =>
      ipcRenderer.invoke("dir:selectRoot") as Promise<string | null>,
    list: (dirPath: string) =>
      ipcRenderer.invoke("dir:list", dirPath) as Promise<Array<{
        name: string;
        path: string;
        isDirectory: boolean;
        size: number;
        mtime: number;
      }>>,
    create: (parentPath: string, name: string) =>
      ipcRenderer.invoke("dir:create", parentPath, name) as Promise<{ path: string }>,
    rename: (oldPath: string, newName: string) =>
      ipcRenderer.invoke("dir:rename", oldPath, newName) as Promise<{ path: string }>,
    delete: (dirPath: string) =>
      ipcRenderer.invoke("dir:delete", dirPath) as Promise<void>,
    readMeta: (dirPath: string) =>
      ipcRenderer.invoke("dir:readMeta", dirPath) as Promise<{
        color?: string;
        sortOrder?: string;
        customOrder?: string[];
      } | null>,
    writeMeta: (dirPath: string, meta: object) =>
      ipcRenderer.invoke("dir:writeMeta", dirPath, meta) as Promise<void>,
  },

  config: {
    getRootFolder: () =>
      ipcRenderer.invoke("config:getRootFolder") as Promise<string | null>,
    setRootFolder: (folderPath: string) =>
      ipcRenderer.invoke("config:setRootFolder", folderPath) as Promise<void>,
    getScratchCanvas: () =>
      ipcRenderer.invoke("config:getScratchCanvas") as Promise<string | null>,
    setScratchCanvas: (content: string) =>
      ipcRenderer.invoke("config:setScratchCanvas", content) as Promise<void>,
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
    onHome: (callback: () => void) => {
      ipcRenderer.on("menu:home", () => callback());
    },
    onPresent: (callback: () => void) => {
      ipcRenderer.on("menu:present", () => callback());
    },
    onExportPdf: (callback: () => void) => {
      ipcRenderer.on("menu:exportPdf", () => callback());
    },
  },
};

export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld("electron", electronAPI);
