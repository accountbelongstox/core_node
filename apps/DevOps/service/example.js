'use strict';

const { Service } = require('@egg/ee-core');
const Services = require('@egg/ee-core/services');
const Log = require('@egg/ee-core/log');

/**
 * 示例服务（service层为单例）
 * @class
 */
class ExampleService extends Service {

  constructor(ctx) {
    super(ctx);
  }

  /**
   * test
   */
  async test(args) {
    let obj = {
      status:'ok',
      params: args
    }

    Log.info('ExampleService obj:', obj);

    Services.get('framework').test('egg');

    return obj;
  }
}

ExampleService.toString = () => '[class ExampleService]';
module.exports = ExampleService;