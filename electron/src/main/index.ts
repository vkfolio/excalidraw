import { app, BrowserWindow, protocol } from "electron";
import * as path from "path";

import { createWindow, getMainWindow } from "./window";
import { setupFileHandlers, setupDirectoryHandlers, handleFileOpen } from "./fileHandler";
import { createApplicationMenu } from "./menu";
import { setupIPCHandlers } from "./ipc";

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();

      // Handle file opened from second instance
      const filePath = commandLine.find((arg) => arg.endsWith(".excalidraw"));
      if (filePath) {
        handleFileOpen(filePath);
      }
    }
  });

  app.whenReady().then(() => {
    setupIPCHandlers();
    setupFileHandlers();
    setupDirectoryHandlers();

    const mainWindow = createWindow();
    createApplicationMenu(mainWindow);

    // Handle file opened on launch (Windows file association)
    const filePath = process.argv.find((arg) => arg.endsWith(".excalidraw"));
    if (filePath) {
      mainWindow.webContents.once("did-finish-load", () => {
        handleFileOpen(filePath);
      });
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    handleFileOpen(filePath);
  });
}
