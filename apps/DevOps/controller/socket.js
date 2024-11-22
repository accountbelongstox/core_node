'use strict';
const path = require('path');
// const fs = require('fs');
// const { exec } = require('child_process');
const { Controller } = require('@egg/ee-core');
const { app: electronApp, shell } = require('electron');
// const dayjs = require('dayjs');
const Ps = require('@egg/ee-core/ps');
const Log = require('@egg/ee-core/log');
const Services = require('@egg/ee-core/services');
const Conf = require('@egg/ee-core/config');
// const Addon = require('@egg/ee-core/addon');
const EE = require('@egg/ee-core/ee');
const controllerCache = {}

class SocketController extends Controller {

  constructor(ctx) {
    super(ctx);
  }

  /**
   * 检测http服务是否开启
   */
  async checkHttpServer() {
    const httpServerConfig = Conf.getValue('httpServer');
    const url = httpServerConfig.protocol + httpServerConfig.host + ':' + httpServerConfig.port;

    const data = {
      enable: httpServerConfig.enable,
      server: url
    }
    return data;
  }

  /**
   * 一个http请求访问此方法
   */
  async doHttpRequest() {
    const { CoreApp } = EE;
    // http方法
    const method = CoreApp.request.method;
    // http get 参数
    let params = CoreApp.request.query;
    params = (params instanceof Object) ? params : JSON.parse(JSON.stringify(params));
    // http post 参数
    const body = CoreApp.request.body;
    const httpInfo = {
      method,
      params,
      body
    }
    Log.info('httpInfo:', httpInfo);
    if (!body.id) {
      return false;
    }
    const dir = electronApp.getPath(body.id);
    shell.openPath(dir);
    return true;
  }

  //socket
  async loadController(name) {
    const modulePath = `./${name}`;
    const controller = require(modulePath);
    const formattedControllerName = `[class ${name}Controller]`;
    controllerCache[formattedControllerName] = controller;
    return controller;
  }

  async invokeControllerMethod(fullMethodName, args) {
    const [controllerName, methodName] = fullMethodName.split('.');
    const formattedControllerName = `[class ${controllerName}Controller]`;

    if (!(formattedControllerName in controllerCache)) {
      await this.loadController(controllerName);
    }

    const controller = controllerCache[formattedControllerName];
    return controller[methodName](args);
  }

  async invokeServiceMethod(fullMethodName, args) {
    const [serviceName, methodName] = fullMethodName.split('.');
    try {
      const serviceInstance = Services.get(serviceName).methodName;

      if (!serviceInstance) {
        throw new Error(`找不到服务 ${serviceName}。`);
      }

      if (typeof serviceInstance[methodName] !== 'function') {
        throw new Error(`服务 ${serviceName} 没有方法 ${methodName}。`);
      }

      return serviceInstance[methodName](args);
    } catch (error) {
      console.error('调用服务方法时出错:', error.message);
      return false;
    }
  }

  async socketInvoke(params) {
    const { method, args } = params;
    try {
      if (method.startsWith('controller.')) {
        return await this.invokeControllerMethod(method.slice(11), args);
      } else if (method.startsWith('service.')) {
        return await this.invokeServiceMethod(method.slice(8), args);
      } else {
        throw new Error('Invalid method format. Must start with "controller." or "service."');
      }
    } catch (error) {
      console.error('Error invoking method:', error.message);
      return false;
    }
  }

  /**
   * 任务
   */
  someJob(args, event) {
    let jobId = args.id;
    let action = args.action;

    let result;
    switch (action) {
      case 'create':
        result = Services.get('framework').doJob(jobId, action, event);
        break;
      case 'close':
        Services.get('framework').doJob(jobId, action, event);
        break;
      default:
    }

    let data = {
      jobId,
      action,
      result
    }
    return data;
  }

  /**
   * 创建任务池
   */
  async createPool(args, event) {
    let num = args.number;
    Services.get('framework').doCreatePool(num, event);
    Services.get('framework').monitorJob();
    return;
  }

  /**
   * 通过进程池执行任务
   */
  someJobByPool(args, event) {
    let jobId = args.id;
    let action = args.action;

    let result;
    switch (action) {
      case 'run':
        result = Services.get('framework').doJobByPool(jobId, action, event);
        break;
      default:
    }

    let data = {
      jobId,
      action,
      result
    }
    return data;
  }

}

SocketController.toString = () => '[class SocketController]';
module.exports = SocketController;  