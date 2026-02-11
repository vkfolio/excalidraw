import { Menu, BrowserWindow, shell, app } from "electron";

export function createApplicationMenu(mainWindow: BrowserWindow): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow.webContents.send("menu:new"),
        },
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow.webContents.send("menu:open"),
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow.webContents.send("menu:save"),
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow.webContents.send("menu:saveAs"),
        },
        { type: "separator" },
        {
          label: "Export",
          submenu: [
            {
              label: "Export as PNG...",
              click: () => mainWindow.webContents.send("menu:export", "png"),
            },
            {
              label: "Export as SVG...",
              click: () => mainWindow.webContents.send("menu:export", "svg"),
            },
          ],
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+=",
          click: () => mainWindow.webContents.send("menu:zoomIn"),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => mainWindow.webContents.send("menu:zoomOut"),
        },
        {
          label: "Reset Zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => mainWindow.webContents.send("menu:zoomReset"),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => shell.openExternal("https://docs.excalidraw.com"),
        },
        {
          label: "GitHub",
          click: () =>
            shell.openExternal("https://github.com/excalidraw/excalidraw"),
        },
        { type: "separator" },
        {
          label: `About Excalidraw v${app.getVersion()}`,
          click: () => mainWindow.webContents.send("menu:about"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
