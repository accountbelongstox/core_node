import path from 'path';
import Base from '#@base';
import { format } from 'date-fns';
import { mysqlPub } from '#@db';
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

  toJSON(item) {
    if (item) {
      try {
        item = JSON.parse(item)
        return item
      } catch (e) {
        console.error(`-------------------`)
        console.log(e)
        console.error(item)
        console.error(`-------------------`)
      }
      return {}
    }
    return {}
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

  transformVoiceFiles(voiceFiles) {
    const newVoiceFiles = {};
    let urlCounter = 1;

    Object.keys(voiceFiles).forEach(key => {
      const value = voiceFiles[key];
      let { content_len, iterate_name, dynamic_url, url, save_filename, ...newValue } = value;
      if (!iterate_name) iterate_name = ``
      if (!save_filename) save_filename = ``
      const filesections = save_filename.split(`/`)
      const voicetype = iterate_name.split(/\s+/)[0]
      newValue[`vtype`] = voicetype;
      newValue[`from`] = url;
      newValue[`file`] = filesections[filesections.length - 1];
      if (key.startsWith('http')) {
        newVoiceFiles[`url${urlCounter}`] = newValue;
        urlCounter++;
      } else {
        newVoiceFiles[key] = newValue;
      }
    });

    return newVoiceFiles;
  }

  transformSampleImagesFiles(voiceFiles) {
    const newVoiceFiles = {};
    let urlCounter = 1;

    Object.keys(voiceFiles).forEach(key => {
      const value = voiceFiles[key];
      let { content_len, url, save_filename, dynamic_url, ...newValue } = value;
      if (!save_filename) save_filename = ``
      const filesections = save_filename.split(`/`)
      newValue[`from`] = url;
      newValue[`file`] = filesections[filesections.length - 1];
      if (key.startsWith('http')) {
        newVoiceFiles[`url${urlCounter}`] = newValue;
        urlCounter++;
      } else {
        newVoiceFiles[key] = newValue;
      }
    });

    return newVoiceFiles;
  }

  translationsTrim(translation) {
    if (translation.word_sort) {
      delete translation.word_sort
    }
    if (translation.word_translation) {
      translation.translation = translation.word_translation
      delete translation.word_translation
    }
    if (translation.phonetic_symbol) {
      delete translation.phonetic_symbol
    }
    if (translation.voice_files) {
      translation.voice_files = this.transformVoiceFiles(translation.voice_files);
    }
    if (translation.sample_images) {
      translation.sample_images = this.transformSampleImagesFiles(translation.sample_images);
    }
    if (Array.isArray(translation.advanced_translate_type)) {
      translation.advanced_translate_type = translation.advanced_translate_type.map((item) => {
        if (typeof item === 'string') {
          return item.replace(/<[^>]*>/g, '');
        }
        return item; // If it's not a string, return it as it is
      });
    }
    if (Array.isArray(translation.synonyms_type)) {
      translation.synonyms_type = translation.synonyms_type.map((item) => {
        if (typeof item === 'string') {
          return item.replace(/<[^>]*>/g, '');
        }
        return item; // If it's not a string, return it as it is
      });
    }

    return translation
  }

  async start() {
    const batchSize = 100; // Reduce batch size to limit memory usage
    let offset = 0;
    let totalRead = 0;
    let moreDataAvailable = true;

    mysqlPub.setDebug(false);


    const data = await mysqlPub.readMany('dictionaries', {}, [offset, offset + batchSize]);
    const dataCount = data.length;

    const transformedData = data;

    transformedData.forEach(async (item,index) => {
      let translation = this.toJSON(item.translation)
    //   translation = this.translationsTrim(translation)
    //   item.translation = translation
    //   let updateData = {
    //     translation : translation
    //     // locale: `en`
    //   }
      let conditions = {
        id: item.id
      }
    //   await mysqlPub.updateOne('dictionaries', updateData, conditions);
      console.log(`translation`,translation);
      console.log(`index`,index);
    });

    totalRead += dataCount;
    offset += batchSize;

    console.log(`Read ${dataCount} records from offset ${offset - batchSize}`);

    // Optionally trigger garbage collection
    if (global.gc) {
      global.gc();
    }

    console.log(`Total records read: ${totalRead}`);
    console.log('All records processed.');
  }
}

const clientMain = new ClientMain();
clientMain.start();
