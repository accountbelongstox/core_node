import path from 'path';
import Base from '#@base';
import { basedir } from './ncore/globalvars.js';
import { mysqlPub, sqliteClass } from '#@db';
import { strapi_v4_net } from '#@utils';

class ClientMain extends Base {
    static NCORE_DIR = './';
    static distDir = path.resolve(basedir, ClientMain.NCORE_DIR);

    constructor() {
        super();
    }

    async start() {
        const batchSize = 200000;
        let offset = (319150/2) - 1;
        let totalRead = 0;
        let sqlitePub = new sqliteClass('D:/programing/strapi_api_database/dataCopy.db');
    
        let jwt = await strapi_v4_net.getJwt();
        if (!jwt) {
            let login_data = await strapi_v4_net.login('testuser', '123456');
            console.log(login_data);
        }
    

        const data = await sqlitePub.readMany('dictionaries', {},[0,200000]);
        const dataCount = data.length;
        console.log(`offset ${offset} - ${dataCount}`);
        let sliceData = data.slice(offset, dataCount);


        const organizedDataList = sliceData.map(item => ({
            word: item.word,
            phonetic_us: item.phonetic_us,
            phonetic_uk: item.phonetic_uk,
            translation: item.translation,
            is_delete: !!item.is_delete,
            provider:'bing'
        }));
        const organizedData = {
            data : organizedDataList
        }  

        console.log(`Push-length ${organizedData.data.length} `);

        await this.pushMockData(organizedData);

        totalRead += dataCount;
        offset += batchSize;

        if (global.gc) {
            global.gc();
        }

        console.log(`Total records read: ${totalRead}`);
    }
    

    async pushMockData(data) {
        const response = await strapi_v4_net.pushData('dictionaries', data);
        console.log('Data successfully pushed:', response);
    }
}

const clientMain = new ClientMain();
clientMain.start();
