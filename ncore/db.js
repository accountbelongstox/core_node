const mysqlClass = require('./util/db_tool/libs/mysql.js');
    const sqliteClass = require('./util/db_tool/libs/sqlite.js');
    const { appname, env, appenv } = require('./globalvars.js');

    // Initialize MySQL and SQLite instances
    let mysql = {};
    let sqlite = {};
    let mysqlPub = {};
    let sqlitePub = {};

    // Function to check if an environment variable is defined and not empty
    const isEnvVarValid = (key) => {
      const value = env.getEnv(key);
      return value && value.trim() !== '';
    };

    // Check if all required MySQL environment variables are valid
    const mysqlEnvVars = [
      'MYSQL_HOST',
      'MYSQL_PORT',
      'MYSQL_DB',
      'MYSQL_USER',
      'MYSQL_PWD'
    ];
    const sqliteEnvVars = [
      'SQLITE_DB',
    ];
    const allMysqlEnvVarsValid = mysqlEnvVars.every(isEnvVarValid);
    if (allMysqlEnvVarsValid) {
      mysqlPub = new mysqlClass(env);
    }

    const allSqliteEnvVarsValid = sqliteEnvVars.every(isEnvVarValid);
    if (allSqliteEnvVarsValid) {
      sqlitePub = new sqliteClass(env);
    }

    module.exports = {
      mysql,
      sqlite,
      mysqlPub,
      sqlitePub,
      mysqlClass,
      sqliteClass,
    };