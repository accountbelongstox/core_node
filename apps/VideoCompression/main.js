const ffmpegSetup = require('#@ncore/utils/video/libs/ffmpegSetupBywin.js');
const gconfig = require('#@gconfig');
const { compressVideos } = require('#@ncore/utils/video/libs/compress-index.js');
class appMain {

  async start() {
    await ffmpegSetup.install();
    for (const dir of gconfig.LOCAL_VIDEO_DIRS) {
      console.log(gconfig);
      console.log(gconfig.VIDEO_EXTENSIONS);

      await compressVideos(dir, null, gconfig.VIDEO_EXTENSIONS);
    }
  }
}

module.exports = new appMain();