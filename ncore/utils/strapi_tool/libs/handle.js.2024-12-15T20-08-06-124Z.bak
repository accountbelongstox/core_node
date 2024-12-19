
添加方法:进入一个strapi目录,判断是否有node_modules目录
添加方法:如果没有node_modules目录,调用yarn进行安装
添加方法:使用yarn增加一个包
添加方法:创建一个启动脚本(如果已经存在,则替换)`import path from 'path';
import strapi from '@strapi/strapi';

// Set the directory paths
const appDir = path.join(__dirname, '.',);
const distDir = path.join(appDir, '');

// Initialize Strapi with the specified configurations
const app = strapi({
    appDir,
    distDir,
    autoReload: true,
    serveAdminPanel: true
});

// Start the Strapi application
app.start();
`
添加方法,使用node执行该启动脚本