const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 1200,
    minHeight: 700,
    title: '多通道波形CSV生成工具',
    backgroundColor: '#1a1d23',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// CSV generation handler
ipcMain.handle('generate-csv', (event, data) => {
  try {
    const rootDir = 'D:\\data';
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const folderName = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const subDir = path.join(rootDir, folderName);
    fs.mkdirSync(subDir, { recursive: true });

    const filePath = path.join(subDir, `${folderName}.csv`);

    // Add BOM for UTF-8 compatibility with Excel
    const BOM = '\uFEFF';
    fs.writeFileSync(filePath, BOM + data, 'utf8');

    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Preset save handler
ipcMain.handle('save-preset', (event, presetData) => {
  try {
    const presetDir = path.join(app.getPath('userData'), 'presets');
    if (!fs.existsSync(presetDir)) {
      fs.mkdirSync(presetDir, { recursive: true });
    }

    const presetListPath = path.join(presetDir, 'preset-list.json');
    let presets = [];
    if (fs.existsSync(presetListPath)) {
      presets = JSON.parse(fs.readFileSync(presetListPath, 'utf8'));
    }

    const existingIdx = presets.findIndex(p => p.name === presetData.name);
    if (existingIdx >= 0) {
      presets[existingIdx] = presetData;
    } else {
      presets.push(presetData);
    }

    fs.writeFileSync(presetListPath, JSON.stringify(presets, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Preset load handler
ipcMain.handle('load-presets', () => {
  try {
    const presetDir = path.join(app.getPath('userData'), 'presets');
    const presetListPath = path.join(presetDir, 'preset-list.json');
    if (!fs.existsSync(presetListPath)) {
      return { success: true, presets: [] };
    }
    const presets = JSON.parse(fs.readFileSync(presetListPath, 'utf8'));
    return { success: true, presets };
  } catch (err) {
    return { success: false, error: err.message, presets: [] };
  }
});
