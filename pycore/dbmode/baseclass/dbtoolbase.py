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

sqlite_type_mapping = {
    'INT': INTEGER,
    'INTEGER': INTEGER,
    'TINYINT': SMALLINT,
    'SMALLINT': SMALLINT,
    'MEDIUMINT': INTEGER,
    'BIGINT': BIGINT,
    'UNSIGNED BIG INT': BIGINT,
    'INT2': SMALLINT,
    'INT8': BIGINT,
    'CHARACTER': CHAR,
    'VARCHAR': VARCHAR,
    'VARYING CHARACTER': VARCHAR,
    'NCHAR': NCHAR,
    'NATIVE CHARACTER': NCHAR,
    'NVARCHAR': NVARCHAR,
    'TEXT': TEXT,
    'CLOB': CLOB,
    'BLOB': BLOB,
    'REAL': REAL,
    'DOUBLE': DOUBLE,
    'DOUBLE PRECISION': DOUBLE_PRECISION,
    'FLOAT': FLOAT,
    'NUMERIC': NUMERIC,
    'DECIMAL': DECIMAL,
    'BOOLEAN': BOOLEAN,
    'DATE': DATE,
    'DATETIME': DATETIME,
    'CHAR': CHAR,
    'GUID': UUID,
    'TIME': TIME,
    'DATEONLY': DATE,
    'DATETIMEOFFSET': TIMESTAMP,
    'TIMESPAN': TIME,
    'SINGLE': FLOAT,
    'BYTE': BINARY,
    'BYTE[]': BLOB,
}

mysql_type_mapping = {
    # String Data Types
    'CHAR': CHAR,
    'VARCHAR': VARCHAR,
    'BINARY': BINARY,
    'VARBINARY': VARBINARY,
    'TINYBLOB': BLOB,
    'TINYTEXT': TEXT,
    'TEXT': TEXT,
    'BLOB': BLOB,
    'MEDIUMTEXT': TEXT,
    'MEDIUMBLOB': BLOB,
    'LONGTEXT': TEXT,
    'LONGBLOB': BLOB,
    'ENUM': SQLAlchemyEnum,
    'SET': SQLAlchemyEnum,

    # Numeric Data Types
    'BIT': BINARY,
    'TINYINT': SMALLINT,
    'BOOL': BOOLEAN,
    'BOOLEAN': BOOLEAN,
    'SMALLINT': SMALLINT,
    'MEDIUMINT': INTEGER,
    'INT': INTEGER,
    'INTEGER': INTEGER,
    'BIGINT': BIGINT,
    'FLOAT': FLOAT,
    'DOUBLE': DOUBLE,
    'DOUBLE PRECISION': DOUBLE_PRECISION,
    'DECIMAL': DECIMAL,
    'DEC': DECIMAL,

    # Date and Time Data Types
    'DATE': DATE,
    'DATETIME': DATETIME,
    'TIMESTAMP': TIMESTAMP,
    'TIME': TIME,
    'YEAR': INTEGER,
}


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


    def build_conditions_mysql(self, conditions: Dict[str, str]) -> Tuple[str, Tuple]:
        if not conditions:
            return "", ()
        clauses = []
        values = []
        for key, val in conditions.items():
            if val.startswith(">="):
                clauses.append(f"{key} >= %s")
                values.append(val[2:])
            elif val.startswith("<="):
                clauses.append(f"{key} <= %s")
                values.append(val[2:])
            elif val.startswith(">"):
                clauses.append(f"{key} > %s")
                values.append(val[1:])
            elif val.startswith("<"):
                clauses.append(f"{key} < %s")
                values.append(val[1:])
            elif val.startswith("!="):
                clauses.append(f"{key} != %s")
                values.append(val[2:])
            elif val.startswith("%") and val.endswith("%"):
                clauses.append(f"{key} LIKE %s")
                values.append(val)
            elif val.startswith("%"):
                clauses.append(f"{key} LIKE %s")
                values.append(f"%{val[1:]}")
            elif val.endswith("%"):
                clauses.append(f"{key} LIKE %s")
                values.append(f"{val[:-1]}%")
            else:
                clauses.append(f"{key} = %s")
                values.append(val)
        return " AND ".join(clauses), tuple(values)

    def build_conditions_sqlite(self, conditions: Dict[str, str]) -> Tuple[str, Tuple]:
        if not conditions:
            return "", ()
        clauses = []
        values = []
        for key, val in conditions.items():
            if val.startswith(">="):
                clauses.append(f"{key} >= ?")
                values.append(val[2:])
            elif val.startswith("<="):
                clauses.append(f"{key} <= ?")
                values.append(val[2:])
            elif val.startswith(">"):
                clauses.append(f"{key} > ?")
                values.append(val[1:])
            elif val.startswith("<"):
                clauses.append(f"{key} < ?")
                values.append(val[1:])
            elif val.startswith("!="):
                clauses.append(f"{key} != ?")
                values.append(val[2:])
            elif val.startswith("%") and val.endswith("%"):
                clauses.append(f"{key} LIKE ?")
                values.append(val)
            elif val.startswith("%"):
                clauses.append(f"{key} LIKE ?")
                values.append(f"%{val[1:]}")
            elif val.endswith("%"):
                clauses.append(f"{key} LIKE ?")
                values.append(f"{val[:-1]}%")
            else:
                clauses.append(f"{key} = ?")
                values.append(val)
        return " AND ".join(clauses), tuple(values)