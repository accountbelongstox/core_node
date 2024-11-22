const {  /*protocol,*/ Menu, app,/* shell,*/ BrowserWindow, /*ipcMain, nativeImage,*//* NativeImage,*/screen } = require('electron')
// const { autoUpdater } = require('electron-updater');
const Base = require('#@base');
// const Ps = require('../../../ncore/plugins/egg-electron/ee-core/ps');
const Log = require('@egg/ee-core/log');
const path = require('path')
const { tool, conf, json, file, urltool, plattool, sysarg } = require('#@ncore/utils.js');
const { http, serve } = require('#@ncore/practicals.js');
const { env, gdir, encyclopedia,app_parrent_dir } = require('#@ncore/globalvars.js');
const { elec, ctrl, view } = require('./egg_utils.js');
const { exit } = require('process');
const viewPreload = path.join(__dirname, './preload/view/index.js');
let win = null;
const Conf = require('@egg/ee-core/config');
const AllConf = Conf.all()
let appBinConfig = conf.getAllAppBinConf()
const configDir = conf.getAppConfDir()
const appsDir = conf.getAppConfDir()

console.log(AllConf)
console.log(appBinConfig)

class MountEgg extends Base {
	loadURL = null
	localPORT = null
	localURL = null
	constructor() {
		super()
	}

	//modify

	async start() {
		if (!file.isDir(appsDir)) {
			this.error(`The specified ${appsDir} directory does not exist or is not a directory`);
			return
		}
		if (!file.isDir(configDir)) {
			this.error(`The "${configDir}" directory does not exist inside the "config" directory`);
			return
		}
		const isSingleInstance = app.requestSingleInstanceLock();
		if (!isSingleInstance) {
			app.quit();
			Log.info(`There is already an identical instance running.`)
			return
		}
		app.whenReady().then(async () => {
			await this.launchServerWithUi()
			app.on('activate', async () => {
				if (BrowserWindow.getAllWindows().length === 0) {
					await this.launchServerWithUi()
				}
			})
		})

		// const startup_by_cmd = file.resolvePath('logs/.startup_by_cmd')
		// if (file.isFile(startup_by_cmd) && false) {
		// 	file.delete(startup_by_cmd)
		// 	ctrl.relaunch(3000);
		// } else {

		// }
	}

	listens() {
		app.on('window-all-closed', () => {
			if (process.platform !== 'darwin') {
				app.quit()
			}
		})
		app.on("open-url", async (event, url) => {
			console.log(url)
		})
		app.on('close', e => {
			e.preventDefault()
		})
		app.on('window-all-closed', () => {
			if (process.platform !== 'darwin') {
				app.quit()
			}
		})
		app.on('will-quit', () => {
			globalShortcut.unregisterAll();
		})
	}

	winLesting() {
		win.webContents.on('did-finish-load', async () => {
			this.onlyExecuteOnceAfterLoading()
		})
		win.on('close', e => {
			// view.close_before()
			e.preventDefault()
		})
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
	}

	async launchServerWithUi() {
		this.listens()
		if (!AllConf.showMain) {
			this.success(`The current priority is WEB startup..`)
			await this.startWithWeb()
		} else {
			this.success(`The current priority is UI startup..`)
			await this.startWithUi()
		}
		elec.setstartup()
	}

	async startWithWeb() {
		const npm_lifecycle_event = process.env.npm_lifecycle_event
		console.log(`npm_lifecycle_event`, npm_lifecycle_event)
		const frontendConf = appBinConfig.dev.frontend
		const port = frontendConf.port
		const hostname = frontendConf.hostname
		const protocol = frontendConf.protocol

		if (npm_lifecycle_event != "dev") {
			const eeCore = encyclopedia.getEncyclopedia(`eeCore`)
			// node_modules\ee-bin\tools\serve.js
			const binConfigFile = conf.getEggConfDir(`bin.js`, true)
			const serveConfig = {
				config: binConfigFile
			}
			const servePath = path.join(__dirname, '../../node_modules/ee-bin/tools/serve.js');
			if (file.isFile(servePath)) {
				const eggServe = require('../../node_modules/ee-bin/tools/serve.js');
				eggServe.dev(serveConfig);
			} else {
				const binConfigFileByRoot = this.getCwd(binConfigFile)
				const binConfig = require(binConfigFileByRoot)
				const dist = this.getCwd( binConfig?.rd?.target ? binConfig?.rd?.target : './public/dist')
				serve.startServer(dist,port)
			}
		}

		this.trayCreate()
		setTimeout(() => {
			serve.openFrontendServerUrl({
				protocol,
				hostname,
				port
			})
		}, 1500)
		return
		// const frontend_node = env.getEnv('FRONTEND_NODE', `18`)
		// let frontend_command = MainConf.frontendConfig.frontend_command
		// const start_open_webpage = env.getEnv(`START_OPEN_WEBPAGE`)

		// serve.startFrontend(frontend, frontend_command, frontend_node, async (debugUrl) => {
		// 	this.success(`
		// 		Server started successfully.
		// 		Access it at: ${debugUrl}
		// 	`)
		// 	if (tool.isParameter(`interface`)) {
		// 		this.createWinInterface()
		// 	}
		// 	this.trayCreate()
		// 	if (!win || !!win.webContents) {
		// 		this.onlyExecuteOnceAfterLoading()
		// 	}
		// 	await this.loaded(MainConf)
		// 	if (start_open_webpage || MainConf.embeddedPageOpen) {
		// 		serve.openFrontendServerUrl(debugUrl)
		// 	}

		// 	elec.setstartup()
		// })
		// if (!frontend) {
		// 	this.loadPORT = await http.checkPort(this.loadPORT)
		// 	if (!file.isAbsolute(MainConf.frontendConfig.distDir)) {
		// 		MainConf.frontendConfig.distDir = path.join(elec.getRootDir(), MainConf.frontendConfig.distDir)
		// 	}
		// 	http.checkAndStartServer(MainConf, this.loadPORT)
		// } else {
		// 	this.setLoadUrl(frontend)
		// }
	}


	async startWithUi() {
		const windowsOption = AllConf.windowsOption
		const openAppMenu = AllConf.openAppMenu
		const openDevTools = AllConf.openDevTools
		let width = windowsOption.width
		let height = windowsOption.height
		if (!this.thewindowInterfaceHasBeenCreated) {
			this.thewindowInterfaceHasBeenCreated = true
			if (openAppMenu == 'dev-show') {
				Menu.setApplicationMenu(null)
			}
			if (!width || !height) {
				const primaryDisplay = screen.getPrimaryDisplay();
				let workAreaSize = primaryDisplay.workAreaSize;
				width = workAreaSize.width
				height = workAreaSize.height
			}
			const windowsConfig = {
				width,
				height,
				resizable: !!windowsOption.resizable,
				frame: !!windowsOption.resizable,
				fullscreenable: true,
				webPreferences: {
					preload: viewPreload,
					devTools: openDevTools,
					contextIsolation: true,
					nodeIntegration: false,
				},
				icon: path.join(elec.getRootDir(), 'public', 'images', 'logo-32.png'),
			}
			console.log(`--------------------------- windowsConfig ---------------------------`)
			console.log(windowsConfig)
			console.log(`---------------------------------------------------------------------`)
			win = new BrowserWindow(windowsConfig)
			const remoteUrlConfig = AllConf.remoteUrl
			const remoteUrlEnable = remoteUrlConfig.remoteUrl
			let remoteUrl = remoteUrlEnable ? remoteUrlConfig.url : appBinConfig.dev.frontend
			remoteUrl = urltool.toOpenUrl(remoteUrl)
			win.loadURL(remoteUrl)
			// const FrontendloadURL = serve.getFrontendServerUrl()
			if (openDevTools) {
				win.webContents.openDevTools({ mode: 'right' })
			}
			this.winLesting()
		} else {
			ctrl.maximize()
		}
	}


	trayCreate() {
		const triesFilePath = path.join(configDir, 'tries.js');
		if (file.isFile(triesFilePath)) {
			let tries = require(triesFilePath);
			tries = new tries(this, win,)
			const {
				title,
				icon,
				menuItems
			} = tries.getMenuItems();
			tray.createTray(menuItems, icon, title);
		} else {
			console.log('Cannot find tries.js file in the "config" directory');
			return false;
		}
	}
}
module.exports = MountEgg
