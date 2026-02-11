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
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
