import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";

export function createAppTray(mainWindow: BrowserWindow): Tray {
  const icon = nativeImage.createEmpty();
  const tray = new Tray(icon);

  tray.setToolTip("A.L.I.L.O.S. Web Action Assistant");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: "Hide",
      click: () => mainWindow.hide()
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.exit(0);
      }
    }
  ]));

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      return;
    }

    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
