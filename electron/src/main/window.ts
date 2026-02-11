import { app, BrowserWindow } from "electron";
import * as path from "path";
import Store from "electron-store";

const store = new Store();
let mainWindow: BrowserWindow | null = null;

function getRendererPath(): string {
  // In packaged app, extraResources are at process.resourcesPath
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "renderer", "index.electron.html");
  }
  // In dev, load from excalidraw-app/build-electron
  return path.join(__dirname, "../../../excalidraw-app/build-electron/index.electron.html");
}

export function createWindow(): BrowserWindow {
  const bounds = store.get("windowBounds", {
    width: 1280,
    height: 800,
  }) as { width: number; height: number; x?: number; y?: number };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: "Excalidraw",
    icon: path.join(__dirname, "../../resources/icon.ico"),
    backgroundColor: "#121212",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(getRendererPath());

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", () => {
    if (mainWindow) {
      store.set("windowBounds", mainWindow.getBounds());
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setWindowTitle(title: string): void {
  if (mainWindow) {
    mainWindow.setTitle(`${title} - Excalidraw`);
  }
}
