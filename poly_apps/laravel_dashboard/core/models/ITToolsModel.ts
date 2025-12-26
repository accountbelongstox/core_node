import { api } from '../api';
import { BaseModel } from './BaseModel';

export class ITToolsModel extends BaseModel {
  private static instance: ITToolsModel;

  private constructor() {
    super();
  }

  static getInstance(): ITToolsModel {
    if (!ITToolsModel.instance) {
      ITToolsModel.instance = new ITToolsModel();
    }
    return ITToolsModel.instance;
  }

  // Crypto namespace
  crypto = {
    hash: (text: string, algorithm: string) =>
      this.execute(api.itToolsV1.hashText({ text, algorithm })),

    bcrypt: {
      hash: (password: string, rounds?: number) =>
        this.execute(api.itToolsV1.bcryptHash({ password, rounds })),
      verify: (password: string, hash: string) =>
        this.execute(api.itToolsV1.bcryptVerify({ password, hash }))
    },

    uuid: (count: number = 1, uppercase?: boolean) =>
      this.execute(api.itToolsV1.generateCryptoUuid({ count, uppercase } as any)),

    ulid: (count: number = 1) =>
      this.execute(api.itToolsV1.generateUlid()),

    token: (length?: number, charset?: string, includeSymbols?: boolean) =>
      this.execute(api.itToolsV1.generateCryptoToken({ length } as any)),

    rsa: (keySize?: number, format?: string) =>
      this.execute(api.itToolsV1.generateRsaKeyPair({ keySize, format })),

    bip39: (strength?: number, count?: number) =>
      this.execute(api.itToolsV1.generateBip39({ strength, count })),

    otp: {
      generate: (secret?: string, period?: number, digits?: number) =>
        this.execute(api.itToolsV1.generateOtp({ secret } as any)),
      verify: (otp: string, secret: string, period?: number, digits?: number) =>
        this.execute(api.itToolsV1.verifyOtp({ otp, secret } as any))
    },

    hmac: (text: string, secret: string, algorithm: string) =>
      this.execute(api.itToolsV1.generateHmac({ text, secret, algorithm })),

    encrypt: (text: string, key: string, algorithm?: string) =>
      this.execute(api.itToolsV1.encrypt({ text, key, algorithm })),

    decrypt: (encrypted: string, key: string, algorithm?: string) =>
      this.execute(api.itToolsV1.decrypt({ text: encrypted, key, algorithm }))
  };

  // Converter namespace
  converter = {
    base64: {
      encode: (text: string) => this.execute(api.itToolsV1.base64Encode({ text })),
      decode: (text: string) => this.execute(api.itToolsV1.base64Decode({ text }))
    },

    url: {
      encode: (text: string) => this.execute(api.itToolsV1.urlEncode({ text })),
      decode: (text: string) => this.execute(api.itToolsV1.urlDecode({ text }))
    },

    json: {
      prettify: (json: string, indent?: number) =>
        this.execute(api.itToolsV1.jsonPrettify({ json, indent })),
      minify: (json: string) =>
        this.execute(api.itToolsV1.jsonMinify({ json })),
      toYaml: (json: string) =>
        this.execute(api.itToolsV1.jsonToYaml({ json })),
      toXml: (json: string) =>
        this.execute(api.itToolsV1.jsonToXml({ json })),
      toCsv: (json: string) =>
        this.execute(api.itToolsV1.jsonToCsv({ json }))
    },

    yaml: {
      toJson: (yaml: string) =>
        this.execute(api.itToolsV1.yamlToJson({ yaml }))
    },

    xml: {
      toJson: (xml: string) =>
        this.execute(api.itToolsV1.xmlToJson({ xml }))
    },

    color: (color: string, from: string, to: string) =>
      this.execute(api.itToolsV1.convertColorConverter({ color, from, to })),

    base: (number: string, from: number, to: number) =>
      this.execute(api.itToolsV1.convertBase({ number, from, to })),

    temperature: (value: number, from: string, to: string) =>
      this.execute(api.itToolsV1.convertTemperature({ value, from, to }))
  };

  // Text namespace
  text = {
    statistics: (text: string) =>
      this.execute(api.itToolsV1.textStatistics({ text })),

    regex: (text: string, pattern: string, flags?: string) =>
      this.execute(api.itToolsV1.regexTest({ text, pattern, flags })),

    loremIpsum: (paragraphs?: number, words?: number) =>
      this.execute(api.itToolsV1.loremIpsum({ paragraphs, words })),

    diff: (text1: string, text2: string) =>
      this.execute(api.itToolsV1.textDiff({ text1, text2 }))
  };

  // Math namespace
  math = {
    evaluate: (expression: string) =>
      this.execute(api.itToolsV1.mathEvaluate({ expression })),

    percentage: (value: number, total: number) =>
      this.execute(api.itToolsV1.calculatePercentage({ value, total }))
  };

  // Web namespace
  web = {
    qrCode: (text: string, size?: number) =>
      this.execute(api.itToolsV1.generateQrCode({ text, size }))
  };

  // Network namespace
  network = {
    ipv4Subnet: (ip: string, cidr: number) =>
      this.execute(api.itToolsV1.ipv4Subnet({ ip, cidr })),

    macGenerate: () =>
      this.execute(api.itToolsV1.generateMacAddress())
  };

  // Legacy aliases for backward compatibility (deprecated)
  hashText = this.crypto.hash;
  bcryptHash = this.crypto.bcrypt.hash;
  bcryptVerify = this.crypto.bcrypt.verify;
  generateUuid = this.crypto.uuid;
  generateUlid = this.crypto.ulid;
  generateToken = this.crypto.token;
  generateRsaKeyPair = this.crypto.rsa;
  generateBip39 = this.crypto.bip39;
  generateOtp = this.crypto.otp.generate;
  verifyOtp = this.crypto.otp.verify;
  generateHmac = this.crypto.hmac;
  encrypt = this.crypto.encrypt;
  decrypt = this.crypto.decrypt;
  base64Encode = this.converter.base64.encode;
  base64Decode = this.converter.base64.decode;
  urlEncode = this.converter.url.encode;
  urlDecode = this.converter.url.decode;
  jsonPrettify = this.converter.json.prettify;
  jsonMinify = this.converter.json.minify;
  jsonToYaml = this.converter.json.toYaml;
  yamlToJson = this.converter.yaml.toJson;
  convertColor = this.converter.color;
  convertBase = this.converter.base;
  convertTemperature = this.converter.temperature;
  textStatistics = this.text.statistics;
  regexTest = this.text.regex;
  loremIpsum = this.text.loremIpsum;
  mathEvaluate = this.math.evaluate;
  calculatePercentage = this.math.percentage;
  generateQrCode = this.web.qrCode;
  ipv4Subnet = this.network.ipv4Subnet;
  generateMacAddress = this.network.macGenerate;
}

export const itToolsModel = ITToolsModel.getInstance();
