export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

export interface FolderMeta {
  color?: string;
  sortOrder?: "name" | "date" | "custom";
  customOrder?: string[];
}

export interface ElectronAPI {
  isElectron: () => Promise<boolean>;
  getVersion: () => Promise<string>;

  file: {
    open: () => Promise<{
      content: string;
      path: string;
      name: string;
    } | null>;
    save: (content: string) => Promise<{
      success: boolean;
      path: string;
    } | null>;
    saveAs: (content: string) => Promise<{
      success: boolean;
      path: string;
    } | null>;
    export: (content: string, type: string) => Promise<string | null>;
    onOpened: (
      callback: (data: { content: string; path: string; name: string }) => void,
    ) => void;
    setModified: (modified: boolean) => void;
    readContent: (filePath: string) => Promise<string>;
    writeContent: (filePath: string, content: string) => Promise<void>;
    delete: (filePath: string) => Promise<void>;
    rename: (oldPath: string, newName: string) => Promise<{ path: string }>;
    stat: (filePath: string) => Promise<{ size: number; mtime: number }>;
  };

  fs: {
    fileOpen: (options: {
      extensions?: string[];
      description?: string;
      multiple?: boolean;
    }) => Promise<{
      data: ArrayBuffer;
      name: string;
      lastModified: number;
      path: string;
    } | {
      data: ArrayBuffer;
      name: string;
      lastModified: number;
      path: string;
    }[] | null>;
    fileSave: (data: ArrayBuffer, options: {
      fileName?: string;
      description?: string;
      extensions?: string[];
      existingHandlePath?: string;
    }) => Promise<{
      name: string;
      kind: string;
      path: string;
    } | null>;
  };

  dir: {
    selectRoot: () => Promise<string | null>;
    list: (dirPath: string) => Promise<DirEntry[]>;
    create: (parentPath: string, name: string) => Promise<{ path: string }>;
    rename: (oldPath: string, newName: string) => Promise<{ path: string }>;
    delete: (dirPath: string) => Promise<void>;
    readMeta: (dirPath: string) => Promise<FolderMeta | null>;
    writeMeta: (dirPath: string, meta: FolderMeta) => Promise<void>;
  };

  config: {
    getRootFolder: () => Promise<string | null>;
    setRootFolder: (path: string) => Promise<void>;
    getScratchCanvas: () => Promise<string | null>;
    setScratchCanvas: (content: string) => Promise<void>;
  };

  menu: {
    onNew: (callback: () => void) => void;
    onOpen: (callback: () => void) => void;
    onSave: (callback: () => void) => void;
    onSaveAs: (callback: () => void) => void;
    onExport: (callback: (type: string) => void) => void;
    onZoomIn: (callback: () => void) => void;
    onZoomOut: (callback: () => void) => void;
    onZoomReset: (callback: () => void) => void;
    onHome: (callback: () => void) => void;
    onPresent: (callback: () => void) => void;
    onExportPdf: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
