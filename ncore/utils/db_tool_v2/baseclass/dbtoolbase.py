import json
import os
from typing import Dict, List, Union, Tuple
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from pycore.globalvers import appenv, appdir
from pycore.base.base import Base
from pycore.utils_linux import file
from sqlalchemy.types import (
    BigInteger, Boolean, Date, DateTime, Enum, Float, Integer, Interval,
    LargeBinary, MatchType, Numeric, PickleType, SchemaType, SmallInteger, String,
    Text, Time, Unicode, UnicodeText, Uuid
)
from sqlalchemy import (
    ARRAY, BIGINT, BINARY, BLOB, BOOLEAN, CHAR, CLOB, DATE, DATETIME, DECIMAL,
    DOUBLE, DOUBLE_PRECISION, FLOAT, INT, JSON, INTEGER, NCHAR, NVARCHAR, NUMERIC,
    REAL, SMALLINT, TEXT, TIME, TIMESTAMP, UUID, VARBINARY, VARCHAR,Enum as SQLAlchemyEnum
)

def _get_column_type(self, col_type: str, db_type: str):
    col_type = col_type.upper()

    if db_type == "sqlite":
        return sqlite_type_mapping.get(col_type, String)
    elif db_type == "mysql":
        return mysql_type_mapping.get(col_type, String)
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


class DBToolBase(Base):

    def migrate_data(self, origin_db,target_db: any):
        table_maps = origin_db.get_tablemaps()
        self.pprint(table_maps)
        target_db.create_tables(table_maps)

        for table_name in table_maps:
            # if table_name not in target_db.get_tablemaps():
            #     fields = origin_db.get_table(table_name)
            #     target_db.create_table(table_name, fields)
            print("table_name",table_name)
            origin_data = origin_db.read_many(table_name)
            if origin_data:
                target_db.insert_many(table_name, origin_data)

    def get_db_url_from_config_sqlite(self, appenv_or_dburl):
        if isinstance(appenv_or_dburl, str):
            return appenv_or_dburl
        appenv = appenv_or_dburl
        dbname = appenv.get_env('SQLITE_DB', ".sqlite3/data.db")
        db_url = f"{appdir}/{dbname}"
        file.ensure_base_dir(db_url)
        return db_url


    def get_db_url_from_config_mysql(self, appenv_or_dburl):
        if isinstance(appenv_or_dburl, str):
            return appenv_or_dburl
        appenv = appenv_or_dburl
        dbname = appenv.get_env('MYSQL_DB', "database")
        user = appenv.get_env('MYSQL_USER', "root")
        password = appenv.get_env('MYSQL_PWD', "")
        host = appenv.get_env('MYSQL_HOST', "localhost")
        port = appenv.get_env('MYSQL_PORT', 3306)
        db_url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{dbname}"
        return db_url
