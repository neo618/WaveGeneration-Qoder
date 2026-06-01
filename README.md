# 多通道波形CSV生成工具

**Multi-Channel Waveform CSV Generator** — An Electron desktop application for generating multi-channel waveform data and exporting as CSV files.

## Features

- **4 Waveform Types**: Sine, Square, Triangle, and Uniform Random
- **Multi-Channel**: Up to 10 independently configurable channels, each with its own waveform type and parameters
- **Global Parameters**: Configurable time interval (ms), data length (points), and channel count
- **Real-Time Preview**: Canvas-based waveform preview with grid, axis labels, and zoom
- **Zoom Controls**: Mouse wheel zoom (centered at cursor), +/-/R toolbar buttons, zoom level badge
- **Channel Visibility**: Toggle individual channels on/off via checkbox or clickable legend — hidden channels are still included in CSV export
- **CSV Export**: Exports to `D:\data\YYYYMMDD_HHMMSS\` with UTF-8 BOM for Excel compatibility
- **Preset Management**: Save/load full configuration presets (persisted in Electron `userData`)
- **Internationalization**: Chinese (default) / English language toggle in the header
- **Dark Theme**: Cyan-accented military/industrial dark UI

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 33.4.11 |
| UI | Native HTML5 / CSS3 / Vanilla JavaScript |
| Canvas | Canvas 2D API with manual grid/curve rendering |
| IPC | `contextBridge` + `ipcMain.handle` (secure isolation) |
| Data | Float64Array for wave generation, UTF-8 BOM CSV |
| Storage | Node.js `fs` module for CSV, `app.getPath('userData')` for presets |

## File Structure

```
├── main.js            # Electron main process — window, IPC handlers
├── preload.js         # Context bridge — exposes waveAPI to renderer
├── index.html         # UI layout — panels, controls, canvas, i18n attributes
├── renderer.js        # Core logic — wave generation, canvas, zoom, i18n, CSV
├── styles.css         # Cyan-accented dark theme (CSS custom properties)
├── package.json       # Project config, Electron dependency
├── package-lock.json  # Lockfile
└── 需求.md            # Original requirements (Chinese)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 16
- npm >= 8

### Install & Run

```bash
# Clone the repository
git clone https://github.com/neo618/WaveGeneration-Qoder.git
cd WaveGeneration-Qoder

# Install dependencies
npm install

# Launch the application
npm start
```

## Usage

1. **Set Global Parameters** — Configure time interval (ms), data length (points), and number of channels (1–10) in the left panel.

2. **Configure Channels** — For each channel, select a waveform type (正弦波/方波/三角波/均匀随机数) and set type-specific parameters:
   - Sine/Square/Triangle: Amplitude, Frequency (kHz), DC Offset, Initial Phase (rad)
   - Random: Min, Max

3. **Preview Waveforms** — The right panel shows a real-time canvas preview:
   - Scroll to zoom in/out (centered at cursor)
   - Use +/-/R buttons in the toolbar
   - Toggle channel visibility via checkboxes or clickable legend items

4. **Save/Load Presets** — Save your configuration with a name, then load it later from the dropdown.

5. **Generate CSV** — Click the **生 成** (Generate) button to export all channels to a timestamped CSV file at `D:\data\`.

### CSV Output Format

```csv
时间(ms),V1,V2,...
0.00,10.00,-1.00,...
2.00,10.00,-1.00,...
4.00,5.88,-1.00,...
...
```

The first column is the time in milliseconds. Each subsequent column (V1, V2, ...) corresponds to a channel.

### Language Switching

Click the **EN** / **中文** button in the top-left header to toggle between Chinese and English UI.

## Waveform Parameters

### Per-Wave-Type Defaults

| Type | Amplitude | Frequency | DC Offset | Phase |
|---|---|---|---|---|
| Sine | 10.0 | 0.05 kHz | 0.0 | 0.0 rad |
| Square | 1.0 | 0.05 kHz | 0.0 | 0.0 rad |
| Triangle | 1.0 | 0.05 kHz | 0.0 | 0.0 rad |
| Random | — | — | — | — |

> **Note**: Default frequency is 50 Hz to avoid aliasing with the 2 ms default time interval (Nyquist limit = 250 Hz at 2 ms sampling).

## License

ISC

---

Generated with [Qoder](https://qoder.com)
