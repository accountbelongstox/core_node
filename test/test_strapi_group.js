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
        let offset = 319150/2 - 1;
        let totalRead = 0;
        let sqlitePub = new sqliteClass('D:/programing/strapi_api_database/dataCopy.db');
    
        let data = await sqlitePub.readMany('dictiongroups', {});
        const dataCount = data.length;
        console.log(`offset ${offset} - ${dataCount}`);
        let sliceData = data.slice(offset, dataCount);
        sliceData.forEach(async (item) => {
            let valid_word= JSON.parse(item.valid_word)
            let valid_word_count = valid_word.length
            // Dynamically map item values to organizedData fields
            const organizedData = {
                data:{
                    name: item.name,
                    namespace: item.namespace,
                    gtp: item.gtp,
                    winclude: item.winclude,
                    winclude_count: item.winclude_count,
                    origin_text: item.origin_text,
                    invalid_word_count: (JSON.parse(item.invalid_word)).length,
                    wfrequency: item.wfrequency,
                    wlink: item.wlink,
                    valid_word: item.valid_word,
                    valid_word_count: valid_word_count,
                    invalid_word: item.invalid_word
                }
            };
            console.log(organizedData);
            await this.pushMockData(organizedData);
    
            
        });
    
        totalRead += dataCount;
        offset += batchSize;
        console.log(`Read ${dataCount} records from offset ${offset - batchSize}`);
    
        if (global.gc) {
            global.gc();
        }
        console.log(`Total records read: ${totalRead}`);
    }
    

    async pushMockData(data) {
        const response = await strapi_v4_net.pushData('dictgroups', data);
        console.log('Data successfully pushed:', response);
    }
}

const clientMain = new ClientMain();
clientMain.start();
