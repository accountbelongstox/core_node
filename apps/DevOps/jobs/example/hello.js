const Log = require('@egg/ee-core/log');

exports.welcome = function () {
  Log.info('[child-process] [jobs/example/hello] welcome ! ');
}