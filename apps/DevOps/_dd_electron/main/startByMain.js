const {  /*protocol,*/ Menu, app,/* shell,*/ BrowserWindow, /*ipcMain, nativeImage,*//* NativeImage,*/screen } = require('electron')
// const { autoUpdater } = require('electron-updater');
const path = require('path')
const { tool, conf, json, file } = require('../ncore/utils.js');
const { http, serve } = require('../ncore/practicals.js');
const { env } = require('../ncore/globalvars.js');
const { elec, ctrl, view } = require('../ncore/electron.js');
const lifeCycle = require('./start/life_cycle.js');
const viewPreload = path.join(__dirname, './preload/view/index.js');
const electronTray = require('./start/traies.js');
const configIndex = require('../config/config.index.js');
let electronWindow = null;
// # --interface 如果带该参数,则启动window窗口
const userDataConf = conf.setInitConfig()
let updatedConfig = json.deepUpdate(configIndex(), userDataConf)

const Ps = require('@egg/ee-core/ps');
const Log = require('@egg/ee-core/log');
const Conf = require('@egg/ee-core/config');
const EGGConfig = Conf.all();
updatedConfig = json.deepUpdate(EGGConfig, updatedConfig)
const Base = require('../ncore/base/base');

let MainConf = updatedConfig.MainConf
let localPORT = MainConf.frontendConfig.frontend_prot
let localURL = MainConf.frontendConfig.frontend
const frontend = env.getEnv('FRONTEND', MainConf.frontendConfig.frontend_build)
const frontend_node = env.getEnv('FRONTEND_NODE', `18`)
let frontend_command = MainConf.frontendConfig.frontend_command
let frontend_port = MainConf.frontendConfig.frontend_port
const start_open_webpage = env.getEnv(`START_OPEN_WEBPAGE`)
const yarndir = file.resolvePath('logs/.yarn_dir')
let yarnPath = `yarn`
if (file.isFile(yarndir)) {
	yarnPath = file.readFirstLine(yarndir)
}

class MountEgg extends Base {
	loadURL = null
	localPORT = null
	localURL = null
	constructor() {
		super()
	}

	async start() {
		const startup_by_cmd = file.resolvePath('logs/.startup_by_cmd')
		if (file.isFile(startup_by_cmd) && false) {
			file.delete(startup_by_cmd)
			ctrl.relaunch(3000);
		} else {
			const isSingleInstance = app.requestSingleInstanceLock();
			if (!isSingleInstance) {
				app.quit();
				Log.info(`There is already an identical instance running.`)
				return
			}
			app.whenReady().then(async () => {
				await this.exeStartupInterface()
				app.on('activate', async () => {
					if (BrowserWindow.getAllWindows().length === 0) {
						await this.exeStartupInterface()
					}
				})
			})
		}

	}

	setLoadUrl(url, port = null) {
		this.loadURL = `${url}${port ? `:${port}` : ""}`
		MainConf.loadMainURL = this.loadURL
	}

	async onlyExecuteOnceAfterLoading() {
		if (this.already_after_exec) {
			return
		}
		this.already_after_exec = true
		try {
			await lifeCycle.onlyExecuteOnceAfterLoading()
		}
		catch (e) {
			Log.info(`onlyExecuteOnceAfterLoading`)
			Log.error(e)
		}
	}

	async exeStartupInterface() {
		serve.startFrontend(frontend, frontend_command, frontend_node, async (debugUrl) => {
			this.success(`
				Server started successfully.
				Access it at: ${debugUrl}
			`)
			if (tool.isParameter(`interface`)) {
				this.createWinInterface()
			}
			electronTray.create(this, electronWindow, updatedConfig, Ps)
			if (!electronWindow || !!electronWindow.webContents) {
				this.onlyExecuteOnceAfterLoading()
			}
			await lifeCycle.loaded(MainConf)
			if (start_open_webpage || MainConf.embeddedPageOpen) {
				serve.openFrontendServerUrl(debugUrl)
			}

			elec.setstartup()
		})
		if (!frontend) {
			this.loadPORT = await http.checkPort(this.loadPORT)
			if (!file.isAbsolute(MainConf.frontendConfig.distDir)) {
				MainConf.frontendConfig.distDir = path.join(elec.getRootDir(), MainConf.frontendConfig.distDir)
			}
			http.checkAndStartServer(MainConf, this.loadPORT)
		} else {
			this.setLoadUrl(frontend)
		}

	}

	winLesting() {
		electronWindow.webContents.on('did-finish-load', async () => {
			await lifeCycle.windowReady()
			this.onlyExecuteOnceAfterLoading()
		})
		electronWindow.on('close', e => {
			view.close_before()
			e.preventDefault()
		})
	}

	async createWinInterface() {
		if (!this.thewindowInterfaceHasBeenCreated) {
			this.thewindowInterfaceHasBeenCreated = true
			if (MainConf.enableApplicationWindowTitle == false) {
				// Menu.setApplicationMenu(null)
			}
			if (!MainConf.window_width || !MainConf.window_height) {
				const primaryDisplay = screen.getPrimaryDisplay();
				const { width, height } = primaryDisplay.workAreaSize;
				if (!MainConf.window_width) {
					MainConf.window_width = width
				}
				if (!MainConf.window_height) {
					MainConf.window_height = height
				}
			}
			let window_width = parseInt(MainConf.window_width)
			let window_height = parseInt(MainConf.window_height)
			electronWindow = new BrowserWindow({
				width: window_width,
				height: window_height,
				resizable: MainConf.windowResizable,
				frame: MainConf.windowFrame,
				fullscreenable: true,
				webPreferences: {
					preload: viewPreload,
					// devTools: MainConf.devTools,
					contextIsolation: true,
					nodeIntegration: false,
				},
				icon: path.join(elec.getRootDir(), 'public', 'images', 'logo-32.png'),
			})
			ctrl.setElectronWindow(electronWindow)
			const FrontendloadURL = serve.getFrontendServerUrl()
			electronWindow.loadURL(FrontendloadURL)
			if (MainConf.devTools) {
				electronWindow.webContents.openDevTools({ mode: 'right' })
			}
			this.winLesting()
		} else {
			ctrl.maximize()
		}
	}
}
module.exports = MountEgg
