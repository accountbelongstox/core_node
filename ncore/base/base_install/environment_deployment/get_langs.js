import Base from '#@base';
import { getnode_win, getpython_win,getbaselibs_win,getgolang_win,getjava_win,getrust_win,getruby_win,getphp_win, winpath } from '#@utils_native';

class GetNode extends Base {
  constructor() {
    super();
  }

  async start() {
    const installers = [getnode_win, getpython_win,getbaselibs_win,getgolang_win,getjava_win,
      getphp_win,
      getrust_win,
      // getruby_win
    ];

    for (const installer of installers) {
      const installerName = installer === getnode_win ? 'Node.js' : 'Python';

      console.log(`Starting ${installerName} installation...`);
      installer.start();

      const details = installer.getDefaultVersion();
      this.success(`${installerName} default version: ${details.versionKey}`, );
      this.success(`${installerName} default rootDir: ${details.installDir}`, );
      console.log(`details.baseDir`,details.baseDir)
      details.baseDir.forEach((dir) => {
        console.log(`Checking if directory is already in environment variables: ${dir}`);
        if (!winpath.isPath(dir)) {
          console.log(`Adding directory to environment variables: ${dir}`);
          winpath.addPath(dir);
        } else {
          console.log(`Directory already exists in environment variables: ${dir}`);
        }
      });
    }
  }
}

export default new GetNode();
