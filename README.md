## Researcher (React + Electron)

Scientific text editor built with React, Vite, and Electron, packaged via electron-builder.

### Prerequisites
- **Node.js**: 18+ (20 LTS recommended)
- **npm**: 9+

### Project structure
- App sources live in `researcher_react_electron/`
- Electron entry: `researcher_react_electron/electron/main.js`
- Renderer (Vite) entry: `researcher_react_electron/src/main.tsx`

### Install
```bash
cd researcher_react_electron
npm install
```

### Run (development)
Starts Vite + Electron with hot reload.
```bash
npm run dev
```

### Build (production)
Builds the renderer and packages the app for the current OS using electron-builder.
Artifacts are created in `researcher_react_electron/dist/`.
```bash
npm run build
```

### Run packaged app locally
After a successful build, you can run the app directly:
```bash
npm start
```

### File associations
The app registers the `.rsrch` extension (Researcher Document) on Windows, macOS, and Linux.

### GitHub Actions release workflow
Releases are automatically built and published when you push a tag named:
- `alpha-x.x`
- `beta-x.x`
- `release-x.x`

where `x.x` is the version.

Create and push a tag like this:
```bash
git tag alpha-0.1
git push origin alpha-0.1
```

The CI will build on Windows, macOS, and Linux and publish the installers to the GitHub Release for that tag.

### Useful scripts
- `npm run dev`: Start Vite and Electron in development
- `npm run build:renderer`: Build the Vite renderer only
- `npm run build`: Build renderer and package app
- `npm start`: Run Electron pointing at the built app

### License
MIT


