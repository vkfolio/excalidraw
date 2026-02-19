import { dialog, ipcMain, BrowserWindow } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import Store from "electron-store";
import { setWindowTitle, getMainWindow } from "./window";

const store = new Store();
let currentFilePath: string | null = null;
let isModified = false;

export function setupFileHandlers(): void {
  ipcMain.handle("file:open", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open Excalidraw Drawing",
      filters: [
        { name: "Excalidraw Files", extensions: ["excalidraw"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return loadFile(result.filePaths[0]);
  });

  ipcMain.handle("file:save", async (_event, content: string) => {
    if (currentFilePath) {
      return saveFile(currentFilePath, content);
    }
    return saveAsFile(content);
  });

  ipcMain.handle("file:saveAs", async (_event, content: string) => {
    return saveAsFile(content);
  });

  ipcMain.handle(
    "file:export",
    async (_event, content: Buffer | string, type: string) => {
      const filters = getExportFilters(type);
      const result = await dialog.showSaveDialog({
        title: "Export Drawing",
        filters,
        defaultPath: getDefaultExportName(type),
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      if (type === "png") {
        // content is base64 string for binary exports
        await fs.writeFile(result.filePath, Buffer.from(content as string, "base64"));
      } else {
        await fs.writeFile(result.filePath, content as string, "utf-8");
      }
      return result.filePath;
    },
  );

  ipcMain.on("file:modified", (_event, modified: boolean) => {
    isModified = modified;
    updateWindowTitle();
  });

  // Generic file open/save handlers used by the browser-fs-access shim
  ipcMain.handle(
    "fs:fileOpen",
    async (
      _event,
      options: {
        extensions?: string[];
        description?: string;
        multiple?: boolean;
      },
    ) => {
      const filters: { name: string; extensions: string[] }[] = [];
      if (options.extensions?.length) {
        filters.push({
          name: options.description || "Files",
          extensions: options.extensions.map((ext) => ext.replace(/^\./, "")),
        });
      }
      filters.push({ name: "All Files", extensions: ["*"] });

      const result = await dialog.showOpenDialog({
        title: options.description || "Open File",
        filters,
        properties: options.multiple
          ? ["openFile", "multiSelections"]
          : ["openFile"],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const files = await Promise.all(
        result.filePaths.map(async (fp) => {
          const buffer = await fs.readFile(fp);
          const stat = await fs.stat(fp);
          return {
            data: buffer.buffer,
            name: path.basename(fp),
            lastModified: stat.mtimeMs,
            path: fp,
          };
        }),
      );

      // Update current file if opening .excalidraw
      if (
        files.length === 1 &&
        files[0].name.endsWith(".excalidraw")
      ) {
        currentFilePath = result.filePaths[0];
        isModified = false;
        const fileName = path.basename(result.filePaths[0], ".excalidraw");
        setWindowTitle(fileName);
        addToRecentFiles(result.filePaths[0]);
      }

      return options.multiple ? files : files[0];
    },
  );

  ipcMain.handle(
    "fs:fileSave",
    async (
      _event,
      data: ArrayBuffer,
      options: {
        fileName?: string;
        description?: string;
        extensions?: string[];
        existingHandlePath?: string;
      },
    ) => {
      let filePath: string;

      if (options.existingHandlePath) {
        filePath = options.existingHandlePath;
      } else {
        const filters: { name: string; extensions: string[] }[] = [];
        if (options.extensions?.length) {
          filters.push({
            name: options.description || "Files",
            extensions: options.extensions.map((ext) => ext.replace(/^\./, "")),
          });
        }

        const result = await dialog.showSaveDialog({
          title: options.description || "Save File",
          filters,
          defaultPath: options.fileName,
        });

        if (result.canceled || !result.filePath) {
          return null;
        }

        filePath = result.filePath;
      }

      await fs.writeFile(filePath, Buffer.from(data));

      // Track as current file if saving .excalidraw
      if (filePath.endsWith(".excalidraw")) {
        currentFilePath = filePath;
        isModified = false;
        const fileName = path.basename(filePath, ".excalidraw");
        setWindowTitle(fileName);
        addToRecentFiles(filePath);
      }

      return { name: path.basename(filePath), kind: "file", path: filePath };
    },
  );
}

export function setupDirectoryHandlers(): void {
  const META_FILE = ".excalidraw-meta.json";

  function getRootFolder(): string | null {
    return store.get("rootFolder", null) as string | null;
  }

  function isPathWithinRoot(targetPath: string): boolean {
    const root = getRootFolder();
    if (!root) {
      return false;
    }
    const resolved = path.resolve(targetPath);
    const resolvedRoot = path.resolve(root);
    return resolved.startsWith(resolvedRoot);
  }

  // Config handlers
  ipcMain.handle("config:getRootFolder", () => {
    return getRootFolder();
  });

  ipcMain.handle("config:setRootFolder", (_event, folderPath: string) => {
    store.set("rootFolder", folderPath);
  });

  ipcMain.handle("config:getScratchCanvas", () => {
    return store.get("scratchCanvas", null) as string | null;
  });

  ipcMain.handle("config:setScratchCanvas", (_event, content: string) => {
    store.set("scratchCanvas", content);
  });

  // Directory handlers
  ipcMain.handle("dir:selectRoot", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Root Folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("dir:list", async (_event, dirPath: string) => {
    if (!isPathWithinRoot(dirPath)) {
      throw new Error("Path outside root folder");
    }
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results = await Promise.all(
      entries
        .filter((entry) => {
          // Hide hidden files and meta files
          if (entry.name.startsWith(".")) {
            return false;
          }
          // Show directories and .excalidraw files
          return (
            entry.isDirectory() || entry.name.endsWith(".excalidraw")
          );
        })
        .map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          const stat = await fs.stat(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: stat.size,
            mtime: stat.mtimeMs,
          };
        }),
    );
    return results;
  });

  ipcMain.handle(
    "dir:create",
    async (_event, parentPath: string, name: string) => {
      if (!isPathWithinRoot(parentPath)) {
        throw new Error("Path outside root folder");
      }
      const dirPath = path.join(parentPath, name);
      await fs.mkdir(dirPath, { recursive: true });
      return { path: dirPath };
    },
  );

  ipcMain.handle(
    "dir:rename",
    async (_event, oldPath: string, newName: string) => {
      if (!isPathWithinRoot(oldPath)) {
        throw new Error("Path outside root folder");
      }
      const newPath = path.join(path.dirname(oldPath), newName);
      await fs.rename(oldPath, newPath);
      return { path: newPath };
    },
  );

  ipcMain.handle("dir:delete", async (_event, dirPath: string) => {
    if (!isPathWithinRoot(dirPath)) {
      throw new Error("Path outside root folder");
    }
    const mainWindow = getMainWindow();
    if (mainWindow) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: "warning",
        buttons: ["Delete", "Cancel"],
        defaultId: 1,
        title: "Confirm Delete",
        message: `Are you sure you want to delete "${path.basename(dirPath)}"?`,
        detail: "This action cannot be undone.",
      });
      if (result.response !== 0) {
        return;
      }
    }
    await fs.rm(dirPath, { recursive: true, force: true });
  });

  ipcMain.handle("dir:readMeta", async (_event, dirPath: string) => {
    try {
      const metaPath = path.join(dirPath, META_FILE);
      const content = await fs.readFile(metaPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    "dir:writeMeta",
    async (_event, dirPath: string, meta: object) => {
      const metaPath = path.join(dirPath, META_FILE);
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    },
  );

  // Additional file handlers
  ipcMain.handle("file:readContent", async (_event, filePath: string) => {
    if (!isPathWithinRoot(filePath)) {
      throw new Error("Path outside root folder");
    }
    return fs.readFile(filePath, "utf-8");
  });

  ipcMain.handle(
    "file:writeContent",
    async (_event, filePath: string, content: string) => {
      if (!isPathWithinRoot(filePath)) {
        throw new Error("Path outside root folder");
      }
      await fs.writeFile(filePath, content, "utf-8");
    },
  );

  ipcMain.handle("file:delete", async (_event, filePath: string) => {
    if (!isPathWithinRoot(filePath)) {
      throw new Error("Path outside root folder");
    }
    const mainWindow = getMainWindow();
    if (mainWindow) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: "warning",
        buttons: ["Delete", "Cancel"],
        defaultId: 1,
        title: "Confirm Delete",
        message: `Delete "${path.basename(filePath)}"?`,
      });
      if (result.response !== 0) {
        return;
      }
    }
    await fs.unlink(filePath);
  });

  ipcMain.handle(
    "file:rename",
    async (_event, oldPath: string, newName: string) => {
      if (!isPathWithinRoot(oldPath)) {
        throw new Error("Path outside root folder");
      }
      const newPath = path.join(path.dirname(oldPath), newName);
      await fs.rename(oldPath, newPath);
      if (currentFilePath === oldPath) {
        currentFilePath = newPath;
        updateWindowTitle();
      }
      return { path: newPath };
    },
  );

  ipcMain.handle("file:stat", async (_event, filePath: string) => {
    const stat = await fs.stat(filePath);
    return { size: stat.size, mtime: stat.mtimeMs };
  });
}

export async function handleFileOpen(filePath: string): Promise<void> {
  const fileData = await loadFile(filePath);
  const mainWindow = getMainWindow();
  if (mainWindow && fileData) {
    mainWindow.webContents.send("file:opened", fileData);
  }
}

async function loadFile(
  filePath: string,
): Promise<{ content: string; path: string; name: string } | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    currentFilePath = filePath;
    isModified = false;

    const fileName = path.basename(filePath, ".excalidraw");
    setWindowTitle(fileName);
    addToRecentFiles(filePath);

    return { content, path: filePath, name: fileName };
  } catch (error: any) {
    dialog.showErrorBox(
      "Error Opening File",
      `Could not open file: ${error.message}`,
    );
    return null;
  }
}

async function saveFile(
  filePath: string,
  content: string,
): Promise<{ success: boolean; path: string }> {
  try {
    await fs.writeFile(filePath, content, "utf-8");
    isModified = false;
    updateWindowTitle();
    addToRecentFiles(filePath);
    return { success: true, path: filePath };
  } catch (error: any) {
    dialog.showErrorBox(
      "Error Saving File",
      `Could not save file: ${error.message}`,
    );
    return { success: false, path: filePath };
  }
}

async function saveAsFile(
  content: string,
): Promise<{ success: boolean; path: string } | null> {
  const result = await dialog.showSaveDialog({
    title: "Save Drawing As",
    filters: [{ name: "Excalidraw Files", extensions: ["excalidraw"] }],
    defaultPath: "drawing.excalidraw",
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  currentFilePath = result.filePath;
  return saveFile(result.filePath, content);
}

function updateWindowTitle(): void {
  if (currentFilePath) {
    const fileName = path.basename(currentFilePath, ".excalidraw");
    setWindowTitle(`${isModified ? "\u2022 " : ""}${fileName}`);
  } else {
    setWindowTitle(`${isModified ? "\u2022 " : ""}Untitled`);
  }
}

function addToRecentFiles(filePath: string): void {
  const recent = (store.get("recentFiles", []) as string[]).filter(
    (p) => p !== filePath,
  );
  recent.unshift(filePath);
  store.set("recentFiles", recent.slice(0, 10));
}

function getExportFilters(
  type: string,
): { name: string; extensions: string[] }[] {
  switch (type) {
    case "png":
      return [{ name: "PNG Image", extensions: ["png"] }];
    case "svg":
      return [{ name: "SVG Image", extensions: ["svg"] }];
    default:
      return [{ name: "All Files", extensions: ["*"] }];
  }
}

function getDefaultExportName(type: string): string {
  const name = currentFilePath
    ? path.basename(currentFilePath, ".excalidraw")
    : "drawing";
  return `${name}.${type}`;
}

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}
