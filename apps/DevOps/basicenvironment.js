'use strict';
const {serve} = require('@app_control/test');
const fs = require('fs');
const { exec } = require('child_process');
const Base = require('@base');
/**
 * 示例服务（service层为单例）
 * @class
 */
class BasicenvironmentService {

    // constructor(ctx) {
    //     super(ctx);
    // }

    async getbasicEnvList(){
        const node_versios = await getnode.getLocalSimpleVersionsList()
        // console.log(`node_versios`,node_versios)
        const langs = [{
            name: "node.js",
            defaultVersion: "18.6",
            currentVersion: "18.6",
            versions: node_versios,
            icon: `node.js.png`,
            borderColor: "#00FF00",
            nodeJS: true,
            description: "Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行环境。"
        },
        ];
        const isWsl2 = await win.isWSL2Enabled()
        return {
            langs,
            isWsl2: isWsl2
        }
    }

}

BasicenvironmentService.toString = () => '[class BasicenvironmentService]';
module.exports = BasicenvironmentService;



