import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { extraResolve } from './index.js'

const streamPipeline = promisify(pipeline)
const execPromise = promisify(exec)

/**
 * Download binary files for ADB and SCRCPY
 */

// Download URLs
const SCRCPY_RELEASES_URL = 'https://api.github.com/repos/Genymobile/scrcpy/releases/latest'
const ADB_WINDOWS_URL = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip'
const ADB_MAC_URL = 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip'
const ADB_LINUX_URL = 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip'

/**
 * Detect current platform
 * @returns {string} Platform identifier (win, mac-x64, mac-arm64, linux-x64, linux-arm64)
 */
function detectPlatform() {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'win32') {
    return 'win'
  }
  else if (platform === 'darwin') {
    return arch === 'arm64' ? 'mac-arm64' : 'mac-x64'
  }
  else if (platform === 'linux') {
    return arch === 'arm64' || arch === 'aarch64' ? 'linux-arm64' : 'linux-x64'
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}`)
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}

/**
 * Download file from URL with progress bar
 * @param {string} url - Download URL
 * @param {string} dest - Destination file path
 * @returns {Promise<void>}
 */
async function downloadFile(url, dest) {
  console.log(`[INFO] Downloading from: ${url}`)
  console.log(`[INFO] Saving to: ${dest}`)

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http

    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        console.log(`[INFO] Redirecting to: ${redirectUrl}`)
        downloadFile(redirectUrl, dest).then(resolve).catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`))
        return
      }

      const fileStream = createWriteStream(dest)
      const totalBytes = Number.parseInt(response.headers['content-length'] || '0', 10)
      let downloadedBytes = 0
      let lastUpdate = Date.now()
      let lastDownloadedBytes = 0

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length

        // Update progress every 500ms
        const now = Date.now()
        if (now - lastUpdate > 500 || downloadedBytes === totalBytes) {
          const elapsed = (now - lastUpdate) / 1000
          const speed = elapsed > 0 ? (downloadedBytes - lastDownloadedBytes) / elapsed : 0

          if (totalBytes > 0) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(2)
            const downloaded = formatBytes(downloadedBytes)
            const total = formatBytes(totalBytes)
            const speedStr = formatBytes(speed)

            // Create progress bar
            const barLength = 30
            const filledLength = Math.floor((downloadedBytes / totalBytes) * barLength)
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)

            process.stdout.write(`\r[INFO] ${bar} ${percent}% | ${downloaded} / ${total} | ${speedStr}/s`)
          }
          else {
            const downloaded = formatBytes(downloadedBytes)
            const speedStr = formatBytes(speed)
            process.stdout.write(`\r[INFO] Downloaded: ${downloaded} | ${speedStr}/s`)
          }

          lastUpdate = now
          lastDownloadedBytes = downloadedBytes
        }
      })

      response.pipe(fileStream)

      fileStream.on('finish', () => {
        fileStream.close()
        console.log('\n[OK] Download completed')
        resolve()
      })

      fileStream.on('error', (err) => {
        fs.unlink(dest, () => {}) // Delete partial file
        reject(err)
      })
    })

    request.on('error', (err) => {
      reject(err)
    })

    request.setTimeout(120000, () => {
      request.destroy()
      reject(new Error('Download timeout'))
    })
  })
}

/**
 * Extract ZIP file using system commands
 * @param {string} zipPath - Path to ZIP file
 * @param {string} destPath - Destination directory
 * @returns {Promise<void>}
 */
async function extractZip(zipPath, destPath) {
  console.log(`[INFO] Extracting: ${zipPath}`)
  console.log(`[INFO] To: ${destPath}`)

  // Ensure destination directory exists
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true })
  }

  try {
    // Use platform-specific extraction
    if (process.platform === 'win32') {
      // Windows: Use PowerShell Expand-Archive
      const command = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`
      await execPromise(command)
    }
    else {
      // Unix/Linux/macOS: Use unzip
      const command = `unzip -q -o "${zipPath}" -d "${destPath}"`
      await execPromise(command)
    }

    console.log('[OK] Extraction completed')
  }
  catch (error) {
    console.error('[ERROR] Extraction failed:', error)
    throw new Error(`Failed to extract ZIP file: ${error.message}`)
  }
}

/**
 * Fetch latest SCRCPY release info
 * @returns {Promise<{version: string, assets: Object}>}
 */
async function getScrcpyReleaseInfo() {
  console.log('[INFO] Fetching latest SCRCPY release information...')

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'escrcpy-downloader',
      },
    }

    https.get(SCRCPY_RELEASES_URL, options, (response) => {
      let data = ''

      response.on('data', (chunk) => {
        data += chunk
      })

      response.on('end', () => {
        try {
          const releaseData = JSON.parse(data)
          const version = releaseData.tag_name
          const assets = {}

          releaseData.assets.forEach((asset) => {
            if (asset.name.includes('win64')) {
              assets.win = asset.browser_download_url
            }
            else if (asset.name.includes('macos')) {
              if (asset.name.includes('arm64')) {
                assets['mac-arm64'] = asset.browser_download_url
              }
              else {
                assets['mac-x64'] = asset.browser_download_url
              }
            }
            else if (asset.name.includes('linux')) {
              if (asset.name.includes('aarch64') || asset.name.includes('arm64')) {
                assets['linux-arm64'] = asset.browser_download_url
              }
              else {
                assets['linux-x64'] = asset.browser_download_url
              }
            }
          })

          console.log(`[OK] Latest SCRCPY version: ${version}`)
          resolve({ version, assets })
        }
        catch (error) {
          reject(error)
        }
      })
    }).on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Install ADB for current platform
 * @param {string} platform - Platform identifier
 * @returns {Promise<void>}
 */
async function installAdb(platform) {
  const tempDir = path.join(process.cwd(), '.temp-downloads')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  let downloadUrl
  let destDir

  if (platform === 'win') {
    downloadUrl = ADB_WINDOWS_URL
    destDir = extraResolve('win/scrcpy')
  }
  else if (platform.startsWith('mac')) {
    downloadUrl = ADB_MAC_URL
    destDir = extraResolve(`${platform}/scrcpy`)
  }
  else if (platform.startsWith('linux')) {
    downloadUrl = ADB_LINUX_URL
    destDir = extraResolve(`${platform}/scrcpy`)
  }
  else {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  const zipFile = path.join(tempDir, `platform-tools-${platform}.zip`)

  console.log(`[INFO] Downloading Android Platform Tools for ${platform}...`)
  await downloadFile(downloadUrl, zipFile)

  const extractDir = path.join(tempDir, `platform-tools-${platform}`)
  await extractZip(zipFile, extractDir)

  // Copy ADB binaries
  const platformToolsDir = path.join(extractDir, 'platform-tools')
  if (!fs.existsSync(platformToolsDir)) {
    throw new Error('Platform tools directory not found')
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  if (platform === 'win') {
    // Windows: copy adb.exe and DLLs
    const filesToCopy = ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll']
    filesToCopy.forEach((file) => {
      const src = path.join(platformToolsDir, file)
      const dest = path.join(destDir, file)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
      }
    })
  }
  else {
    // macOS/Linux: copy adb binary
    const src = path.join(platformToolsDir, 'adb')
    const dest = path.join(destDir, 'adb')
    fs.copyFileSync(src, dest)
    fs.chmodSync(dest, 0o755) // Make executable
  }

  console.log(`[OK] ADB installed for ${platform}`)

  // Cleanup
  fs.rmSync(zipFile, { force: true })
  fs.rmSync(extractDir, { recursive: true, force: true })
}

/**
 * Install SCRCPY for current platform
 * @param {string} platform - Platform identifier
 * @param {Object} releaseInfo - Release information
 * @returns {Promise<void>}
 */
async function installScrcpy(platform, releaseInfo) {
  const downloadUrl = releaseInfo.assets[platform]
  if (!downloadUrl) {
    throw new Error(`SCRCPY download URL not found for platform: ${platform}`)
  }

  const tempDir = path.join(process.cwd(), '.temp-downloads')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const zipFile = path.join(tempDir, `scrcpy-${platform}.zip`)
  let destDir

  if (platform === 'win') {
    destDir = extraResolve('win/scrcpy')
  }
  else if (platform.startsWith('mac')) {
    destDir = extraResolve(`${platform}/scrcpy`)
  }
  else if (platform.startsWith('linux')) {
    destDir = extraResolve(`${platform}/scrcpy`)
  }

  console.log(`[INFO] Downloading SCRCPY for ${platform}...`)
  await downloadFile(downloadUrl, zipFile)

  const extractDir = path.join(tempDir, `scrcpy-${platform}`)
  await extractZip(zipFile, extractDir)

  // Find scrcpy directory
  const items = fs.readdirSync(extractDir)
  const scrcpyDir = items.find(item => item.startsWith('scrcpy-'))

  if (!scrcpyDir) {
    throw new Error('SCRCPY directory not found in extracted files')
  }

  const scrcpyPath = path.join(extractDir, scrcpyDir)

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  // Copy all files
  const copyRecursive = (src, dest) => {
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
      }
      const files = fs.readdirSync(src)
      files.forEach((file) => {
        copyRecursive(path.join(src, file), path.join(dest, file))
      })
    }
    else {
      fs.copyFileSync(src, dest)
      // Make executable for Unix-like systems
      if (platform !== 'win' && path.basename(src) === 'scrcpy') {
        fs.chmodSync(dest, 0o755)
      }
    }
  }

  copyRecursive(scrcpyPath, destDir)

  console.log(`[OK] SCRCPY installed for ${platform}`)

  // Cleanup
  fs.rmSync(zipFile, { force: true })
  fs.rmSync(extractDir, { recursive: true, force: true })
}

/**
 * Check if binaries exist
 * @param {string} platform - Platform identifier
 * @returns {boolean}
 */
export function checkBinariesExist(platform = detectPlatform()) {
  let adbPath
  let scrcpyPath

  if (platform === 'win') {
    adbPath = extraResolve('win/scrcpy/adb.exe')
    scrcpyPath = extraResolve('win/scrcpy/scrcpy.exe')
  }
  else if (platform.startsWith('mac')) {
    adbPath = extraResolve(`${platform}/scrcpy/adb`)
    scrcpyPath = extraResolve(`${platform}/scrcpy/scrcpy`)
  }
  else if (platform.startsWith('linux')) {
    adbPath = extraResolve(`${platform}/scrcpy/adb`)
    scrcpyPath = extraResolve(`${platform}/scrcpy/scrcpy`)
  }

  return fs.existsSync(adbPath) && fs.existsSync(scrcpyPath)
}

/**
 * Download and install binaries
 * @param {string} platform - Platform identifier (optional, auto-detect if not provided)
 * @returns {Promise<void>}
 */
export async function downloadBinaries(platform = detectPlatform()) {
  try {
    console.log('[INFO] Starting binary download process...')
    console.log(`[INFO] Target platform: ${platform}`)

    // Check if binaries already exist
    if (checkBinariesExist(platform)) {
      console.log('[INFO] Binaries already exist, skipping download')
      return
    }

    // Get SCRCPY release info
    const scrcpyInfo = await getScrcpyReleaseInfo()

    // Install ADB
    await installAdb(platform)

    // Install SCRCPY
    await installScrcpy(platform, scrcpyInfo)

    console.log('[OK] All binaries downloaded and installed successfully!')
  }
  catch (error) {
    console.error('[ERROR] Failed to download binaries:', error)
    throw error
  }
}

/**
 * Ensure binaries are available (download if missing)
 * @param {string} platform - Platform identifier (optional)
 * @returns {Promise<void>}
 */
export async function ensureBinaries(platform = detectPlatform()) {
  if (!checkBinariesExist(platform)) {
    console.log('[WARN] Binaries not found, downloading...')
    await downloadBinaries(platform)
  }
}
