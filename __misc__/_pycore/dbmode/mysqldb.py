import json
import os
from typing import Dict, List, Union, Tuple
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from pycore.globalvers import appenv, appdir
from pycore.dbmode.baseclass.dbbase import DBBase
from pycore.utils_linux import file

SQLALCHEMYBase = declarative_base()

class MySQLDB(DBBase):
    def __init__(self, appenv_or_dburl: str, config_file: str = 'db_config.json'):
        self.db_url = self.get_db_url_from_config(appenv_or_dburl)
        self.engine = create_engine(self.db_url)
        self.Session = sessionmaker(bind=self.engine)

    def get_db_url_from_config(self, appenv_or_dburl):
        if isinstance(appenv_or_dburl, str):
            return appenv_or_dburl
        appenv = appenv_or_dburl
        db_config = {
            'mysql_user': appenv.get_env('MYSQL_USER', None),
            'mysql_pwd': appenv.get_env('MYSQL_PWD', None),
            'host': appenv.get_env('MYSQL_HOST', 'localhost'),
            'port': appenv.get_env('MYSQL_PORT', 3306),
            'dbname': appenv.get_env('MYSQL_DBNAME', None)
        }
        if not db_config['mysql_user'] or not db_config['mysql_pwd'] or not db_config['dbname']:
            self.warn(
                "Database configuration not found. Please provide a valid db_config.json file or set the 'MYSQL_USER', 'MYSQL_PWD', and 'MYSQL_DBNAME' environment variables.")
            return None
        try:
            username = db_config['mysql_user']
            password = db_config['mysql_pwd']
            host = db_config['host']
            port = db_config.get('port', 3306)
            dbname = db_config['dbname']
            return f"mysql+pymysql://{username}:{password}@{host}:{port}/{dbname}?charset=utf8mb4"
        except KeyError as e:
            self.warn(f"Database configuration is missing the following key: {e}")
            return None

    def list_tables(self):
        inspector = inspect(self.engine)
        tables = inspector.get_table_names()
        return tables

    def read_table(self, table_name: str, limit: int = 10, offset: int = 0, condition: str = None):
        session = self.Session()
        try:
            query = f"SELECT * FROM {table_name}"
            if condition:
                query += f" WHERE {condition}"
            query += f" LIMIT {limit} OFFSET {offset}"
            result = session.execute(text(query))
            data = result.fetchall()
            return data
        except Exception as e:
            self.warn(f"Error reading table {table_name}: {e}")
            return None
        finally:
            session.close()