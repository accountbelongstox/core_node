class DownloadInterface {
    init(browser, page) {}
    getCurrentPage(page) {}


    getDefaultDownloadPath(browser) {
        /* 根据puppeteer的browser,获取其默认的下载路径 */
        /* Get the default download path based on puppeteer's browser */
    }

    setDefaultDownloadPath(browser, path) {
        /* 设置browser的默认的下载路径 */
        /* Set the default download path for the browser */
    }

    extractFileNameFromURL(url) {
        /* 根据一个根据URL获取一个文件名，正常取得/xxx.文件名，取得文件名，如果没有/xxx.xxx 而是 /xxx/xxx/ 则将url格式化为一个文件名，如果是 xxx/xx?xxx=#@等，则将最后一个/后面的值格式化为一个可用的文件名 */
        /* Get a filename from a URL. Normally it retrieves /xxx.filename. If it's like /xxx/xxx/ it'll format the URL as a filename. If it ends with special characters like ? or #, it will format the value after the last slash as a usable filename */
    }

    getDownloadFileName(url, specifiedName) {
        /* 获取一个下载文件名，如果指定文件名则返回，如果没有则根据传入的URL转为文件名 */
        /* Get a download filename. If a name is specified, return it; otherwise, convert the input URL into a filename */
    }

    getDefaultTempDownloadPath(config) {
        /* 根据配置文件，获取其默认的临时下载路径，并存为this.属性 */
        /* Get the default temporary download path from a configuration file and store it as this.attribute */
    }

    downloadLinkResource(selector) {
        /* 给一个a标签选择器，下载对应的herf资源(使用OUTHTML获到字符串，并保存)并存为this.下载路径 */
        /* For an a-tag selector, download the corresponding href resource (retrieve the string using OUTHTML and save) and store in this.downloadPath */
    }

    saveImageFromSelector(selector) {
        /* 给一个img标签选择器，读取其二进制数据转存到默认路径 */
        /* For an img-tag selector, read its binary data and save it to the default path */
    }

    saveAudioFromSelector(selector) {
        /* 给一个音频标签选择器，读取其资源二进制数据转存到默认路径 */
        /* For an audio-tag selector, read its resource binary data and save to the default path */
    }

    createAndClickDownloadLink(selector) {
        /* 给一个选择器，创建一个a标签，并有_bank属性，点击后弹出该资源并使用浏览器默认下载（下载后将该a标签删除），该a标签需要有一个唯一的ID值 */
        /* For a selector, create an a-tag with a _bank attribute. After clicking, the resource will pop up and use the browser's default download (the a-tag will be deleted after downloading). The a-tag needs a unique ID value */
    }

    toString = () => {
        /* 返回类的字符串表示 */
        /* Return the string representation of the class */
        return '[class DownloadInterface]';
    };
}

module.exports = {
    DownloadInterface
}
