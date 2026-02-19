/**
 * browser-fs-access shim for Electron.
 *
 * Replaces browser-fs-access with native Electron file dialogs via IPC.
 * This module is aliased in vite.config.electron.mts so all imports of
 * "browser-fs-access" resolve here instead.
 */

type ElectronHandle = {
  name: string;
  kind: "file";
  path: string;
};

// Re-export the FileSystemHandle type that consumers expect
export type FileSystemHandle = ElectronHandle;

// In Electron we always have native dialogs, but we report false here
// so that Excalidraw shows the filename input in the export dialog
// (the native FS API detection controls that UI element).
export const supported = false;

function getElectronFS() {
  return (window as any).electron?.fs;
}

/**
 * fileOpen — mirrors browser-fs-access fileOpen().
 * Opens a native Electron dialog and returns File object(s).
 */
export async function fileOpen(options: {
  description?: string;
  extensions?: string[];
  mimeTypes?: string[];
  multiple?: boolean;
  legacySetup?: any;
}): Promise<any> {
  const fs = getElectronFS();
  if (!fs) {
    throw new Error("Electron fs API not available");
  }

  const result = await fs.fileOpen({
    extensions: options.extensions,
    description: options.description,
    multiple: options.multiple ?? false,
  });

  if (!result) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }

  const toFile = (item: {
    data: ArrayBuffer;
    name: string;
    lastModified: number;
    path: string;
  }) => {
    const file = new File([item.data], item.name, {
      lastModified: item.lastModified,
    });
    // Attach handle for Excalidraw's file tracking (used by loadFromBlob)
    (file as any).handle = {
      name: item.name,
      kind: "file" as const,
      path: item.path,
    };
    return file;
  };

  if (Array.isArray(result)) {
    return result.map(toFile);
  }
  return toFile(result);
}

/**
 * fileSave — mirrors browser-fs-access fileSave().
 * Saves blob data through a native Electron dialog.
 */
export async function fileSave(
  blobOrPromise: Blob | Promise<Blob>,
  options?: {
    fileName?: string;
    description?: string;
    extensions?: string[];
    mimeTypes?: string[];
  },
  existingHandle?: FileSystemHandle | null,
): Promise<FileSystemHandle | null> {
  const fs = getElectronFS();
  if (!fs) {
    throw new Error("Electron fs API not available");
  }

  const blob = await blobOrPromise;
  const arrayBuffer = await blob.arrayBuffer();

  const result = await fs.fileSave(arrayBuffer, {
    fileName: options?.fileName,
    description: options?.description,
    extensions: options?.extensions,
    existingHandlePath: (existingHandle as ElectronHandle)?.path,
  });

  if (!result) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }

  return result as FileSystemHandle;
}
