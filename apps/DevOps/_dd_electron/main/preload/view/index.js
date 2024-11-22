const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: ipcRenderer,
})

const Renderer = (window.require && window.require('electron')) || window.electron || {};
const ipc = Renderer.ipcRenderer || undefined;

class preLoad {
  constructor() {
  }
  start() {
    window.isElectron = true
    alert(window.isElectron )
  }
}

const preload = new preLoad()
preload.start()

try {
  const { contextBridge, ipcRenderer } = require('electron');
  contextBridge.exposeInMainWorld('send', {
    sendToMain: (channel, data) => {
      ipcRenderer.send(channel, data);
    },
    receiveFromMain: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  });
} catch (e) {
  console.log(e)
}