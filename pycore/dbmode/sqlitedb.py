import json
import os
from typing import Dict, List, Union, Tuple
from sqlalchemy.ext.declarative import declarative_base
from pycore.globalvers import appenv, appdir
from pycore.dbmode.baseclass.dbbase import DBBase
from pycore.utils_linux import file
SQLALCHEMYBase = declarative_base()


class SQLiteDB(DBBase):
    def __init__(self, appenv_or_dburl: str, config_file: str = 'db_config.json'):
        db_url = self.get_db_url_from_config(appenv_or_dburl)
        if not db_url.startswith("sqlite:///"):
            db_url = db_url.replace('\\', '/')
            db_url = f"sqlite:///{db_url}"
        super().__init__(db_url, config_file)

    def get_db_url_from_config(self, appenv_or_dburl):
        if isinstance(appenv_or_dburl, str):
            return appenv_or_dburl
        appenv = appenv_or_dburl
        dbname = appenv.get_env('SQLITE_DB', ".sqlite3/data.db")
        db_url = f"{appdir}/{dbname}"
        file.ensure_base_dir(db_url)
        return f"sqlite:///{db_url}"

    def show_tablemap(self):
        super().show_tablemap()

    def create_tables(self, table_maps):
        super().create_tables(table_maps)

    def create_table(self, tablename: str, fields: Dict[str, Dict[str, Union[str, bool]]]):
        super().create_table(tablename, fields)

    def drop_table(self, tablename: str):
        super().drop_table(tablename)

    def table_exists(self, tablename: str) -> bool:
        return super().table_exists(tablename)

    def get_table_fields_map(self, tablename: str) -> Dict[str, Dict[str, Union[str, bool]]]:
        return super().get_table_fields_map(tablename)