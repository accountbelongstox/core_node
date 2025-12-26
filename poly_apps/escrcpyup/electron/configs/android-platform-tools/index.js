import fs from 'node:fs'
import { extraResolve } from '$electron/helpers/index.js'
import { ensureBinaries } from '$electron/helpers/download-binaries.js'

export const getAdbPath = () => {
  switch (process.platform) {
    case 'win32':
      return extraResolve('win/scrcpy/adb.exe')

    case 'darwin':
      return extraResolve(`mac-${process.arch}/scrcpy/adb`)

    case 'linux':
      return extraResolve(`linux-${process.arch}/scrcpy/adb`)
  }
}

// Ensure binaries are available before returning the path
let adbPathResolved = null

export const getAdbPathWithDownload = async () => {
  if (!adbPathResolved) {
    const path = getAdbPath()

    // Check if file exists
    if (!fs.existsSync(path)) {
      console.log('[WARN] ADB binary not found, downloading...')
      try {
        await ensureBinaries()
      }
      catch (error) {
        console.error('[ERROR] Failed to download binaries:', error)
        throw new Error('ADB binary not found and download failed')
      }
    }

    adbPathResolved = path
  }

  return adbPathResolved
}

export const adbPath = getAdbPath()
