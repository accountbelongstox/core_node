import Base from '#@base'; 
import { wsl_activator,turn_feature } from '#@utils_native';

class GetNode extends Base {
  constructor() {
    super();
  }

  async start() {
    turn_feature.start();
    wsl_activator.start();
  }
}

export default new GetNode();
