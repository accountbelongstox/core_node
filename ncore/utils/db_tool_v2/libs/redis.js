const redis = require('redis');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

let globalDb = null;

class Redis {
  static con = null;
  static pipe = null;
  static pre = "redis_";
  static publishChannel = "redis_data_sync";
  static processSubscribe = null;
  static unserializeLength = 10000;
  static baseTable = [];

  constructor(args) {
    // Constructor logic, if needed
  }

  async main(args) {
    await this.connect();
    const pubsub = this.con.duplicate();
    pubsub.subscribe(this.publishChannel);
    console.log(`Subscribed to '${this.publishChannel}' channel.`);
    pubsub.on('message', (channel, message) => {
      if (channel === this.publishChannel) {
        this.processPublishedData(JSON.parse(message));
      }
    });
  }

  async connect() {
    if (!Redis.con) {
      const username = process.env.REDIS_USER || null;
      const host = process.env.REDIS_HOST || 'localhost';
      const db = process.env.REDIS_DB || 0;
      const port = process.env.REDIS_PORT || 6379;
      const password = process.env.REDIS_PASSWORD || null;

      let authInfo = '';
      if (username && password) {
        authInfo = `${username}:${password}@`;
      } else if (password) {
        authInfo = `:${password}@`;
      }
      const url = `redis://${authInfo}${host}:${port}/${db}`;

      Redis.con = redis.createClient(url);
    }
    return Redis.con;
  }

  async close() {
    if (Redis.pipe) {
      await Redis.pipe.reset();
    }
    Redis.con.quit();
  }

  getPipeline() {
    Redis.pipe = Redis.con.duplicate();
    return Redis.pipe;
  }

  async exec() {
    if (!Redis.pipe) {
      console.warn("Pipeline is not initialized. Call 'pipeline()' method first.");
      return;
    }
    return await Redis.pipe.exec();
  }

  getPrefixDbname(dbname) {
    return `${this.pre}${dbname}`;
  }

  async getTables() {
    // Redis does not have direct table-like structure, use keys instead
    return await promisify(Redis.con.keys).bind(Redis.con)('*');
  }

  async isTable(tabname) {
    const keys = await this.getTables();
    return keys.includes(tabname);
  }

  async isColumn(tabname, key) {
    const elements = await promisify(Redis.con.lrange).bind(Redis.con)(tabname, 0, -1);
    const deserializedData = elements.map(element => JSON.parse(element));
    return deserializedData.some(element => element.hasOwnProperty(key));
  }

  async getTableType(tabname) {
    return await promisify(Redis.con.type).bind(Redis.con)(tabname);
  }

  registerSubscribe(processSubscribe) {
    Redis.processSubscribe = processSubscribe;
  }

  processPublishedData(message) {
    const { tabname, data } = message;
    if (Redis.processSubscribe) {
      Redis.processSubscribe(tabname, data);
    }
  }

  async serializeAndSave(outputFile = 'backup.json') {
    const backupData = {};
    const tables = await this.getTables();

    for (const table of tables) {
      const tableType = await this.getTableType(table);
      switch (tableType) {
        case 'string':
          backupData[table] = await promisify(Redis.con.get).bind(Redis.con)(table);
          break;
        case 'list':
          backupData[table] = await promisify(Redis.con.lrange).bind(Redis.con)(table, 0, -1);
          break;
        case 'set':
          backupData[table] = Array.from(await promisify(Redis.con.smembers).bind(Redis.con)(table));
          break;
        case 'zset':
          backupData[table] = await promisify(Redis.con.zrange).bind(Redis.con)(table, 0, -1, 'WITHSCORES');
          break;
        case 'hash':
          backupData[table] = await promisify(Redis.con.hgetall).bind(Redis.con)(table);
          break;
        default:
          console.warn(`Unsupported table type: ${tableType}`);
      }
    }
    fs.writeFileSync(outputFile, JSON.stringify(backupData));
  }

  unserializeMaptables(inputStr) {
    const [tableName, fieldName] = inputStr.split(":")[1].split("->");
    // Add logic to read from MySQL or other database
    return [];
  }

  async getUnserializeData(table, config) {
    // Add logic to retrieve data from a database
    return [];
  }

  equalUnserializeConfig(tabname, unserializeConfig) {
    const fixedTabname = this.getFixedTabname(tabname);
    const tabnameEq = tabname.replace(this.pre, '');
    for (const [configTabname, value] of Object.entries(unserializeConfig)) {
      if (tabnameEq === configTabname || fixedTabname === configTabname || tabname === configTabname) {
        return value;
      }
    }
    return null;
  }

  getUnserializeConfig(tabname, config) {
    const unserializeConfig = {
      where: {},
      length: this.unserializeLength,
      select: "*",
      unique: false
    };
    if (config) {
      for (const [key, value] of Object.entries(config)) {
        if (unserializeConfig.hasOwnProperty(key)) {
          unserializeConfig[key] = value;
        }
      }
      if (unserializeConfig.length === "all") {
        unserializeConfig.limit = null;
      } else {
        unserializeConfig.limit = [0, parseInt(unserializeConfig.length, 10)];
      }
      for (const [key, value] of Object.entries(unserializeConfig.where)) {
        let queryValue = value.split("->")[1].trim();
        if (queryValue === "query_value") {
          unserializeConfig.where[key] = tabname;
        }
      }
    }
    return unserializeConfig;
  }

  async unserializeByLocal() {
    // Add logic to unserialize data based on the local configuration
  }

  async save(tabname, data) {
    if (!tabname || !data) {
      console.warn("Invalid arguments: 'tabname' must be a string and 'data' must not be empty.");
      return;
    }
    const tableExists = await this.isTable(tabname);
    let tableType;
    if (tableExists) {
      tableType = await this.getTableType(tabname);
    } else {
      if (Array.isArray(data)) {
        tableType = 'list';
      } else if (data instanceof Set) {
        tableType = 'set';
      } else if (typeof data === 'object') {
        tableType = 'hash';
      } else {
        console.warn("Invalid data type: 'data' must be an array, set, or object.");
        return;
      }
    }

    switch (tableType) {
      case 'list':
        await this.saveList(tabname, data);
        break;
      case 'set':
        await this.saveSet(tabname, data);
        break;
      case 'hash':
        await this.saveHash(tabname, data);
        break;
      default:
        console.warn("Unsupported key type: only 'list', 'set', and 'hash' are supported.");
    }
  }

  async saveSet(tabname, data) {
    if (!tabname || !data || typeof data !== 'object') {
      console.warn("Invalid arguments: 'tabname' must be a string and 'data' must be a non-empty object.");
      return;
    }
    for (const [key, value] of Object.entries(data)) {
      const subTableName = `${tabname}:${key}`;
      const serializedValue = JSON.stringify(value);
      await promisify(Redis.con.set).bind(Redis.con)(subTableName, serializedValue);
      this.publishData(tabname, serializedValue);
    }
  }

  async saveList(tabname, data, unique = false, max = null) {
    if (!tabname || !Array.isArray(data)) {
      console.warn("Invalid arguments: 'tabname' must be a string and 'data' must be a non-empty array.");
      return;
    }
    if (typeof data === 'string') {
      data = [data];
    }
    const pipe = this.getPipeline();
    for (const value of data) {
      const serializedValue = JSON.stringify(value);
      if (unique) {
        const existingValues = await promisify(Redis.con.lrange).bind(Redis.con)(tabname, 0, -1);
        if (existingValues.includes(serializedValue)) continue;
      }
      if (max !== null) {
        const currentLength = await promisify(Redis.con.llen).bind(Redis.con)(tabname);
        if (currentLength >= max) {
          await promisify(Redis.con.lpop).bind(Redis.con)(tabname);
        }
      }
      pipe.rpush(tabname, serializedValue);
      this.publishData(tabname, serializedValue);
    }
    await pipe.exec();
  }

  async saveHash(tabname, data) {
    if (!tabname || !data || typeof data !== 'object') {
      console.warn("Invalid arguments: 'tabname' must be a string and 'data' must be a non-empty object.");
      return;
    }
    const serializedData = {};
    for (const [key, value] of Object.entries(data)) {
      serializedData[key] = JSON.stringify(value);
    }
    await promisify(Redis.con.hmset).bind(Redis.con)(tabname, serializedData);
    this.publishData(tabname, serializedData);
  }

  async publishData(tabname, data) {
    const pubClient = redis.createClient();
    pubClient.publish(this.publishChannel, JSON.stringify({ tabname, data }));
    pubClient.quit();
  }

  async flushAll() {
    await promisify(Redis.con.flushall).bind(Redis.con)();
  }

  getFixedTabname(tabname) {
    return tabname.replace(/^redis_/, '');
  }
}

module.exports = Redis;
