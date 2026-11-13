/* preload.js – gives the page a small, safe "SudDesk" object (licence details, Machine ID, update and licence calls). */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const I = ipcRenderer.sendSync('desk:init');
contextBridge.exposeInMainWorld('SudDesk', {
  lic: I.lic, plic: I.plic, why: I.why, mid: I.mid, shell: I.shell, build: I.build, state: I.state,
  setLicence: key => ipcRenderer.invoke('desk:setLicence', String(key || '')),
  checkOnline: () => ipcRenderer.invoke('desk:checkOnline'),
  sendReq: o => ipcRenderer.invoke('desk:sendReq', o),
  checkUpdate: () => ipcRenderer.invoke('desk:checkUpdate'),
  applyUpdate: () => ipcRenderer.invoke('desk:applyUpdate'),
  open: url => ipcRenderer.invoke('desk:open', String(url || '')),
  start: () => ipcRenderer.invoke('desk:start')
});
