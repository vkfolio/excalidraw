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
