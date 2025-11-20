# from pycore.dbmode.sqlitedb import SQLiteDB
from pycore.dbmode.sqlite import Sqlite
from pycore.dbmode.mysql import MySQL
# from pycore.dbmode.mysqldb import MySQLDB
from pycore.globalvers import appenv,sysid,systoken
from pycore.utils_linux import file
# print("appenv",appenv)
# sqlite = SQLiteDB(appenv)
# mysql = MySQLDB(appenv)

print("sysid",sysid)
print("systoken",systoken)
sqlite = Sqlite(appenv)
mysql = MySQL(appenv)
# mysql = MySQLDB(appenv)