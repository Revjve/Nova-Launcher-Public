# Nova Launcher

Nova Launcher is a Windows-first Minecraft launcher by Nova Studios. Designed to replace your default minecraft launcher or other launchers like feather or prism launcher

## Features

### Working

- Electron + React + TypeScript + Vite desktop app scaffold
- vanilla instances working
- Fabric instances Working
- forge instances
- neoforge instances
- microsoft acount integration
- offline acounts
- download mods from modrinth
- discord presence
- many themes and colors
- custom theme files

### Broken (Fix before anything)
- NOTHINGG LETS GOOO

## Things To do

- add better customizability for themes
- Nova Acounts to save microsoft acounts and Admin acounts.
- friends system
  - text chat
  - voice chat
- built in Nova Mod to add friends system into it
  - chat
  - invites
  - in game voice chat
  - calls
- Import Modrinth .mrpack
- Add screenshot viewer and server list tools
- Build out crash analysis and common-error detection
- Add richer resource pack and shader pack browsing







## How to Build

### Install Dependencies

```bash
npm install
```

### Run In Dev Mode

```bash
npm run dev
```

This starts the Vite-powered Electron development flow.

### Build The App

```bash
npm run build
```

This compiles the renderer and Electron process code.

### Build The Windows Package

```bash
npm run build:win
```

This runs the build and then packages the desktop app with `electron-builder`
