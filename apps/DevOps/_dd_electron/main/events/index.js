const { Tray, /*protocol,*/ Menu,/* shell,*/BrowserWindow, /*ipcMain, nativeImage,*//* NativeImage,*/screen, globalShortcut } = require('electron')
// const { screen } = require('electron');
// const { autoUpdater } = require('electron-updater');
const path = require('path')
const fs = require('fs')
const widgets = require('../component/comlib/widget.js');
const components = require('../component/comlib/component.js');
const units = require('../component/comlib/unit.js');
const mainComs = require('../component/comlib/mainComs.js');
const {configHandle} = require('../component/comlib/config.js');
const res_events = require('../component/comlib/res_events.js');
const encyclopedia = require('../component/comlib/encyclopedia.js');

const {
	app,
	win
} = components;
const {
	frameUnit,
} = units;
const {
	httpWidget,
	configWidget,
	shortcutRegistrationWidget,
	winapiWidget,
	shortcutIconWidget,
} = widgets;
const { config_base, config } = configWidget.getInitConfig()
const events =  require('../res_events/events.js');
const eggPreload =  require('../electron/preload/index.js');
let tray;
class mainByEggElectron {
	first_cast_config = false
	openUrl = true
	preload_window = '../preload/preload.js'
	compile_dir = `html_compile`
	raw_dir = `html_raw`
	load_index = `index.html`

	initCreateWindow() {
		const isSingleInstance = app.requestSingleInstanceLock();
		if (!isSingleInstance) {
			app.quit();
			return
		}
		this.organizeEncyclopedia()
		app.whenReady().then(() => {
			this.executionProgramStartupInterface()
			app.on('activate', () => {
				if (BrowserWindow.getAllWindows().length === 0) {
					this.executionProgramStartupInterface()
				}
			})
		})
		
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

		// protocol.registerSchemesAsPrivileged([{
		// 	scheme: 'demoapp',
		// 	privileges: {
		// 		secure: true,w
		// 		standard: true
		// 	}
		// }])

		// process.on('unhandledRejection', (reason, promise) => {
		// 	reason = reason.toString()
		// 	if (reason.includes("An object could not be cloned")) {
		// 		return
		// 	}
		// 	console.log('Promise ', reason);
		// 	console.log('Error ', promise);
		// });
	}

	organizeEncyclopedia() {
		configHandle.setConfig(config)
		configHandle.setConfigBase(config_base)
		encyclopedia.setEncyclopediaByKey(`main`,this)
		encyclopedia.setEncyclopedia(mainComs)
		encyclopedia.setEncyclopedia(res_events)
		encyclopedia.setEncyclopedia(components)
		encyclopedia.setEncyclopedia(widgets)
		encyclopedia.setEncyclopedia(units)
	}

	getHTMLDir(html_dir) {
		let html_file = `../../static/${html_dir}/${this.load_index}`
		html_file = path.join(__dirname, html_file)
		console.log(`html_file`, html_file)
		return html_file
	}

	async onlyExecuteOnceAfterLoading() {
		if (this.already_after_exec) {
			return
		}
		this.already_after_exec = true
		try {
			shortcutRegistrationWidget.shortcutKeyEffect()
			eggPreload.autoExecAfterByLoaded()
		}
		catch (e) {
			console.log(e)
		}
	}

	executionProgramStartupInterface() {
		this.compileHtml()
		if (frameUnit.isParameter(`--no-interface`)) {
			this.createWinInterface()
		} else {
			httpWidget.checkAndStartServer()
		}
		this.createTray()

		if (!win || !!win.webContents) {
			this.onlyExecuteOnceAfterLoading()
		}

		winapiWidget.setstartup()

		// process.on('uncaughtException', (err) => {
		// 	console.log('Caught exception: ', err);
		// 	// 可以在这里记录错误，但不抛出
		// });
	}

	winLesting() {
		win.webContents.on('did-finish-load', () => {
			this.onlyExecuteOnceAfterLoading()
		})

		win.on('close', e => {
			events.close_before()
			e.preventDefault()
		})
	}

	compileHtml() {
		let basedir_html_row = path.dirname(this.getHTMLDir(this.raw_dir))
		let compile_dir = path.join(path.dirname(basedir_html_row), this.compile_dir)
		this.compileHTMLFiles(basedir_html_row, compile_dir)
		let compile_loadindex = this.getHTMLDir(this.compile_dir)
		return compile_loadindex
	}

	createTray() {
		tray = new Tray(shortcutIconWidget.getDefaultImageFile());
		// 创建 Tray 菜单项
		const contextMenu = Menu.buildFromTemplate([
			{
				label: '重启软件', type: 'normal', click: () => {
					events.relaunch();
				}
			},
			{
				label: '软件最小化', type: 'normal', click: () => {
					events.minimize()
				}
			},
			{
				label: '显示网页版', type: 'normal', click: () => {
					httpWidget.openServerUrl()
				}
			},
			{
				label: '显示界面', type: 'normal', click: () => {
					this.createWinInterface();
				}
			},
			{ type: 'separator' },
			{
				label: 'Exit', click: () => {
					events.close();
				}
			}
		]);
		tray.setContextMenu(contextMenu);
	}

	createWinInterface() {
		if (!this.thewindowInterfaceHasBeenCreated) {
			this.thewindowInterfaceHasBeenCreated = true
			if (config_base.set_application_menu == false) {
				Menu.setApplicationMenu(null)
			}
			if (!config_base.window_width || !config_base.window_height) {
				const primaryDisplay = screen.getPrimaryDisplay();
				const { width, height } = primaryDisplay.workAreaSize;
				if (!config_base.window_width) {
					config_base.window_width = width
				}
				if (!config_base.window_height) {
					config_base.window_height = height
				}
			}
			let window_width = parseInt(config_base.window_width)
			let window_height = parseInt(config_base.window_height)
			win = new BrowserWindow({
				width: window_width,
				height: window_height,
				resizable: config_base.resizable,
				frame: config_base.window_frame,
				fullscreenable: true,
				webPreferences: {
					// preload: path.join(__dirname, this.preload_window),
					devTools: false,
					nodeIntegration: true
				}
			})
			let htmlUrl = httpWidget.getServerUrl()
			win.loadURL(htmlUrl)
			this.winLesting()
		} else {
			events.maximize()
		}
	}

	set_attr(key, val) {
		this[key] = val
	}

	get_attr(key) {
		return this[key]
	}

	processIncludeTags(content, basePath) {
		const includePattern = /\{include:"(.*?)"\}/g;
		const processedContent = content.replace(includePattern, (match, includePath) => {
			const fullIncludePath = path.join(basePath, includePath);
			if (fs.existsSync(fullIncludePath)) {
				return fs.readFileSync(fullIncludePath, 'utf-8');
			} else {
				return `<!-- Include file not found: ${fullIncludePath} -->`;
			}
		});
		return processedContent;
	}

	replaceIncludes(content, basePath) {
		const includeRegex = /\{include:"(.*?\.html)"\}/g;
		return content.replace(includeRegex, (match, includePath) => {
			const absoluteIncludePath = path.join(basePath, includePath);

			if (fs.existsSync(absoluteIncludePath)) {
				const fileContent = fs.readFileSync(absoluteIncludePath, 'utf8');
				return this.replaceIncludes(fileContent, path.dirname(absoluteIncludePath));  // 递归替换
			} else {
				console.error(`File not found: ${absoluteIncludePath}`);
				return '';
			}
		});
	}

	compileHTMLFiles(srcDir, destDir) {
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}
		const files = fs.readdirSync(srcDir);
		let isUpdata = false
		let updatFiles = []
		files.forEach(file => {
			const filePath = path.join(srcDir, file);
			const destFilePath = path.join(destDir, file);
			const fileStat = fs.statSync(filePath);
			if (fileStat.isFile() && path.extname(file) === '.html') {
				if (!fs.existsSync(destFilePath) || (fileStat.mtime > fs.statSync(destFilePath).mtime)) {
					isUpdata = true
				}
				updatFiles.push(
					[destFilePath, filePath]
				)
			}
		});
		if (isUpdata) {
			updatFiles.forEach((file) => {
				let [destFilePath, filePath] = file
				let content = fs.readFileSync(filePath, 'utf8');
				content = this.replaceIncludes(content, srcDir);
				fs.writeFileSync(destFilePath, content, 'utf8');
			})
		}
	}
}
module.exports = mainByEggElectron
