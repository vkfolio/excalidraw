import { ipcMain, app } from "electron";

export function setupIPCHandlers(): void {
  ipcMain.handle("electron:isElectron", () => true);

  ipcMain.handle("electron:getVersion", () => app.getVersion());
}
