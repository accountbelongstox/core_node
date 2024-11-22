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

    Object.keys(voiceFiles).forEach((key, index) => {
      const value = voiceFiles[key];
      let { content_len, iterate_name, dynamic_url, url, save_filename, ...newValue } = value;
      if (!iterate_name) iterate_name = ``
      if (!save_filename) save_filename = ``
      const voicetype = iterate_name.split(/\s+/)[0]
      newValue[`vtype`] = voicetype;
      newValue[`from`] = url || ``;
      newValue[`file`] = path.basename(save_filename);
      let newKey = key.startsWith('http') ? `url${index}` : key
      newVoiceFiles[newKey] = newValue;
    });

    return newVoiceFiles;
  }

  transformSampleImagesFiles(voiceFiles) {
    const newVoiceFiles = {};
    Object.keys(voiceFiles).forEach((key, index) => {
      const value = voiceFiles[key];
      let { content_len, url, save_filename, dynamic_url, ...newValue } = value;
      if (!save_filename) save_filename = ``
      newValue[`from`] = url || ``;
      newValue[`file`] = path.basename(save_filename);
      let newKey = key.startsWith('http') ? `url${index}` : key
      newVoiceFiles[newKey] = newValue;
    });

    return newVoiceFiles;
  }

  isValidVoiceFile(obj) {
    if (obj.voice_files) {
      const voiceFile = obj.voice_files;
      if (typeof voiceFile === 'object' && voiceFile !== null) {
        for (const key in voiceFile) {
          const fileObj = voiceFile[key];
          if (typeof fileObj === 'object' && fileObj !== null && 'file' in fileObj && fileObj.file) {
            return true;
          }
        }
      }
    }
    return false;
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
      let voice_files = this.transformVoiceFiles(translation.voice_files);
      delete translation.voice_files
      translation.voice_files = voice_files
    }
    if (translation.sample_images) {
      translation.sample_images = this.transformSampleImagesFiles(translation.sample_images);
    }
    if (Array.isArray(translation.advanced_translate_type)) {
      translation.advanced_translate_type = translation.advanced_translate_type.map((item) => {
        if (typeof item === 'string') {
          return item.replace(/<[^>]*>/g, '');
        }
        return item;
      });
    }
    if (Array.isArray(translation.synonyms_type)) {
      translation.synonyms_type = translation.synonyms_type.map((item) => {
        if (typeof item === 'string') {
          return item.replace(/<[^>]*>/g, '');
        }
        return item;
      });
    }

    return translation
  }

  async start() {
    const batchSize = 500000;
    let offset = 0;
    let totalRead = 0;

    mysqlPub.setDebug(false);

    const data = await mysqlPub.readMany('dictionaries', {}, [offset, offset + batchSize]);
    const dataCount = data.length;

    const transformedData = data;

    transformedData.forEach(async (item, index) => {
      let translation = this.toJSON(item.translation)
      translation = this.translationsTrim(translation)
      // console.log(`translation`, translation);
      item.translation = JSON.stringify(translation)
      let isVoiceFile = this.isValidVoiceFile(translation)
      // if (!isVoiceFile) {
      //   console.log(`index ${index}, ${item.word} The translation object is invalid.`);
      //   console.log(translation.voice_files)
      // }
      let updateData = {
        translation: translation
      }
      let conditions = {
        id: item.id
      }
      await mysqlPub.updateOne('dictionaries', updateData, conditions);
      console.log(`index ${index}, word ${item.word}`);
    });

    totalRead += dataCount;
    offset += batchSize;

    console.log(`Read ${dataCount} records from offset ${offset - batchSize}`);

    // Optionally trigger garbage collection
    // if (global.gc) {
    //   global.gc();
    // }

    console.log(`Total records read: ${totalRead}`);
    console.log('All records processed.');
  }
}

const clientMain = new ClientMain();
clientMain.start();
