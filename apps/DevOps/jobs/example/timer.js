const Job = require('@egg/ee-core/jobs/baseJobClass');
const Loader = require('@egg/ee-core/loader');
const Log = require('@egg/ee-core/log');
const Ps = require('@egg/ee-core/ps');
const { childMessage } = require('@egg/ee-core/message');
const Hello = Loader.requireJobsModule('./example/hello');

/**
 * example - TimerJob
 * @class
 */
class TimerJob extends Job {

  constructor(params) {
    super();
    this.params = params;
  }

  /**
   * handle()方法是必要的，且会被自动调用
   */
  async handle () {
    Log.info("[child-process] TimerJob params: ", this.params);

    // 计时器任务
    
    let number = 0;
    let jobId = this.params.jobId;
    let eventName = 'job-timer-progress-' + jobId;
    let timer = setInterval(function() {
      Hello.welcome();

      childMessage.send(eventName, {jobId, number, end: false});
      number++;
    }, 1000);

    // 用 setTimeout 模拟任务运行时长
    setTimeout(() => {
      // 关闭定时器
      clearInterval(timer);

      // 任务结束，重置前端显示
      childMessage.send(eventName, {jobId, number:0, pid:0, end: true});

      // 如果是childJob任务，必须调用 Ps.exit() 方法，让进程退出，否则会常驻内存
      // 如果是childPoolJob任务，常驻内存，等待下一个业务
      if (Ps.isChildJob()) {
        Ps.exit();
      }
    }, 10 * 1000)
  }   
}

TimerJob.toString = () => '[class TimerJob]';
module.exports = TimerJob;
