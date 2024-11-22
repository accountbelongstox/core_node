import path from 'path';
import Base from '#@base';
import { format } from 'date-fns';
import { mysqlPub, sqlitePub } from '#@db';
import { basedir } from './ncore/globalvars.js';

class ClientMain extends Base {
  static NCORE_DIR = './';
  static distDir = path.resolve(basedir, ClientMain.NCORE_DIR);

  constructor() {
    super();
  }

  convertToMysqlDatetime(timestamp) {
    if (!timestamp) return null;

    const date = typeof timestamp === 'number'
      ? new Date(timestamp)
      : new Date(timestamp);

    return format(date, 'yyyy-MM-dd HH:mm:ss');
  }

  transformItems(items) {
    return items.map(item => {
      const { locale, id, created_at, updated_at, published_at, is_delete, ...rest } = item;
      return {
        ...rest,
        created_at: this.convertToMysqlDatetime(created_at),
        updated_at: this.convertToMysqlDatetime(updated_at),
        published_at: this.convertToMysqlDatetime(published_at),
        is_delete: is_delete === 1 || is_delete === "1",
      };
    });
  }

  async start() {
    const batchSize = 20000; // Reduce batch size to limit memory usage
    let offset = 0;
    let totalRead = 0;
    let moreDataAvailable = true;
    mysqlPub.setDebug(false);

    while (moreDataAvailable) {
      const data = await sqlitePub.readMany('dictionaries', {}, [offset, offset + batchSize]);
      const dataCount = data.length;

      if (dataCount === 0) {
        moreDataAvailable = false;
      } else {
        totalRead += dataCount;
        offset += batchSize;

        const transformedData = this.transformItems(data);
        await mysqlPub.insertMany('dictionaries', transformedData);

        console.log(`Read ${dataCount} records from offset ${offset - batchSize}`);

        // Optionally trigger garbage collection
        if (global.gc) {
          global.gc();
        }
      }
    }

    console.log(`Total records read: ${totalRead}`);
  }
}

const clientMain = new ClientMain();
clientMain.start();
