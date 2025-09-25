import sqlite3
from typing import Dict, List, Union, Tuple, Optional, Any
from pycore.globalvers import appenv, appdir
from pycore.utils_linux import file
from pycore.dbmode.baseclass.dbtoolbase import DBToolBase

class Sqlite(DBToolBase):

    def __init__(self, appenv_or_dburl: str, config_file: Dict=None,debug:bool=False):
        db_url = self.get_db_url_from_config(appenv_or_dburl)
        self.db_url = db_url
        self.config_file = config_file
        self.include_filter = []
        self.exclude_filter = []
        self.show_sql = debug

    def set_debug(self,debug):
        self.show_sql = debug

    def get_db_url_from_config(self, appenv_or_dburl):
        return super().get_db_url_from_config_sqlite(appenv_or_dburl)

    def set_include_filter(self, include_filter: List[str]):
        self.include_filter = include_filter

    def set_exclude_filter(self, exclude_filter: List[str]):
        self.exclude_filter = exclude_filter

    def filter_tables(self, tables: List[str]) -> List[str]:
        system_tables = {'sqlite_sequence', 'sqlite_stat1', 'sqlite_stat2', 'sqlite_stat3', 'sqlite_stat4'}
        filtered_tables = [table for table in tables if table not in system_tables]

        if self.include_filter:
            filtered_tables = [table for table in filtered_tables if table in self.include_filter]
        if self.exclude_filter:
            filtered_tables = [table for table in filtered_tables if table not in self.exclude_filter]
        return filtered_tables

    def config_file_exists(self) -> bool:
        try:
            with open(self.config_file, 'r') as f:
                return True
        except FileNotFoundError:
            return False

    def _connect(self):
        self.conn = sqlite3.connect(self.db_url)
        self.cursor = self.conn.cursor()

    def _close(self):
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        self.cursor = None
        self.conn = None

    def _execute(self, sql: str, params: Union[Tuple, List[Tuple]] = (), many: bool = False):
        self._connect()

        if self.show_sql:
            print(sql)
        if many:
            self.cursor.executemany(sql, params)
        else:
            self.cursor.execute(sql, params)
        self.conn.commit()
        return self.cursor


    def init_database(self, table_maps: Dict[str, Dict[str, Dict[str, Union[str, bool, Optional[str]]]]]):
        self.create_tables(table_maps)

    def insert_one(self, tabname: str, data: Dict, result_id: bool = True):
        keys = ', '.join(data.keys())
        question_marks = ', '.join(['?' for _ in data])
        values = tuple(data.values())
        sql = f"INSERT INTO {tabname} ({keys}) VALUES ({question_marks})"
        cursor = self._execute(sql, values)
        self._close()
        if result_id:
            return cursor.lastrowid

    def update_one(self, tabname: str, data: Dict, conditions: Dict):
        set_clause = ', '.join([f"{key} = ?" for key in data.keys()])
        where_clause, values = self._build_conditions(conditions)
        values = tuple(data.values()) + values
        sql = f"UPDATE {tabname} SET {set_clause} WHERE {where_clause}"
        self._execute(sql, values)
        self._close()

    def read_one(self, tablename: str, conditions: Dict = None, select: str = "*") -> Optional[Dict[str, Any]]:
        where_clause, values = self._build_conditions(conditions)
        sql = f"SELECT {select} FROM {tablename} WHERE {where_clause}" if where_clause else f"SELECT {select} FROM {tablename}"
        cursor = self._execute(sql, values)
        read_result = cursor.fetchone()
        result = {}
        if read_result:
            read_result = [col[0] for col in cursor.description]
            result = dict(zip(columns, read_result))
        self._close()
        return result

    def insert_many(self, tabname: str, data: List[Dict], result_id: bool = True):
        if not data:
            return
        keys = ', '.join(data[0].keys())
        question_marks = ', '.join(['?' for _ in data[0]])
        values = [tuple(d.values()) for d in data]
        sql = f"INSERT INTO {tabname} ({keys}) VALUES ({question_marks})"
        cursor = self._execute(sql, values, many=True)
        result_id = cursor.lastrowid
        self._close()
        if result_id:
            return result_id

    def update_many(self, tabname: str, data: List[Dict], conditions: Dict):
        if not data:
            return
        set_clause = ', '.join([f"{key} = ?" for key in data[0].keys()])
        where_clause, cond_values = self._build_conditions(conditions)
        values = [tuple(d.values()) + cond_values for d in data]
        sql = f"UPDATE {tabname} SET {set_clause} WHERE {where_clause}"
        self._execute(sql, values, many=True)
        self._close()

    def read_many(self, tablename: str, conditions: Dict = None, limit: Tuple[int, int] = (0, 1000),
                  select: str = "*", sort: Dict[str, str] = None, print_sql: bool = False) -> List[Dict[str, Any]]:
        where_clause, values = self._build_conditions(conditions)
        limit_clause = f" LIMIT {limit[0]}, {limit[1]}"
        sort_clause = ' ORDER BY ' + ', '.join([f"{key} {value}" for key, value in sort.items()]) if sort else ''
        sql = f"SELECT {select} FROM {tablename} WHERE {where_clause}{sort_clause}{limit_clause}" if where_clause else f"SELECT {select} FROM {tablename}{sort_clause}{limit_clause}"
        cursor = self._execute(sql, values)
        result = cursor.fetchall()
        columns = [col[0] for col in cursor.description]
        self._close()
        data = [dict(zip(columns, row)) for row in result]
        return data

    def delete(self, tabname: str, conditions: Dict = None, physical: bool = False):
        where_clause, values = self._build_conditions(conditions)
        if physical:
            sql = f"DELETE FROM {tabname} WHERE {where_clause}"
        else:
            sql = f"UPDATE {tabname} SET deleted = 1 WHERE {where_clause}"
        self._execute(sql, values)
        self._close()

    def filter_query(self, query_obj, table_class, conditions: Dict = None):
        pass

    def get_session(self):
        self._connect()
        return self.conn

    def get_table(self, tabname: str) -> Dict[str, Dict[str, Union[int, str, bool, Optional[str]]]]:
        sql = f"PRAGMA table_xinfo({tabname})"
        cursor = self._execute(sql)
        columns = cursor.fetchall()
        self._close()

        result = {
            col[1]: {
                "cid": col[0],
                "name": col[1],
                "type": col[2],
                "notnull": bool(col[3]),
                "default_value": col[4],
                "primary_key": bool(col[5]),
                "hidden": bool(col[6])
            } for col in columns
        }
        return result

    def get_tablemaps(self) -> Dict[str, Dict[str, Dict[str, Union[str, bool, Optional[str]]]]]:
        sql = "SELECT name FROM sqlite_master WHERE type='table'"
        cursor = self._execute(sql)
        tables = [row[0] for row in cursor.fetchall()]
        tables = self.filter_tables(tables)
        table_maps = {table: self.get_table(table) for table in tables}
        self._close()
        return table_maps

    def show_tablemap(self):
        table_maps = self.get_tablemaps()
        for table, fields in table_maps.items():
            print(f"Table: {table}")
            for field, info in fields.items():
                print(f"  Field: {field} - {info}")

    def create_table(self, tablename: str, fields: Dict[str, Dict[str, Union[int, str, bool, Optional[str]]]]):
        if self.table_exists(tablename):
            self.info(f"Table '{tablename}' already exists. Skipping creation.")
            return

        columns = []
        for name, info in fields.items():
            column_def = f"{name} {info['type']}"
            if info.get('primary_key'):
                column_def += " PRIMARY KEY AUTOINCREMENT"
            if info.get('notnull'):
                column_def += " NOT NULL"
            if info.get('default_value') is not None:
                column_def += f" DEFAULT {info['default_value']}"
            columns.append(column_def)
        columns_str = ", ".join(columns)
        sql = f"CREATE TABLE IF NOT EXISTS {tablename} ({columns_str})"
        self._execute(sql)
        self._close()
        self.success(f"Table '{tablename}' created successfully.")

    def create_tables(self, table_maps: Dict[str, Dict[str, Dict[str, Union[int, str, bool, Optional[str]]]]]):
        for tablename, fields in table_maps.items():
            self.create_table(tablename, fields)


    def drop_table(self, tablename: str):
        sql = f"DROP TABLE IF EXISTS {tablename}"
        self._execute(sql)
        self._close()

    def table_exists(self, tablename: str) -> bool:
        sql = f"SELECT name FROM sqlite_master WHERE type='table' AND name='{tablename}'"
        cursor = self._execute(sql)
        is_table = bool(cursor.fetchone())
        self._close()
        return is_table

    def migrate_data(self, origin_db,target_db):
        super().migrate_data(origin_db,target_db)
        pass

    def _build_conditions(self, conditions: Dict[str, str]) -> Tuple[str, Tuple]:
        return super().build_conditions_sqlite(conditions=conditions)