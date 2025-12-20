import fs from 'node:fs'
import { extraResolve } from '$electron/helpers/index.js'
import { ensureBinaries } from '$electron/helpers/download-binaries.js'
import which from 'which'

export function getScrcpyPath() {
  const whichPath = which.sync('scrcpy', { nothrow: true }) || void 0

  switch (process.platform) {
    case 'win32':
      return extraResolve('win/scrcpy/scrcpy.exe')

    case 'darwin':
      return extraResolve(`mac-${process.arch}/scrcpy/scrcpy`)

    case 'linux':
      if (['arm64'].includes(process.arch)) {
        return whichPath
      }

      return extraResolve(`linux-${process.arch}/scrcpy/scrcpy`)

    default:
      return whichPath
  }
}

// Ensure binaries are available before returning the path
let scrcpyPathResolved = null

export const getScrcpyPathWithDownload = async () => {
  if (!scrcpyPathResolved) {
    const path = getScrcpyPath()

    // Check if file exists (skip check for system-wide installation)
    if (path && !path.includes('which') && !fs.existsSync(path)) {
      console.log('[WARN] SCRCPY binary not found, downloading...')
      try {
        await ensureBinaries()
      }
      catch (error) {
        console.error('[ERROR] Failed to download binaries:', error)
        throw new Error('SCRCPY binary not found and download failed')
      }
    }

    scrcpyPathResolved = path
  }

  return scrcpyPathResolved
}

export const scrcpyPath = getScrcpyPath()
