// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const mysqlClass = require('./util/db_tool/libs/mysql.js');
    const sqliteClass = require('./util/db_tool/libs/sqlite.js');
    const { appname, env, appenv } = require('#@global_vars');

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