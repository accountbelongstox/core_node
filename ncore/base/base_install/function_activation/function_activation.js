const Base = require('#@base');
const { wsl_activator, turn_feature } = require('#@utils_native');

class GetNode extends Base {
  constructor() {
    super();
  }

  async start() {
    turn_feature.start();
    wsl_activator.start();
  }
}

module.exports = new GetNode();
