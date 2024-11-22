import path from 'path';

/**
 * Configuration for the EE application
 * @param {Object} appInfo - Information about the application
 * @returns {Object} The configuration object
 * @class Config
 * @since 1.0.0
 */
const createConfig = (appInfo) => {
  const config = {
    /**
     * The environment of EE
     * @member {String} Config#env
     * @see {appInfo#env}
     * @since 1.0.0
     */
    env: appInfo.env,

    /**
     * The name of the application
     * @member {String} Config#name
     * @see {appInfo#name}
     * @since 1.0.0
     */
    name: appInfo.name,

    /**
     * The current directory of the application
     * @member {String} Config#baseDir
     * @see {appInfo#baseDir}
     * @since 1.0.0
     */
    baseDir: appInfo.baseDir,

    /**
     * The current HOME directory
     * @member {String} Config#HOME
     * @see {appInfo#HOME}
     * @since 1.0.0
     */
    HOME: appInfo.home,

    /**
     * The directory of the server running
     * @member {String} Config#rundir
     * @default
     * @since 1.0.0
     */
    rundir: path.join(appInfo.baseDir, 'run'),

    /**
     * Dump config
     * @member {Object} Config#dump
     * @property {Set} ignore - Keys to ignore
     */
    dump: {
      ignore: new Set([
        'pass', 'pwd', 'passd', 'passwd', 'password', 'keys', 'masterKey', 'accessKey',
        // Ignore any key containing the "secret" keyword
        /secret/i,
      ]),
    },

    /**
     * Application home directory
     * @member {String} Config#homeDir
     * @default
     * @since 1.0.0
     */
    homeDir: appInfo.home,

    /**
     * Application data & logs directory by environment
     * @member {String} Config#root
     * @default
     * @since 1.0.0
     */
    root: appInfo.root,

    /**
     * Application data directory
     * @member {String} Config#appUserDataDir
     * @default
     * @since 1.0.0
     */
    appUserDataDir: appInfo.appUserDataDir,

    /**
     * System user home directory
     * @member {String} Config#userHome
     */
    userHome: appInfo.userHome,

    /**
     * Application version
     * @member {String} Config#appVersion
     */
    appVersion: appInfo.appVersion,

    /**
     * Application package status
     * @member {boolean} Config#isPackaged
     */      
    isPackaged: appInfo.isPackaged,

    /**
     * Application executable file directory
     * @member {String} Config#execDir
     */  
    execDir: appInfo.execDir,
    
    /**
     * Logger options
     * @member {Object} Config#logger
     * @property {String} dir - Directory of log files
     * @property {String} encoding - Log file encoding, defaults to utf8
     * @property {String} level - Default log level, could be: DEBUG, INFO, WARN, ERROR or NONE, defaults to INFO in production
     * @property {String} consoleLevel - Log level of stdout
     * @property {Boolean} disableConsoleAfterReady - Disable logger console after app ready
     * @property {Boolean} outputJSON - Log as JSON or not
     * @property {Boolean} buffer - If enabled, flush logs to disk at a certain frequency
     * @property {String} errorLogName - File name of error logger
     * @property {String} coreLogName - File name of core logger
     * @property {String} agentLogName - File name of agent worker log
     * @property {Object} coreLogger - Custom config of core logger
     * @property {Boolean} allowDebugAtProd - Allow debug log at production
     * @property {Boolean} enablePerformanceTimer - Use performance.now() for more precise milliseconds
     */
    logger: {
      type: 'application',
      dir: path.join(appInfo.root, 'logs'),
      encoding: 'utf8',
      env: appInfo.env,
      level: 'INFO',
      consoleLevel: 'INFO',
      disableConsoleAfterReady: appInfo.env !== 'local' && appInfo.env !== 'unittest',
      outputJSON: false,
      buffer: true,
      appLogName: 'ee.log',
      coreLogName: 'ee-core.log',
      agentLogName: 'ee-agent.log',
      errorLogName: 'ee-error.log',
      coreLogger: {},
      allowDebugAtProd: false,
      enablePerformanceTimer: false,
      rotator: 'none',
    },

    /**
     * Custom logger options
     * @member {Object} Config#customLogger
     */
    customLogger: {},

    /**
     * HTTP client options
     * @member {Object} Config#httpclient
     * @property {Boolean} enableDNSCache - Enable DNS lookup from local cache
     * @property {Number} dnsCacheLookupInterval - Minimum interval of DNS query on the same hostname
     * @property {Number} request.timeout - HTTP client request default timeout
     * @property {Object} httpAgent - Options for HTTP agent
     * @property {Object} httpsAgent - Options for HTTPS agent
     */
    httpclient: {
      enableDNSCache: false,
      dnsCacheLookupInterval: 10000,
      dnsCacheMaxLength: 1000,
      request: {
        timeout: 5000,
      },
      httpAgent: {
        keepAlive: true,
        freeSocketTimeout: 4000,
        maxSockets: Number.MAX_SAFE_INTEGER,
        maxFreeSockets: 256,
      },
      httpsAgent: {
        keepAlive: true,
        freeSocketTimeout: 4000,
        maxSockets: Number.MAX_SAFE_INTEGER,
        maxFreeSockets: 256,
      },
    },

    /**
     * Application mode configuration
     * @member {Object} Config#developmentMode
     */
    developmentMode: {
      default: 'vue',
      mode: {
        vue: {
          protocol: 'http://',
          hostname: 'localhost',
          port: 8080,
        },
        react: {
          protocol: 'http://',
          hostname: 'localhost',
          port: 3000,
        },
        html: {
          protocol: 'http://',
          hostname: 'localhost',
          indexPage: 'index.html',
        },
      },
    },

    /**
     * Built-in socket server
     * @member {Object} Config#socketServer
     */
    socketServer: {
      enable: false,
      port: 7070,
      path: '/socket.io/',
      connectTimeout: 45000,
      pingTimeout: 30000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8,
      transports: ['polling', 'websocket'],
      cors: {
        origin: true,
      },
    },

    /**
     * Built-in HTTP server
     * @member {Object} Config#httpServer
     */
    httpServer: {
      enable: false,
      https: {
        enable: false,
        key: '',
        cert: '',
      },
      protocol: 'http://',
      host: 'localhost',
      port: 7071,
      cors: {
        origin: '*',
      },
      body: {
        multipart: true,
      },
      filterRequest: {
        uris: [],
        returnData: '',
      },
    },

    /**
     * Main process loading address
     * @member {Object} Config#mainServer
     */
    mainServer: {
      protocol: 'file://',
      indexPath: '/public/dist/index.html',
      host: 'localhost',
      port: 7072,
      options: {},
      ssl: {
        key: '',
        cert: '',
      },
    },

    /**
     * Application top menu
     * @member {boolean|string} Config#openAppMenu
     */
    openAppMenu: true,

    /**
     * Hardware acceleration
     * @member {Object} Config#hardGpu
     */
    hardGpu: {
      enable: true,
    },

    /**
     * Storage configuration
     * @member {Object} Config#storage
     */
    storage: {
      dir: path.join(appInfo.root, 'data'),
    },

    /**
     * Addons configuration
     * @member {Object} Config#addons
     */
    addons: {
      window: {
        enable: true,
      },
    },

    /**
     * Exception handling configuration
     * @member {Object} Config#exception
     */
    exception: {
      mainExit: false,
      childExit: true,
      rendererExit: true,
    },

    /**
     * Cross-language service configuration
     * @member {Object} Config#cross
     */
    cross: {},

    /**
     * Jobs configuration
     * @member {Object} Config#jobs
     */
    jobs: {},

    /**
     * Interceptor configuration
     * @member {Object} Config#interceptor
     */
    interceptor: {},
  };

  return config;
};

export default createConfig;
