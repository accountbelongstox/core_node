import sqlite3
from typing import Dict, List, Union, Tuple, Optional, Any
from pycore.globalvers import appenv, appdir
from pycore.utils_linux import file
from pycore.base.base import Base

class DBBase(Base):

    def __init__(self, appenv_or_dburl: str, config_file: Dict=None):
        db_url = self.get_db_url_from_config(appenv_or_dburl)
        print("db_url",db_url)
        self.db_url = db_url
        self.config_file = config_file
        self.include_filter = []
        self.exclude_filter = []
        self.conn = None
        self.cursor = None
        self.show_sql = True


    def get_db_url_from_config(self, appenv_or_dburl):
        if isinstance(appenv_or_dburl, str):
            return appenv_or_dburl
        appenv = appenv_or_dburl
        dbname = appenv.get_env('SQLITE_DB', ".sqlite3/data.db")
        db_url = f"{appdir}/{dbname}"
        file.ensure_base_dir(db_url)
        return db_url

    def set_include_filter(self, include_filter: List[str]):
        self.include_filter = include_filter

    def set_exclude_filter(self, exclude_filter: List[str]):
        self.exclude_filter = exclude_filter

    def filter_tables(self, tables: List[str]) -> List[str]:
        if self.include_filter:
            tables = [table for table in tables if table in self.include_filter]
        if self.exclude_filter:
            tables = [table for table in tables if table not in self.exclude_filter]
        return tables

    def config_file_exists(self) -> bool:
        try:
            with open(self.config_file, 'r') as f:
                return True
        except FileNotFoundError:
            return False

    def connect(self):
        self.conn = sqlite3.connect(self.db_url)
        self.cursor = self.conn.cursor()

    def init_database(self, table_maps: Dict[str, Dict[str, Dict[str, Union[str, bool, Optional[str]]]]]):
        self.create_tables(table_maps)

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

    def insert_one(self, tabname: str, data: Dict, result_id: bool = True):
        keys = ', '.join(data.keys())
        question_marks = ', '.join(['?' for _ in data])
        values = tuple(data.values())
        sql = f"INSERT INTO {tabname} ({keys}) VALUES ({question_marks})"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql, values)
        if result_id:
            return self.cursor.lastrowid
        self.commit()

    def update_one(self, tabname: str, data: Dict, conditions: Dict):
        set_clause = ', '.join([f"{key} = ?" for key in data.keys()])
        where_clause, values = self._build_conditions(conditions)
        values = tuple(data.values()) + values
        sql = f"UPDATE {tabname} SET {set_clause} WHERE {where_clause}"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql, values)
        self.commit()

    def read_one(self, tablename: str, conditions: Dict = None, select: str = "*") -> Optional[Dict[str, Any]]:
        where_clause, values = self._build_conditions(conditions)
        sql = f"SELECT {select} FROM {tablename} WHERE {where_clause}" if where_clause else f"SELECT {select} FROM {tablename}"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql, values)
        result = self.cursor.fetchone()
        if result:
            columns = [col[0] for col in self.cursor.description]
            return dict(zip(columns, result))
        return None

    def insert_many(self, tabname: str, data: List[Dict], result_id: bool = True):
        if not data:
            return
        keys = ', '.join(data[0].keys())
        question_marks = ', '.join(['?' for _ in data[0]])
        values = [tuple(d.values()) for d in data]
        sql = f"INSERT INTO {tabname} ({keys}) VALUES ({question_marks})"
        if self.show_sql:
            print(sql)
        self.cursor.executemany(sql, values)
        if result_id:
            return self.cursor.lastrowid
        self.commit()

    def update_many(self, tabname: str, data: List[Dict], conditions: Dict):
        if not data:
            return
        set_clause = ', '.join([f"{key} = ?" for key in data[0].keys()])
        where_clause, cond_values = self._build_conditions(conditions)
        values = [tuple(d.values()) + cond_values for d in data]
        sql = f"UPDATE {tabname} SET {set_clause} WHERE {where_clause}"
        if self.show_sql:
            print(sql)
        self.cursor.executemany(sql, values)
        self.commit()

    def read_many(self, tablename: str, conditions: Dict = None, limit: Tuple[int, int] = (0, 1000),
                  select: str = "*", sort: Dict[str, str] = None, print_sql: bool = False) -> List[Dict[str, Any]]:
        where_clause, values = self._build_conditions(conditions)
        limit_clause = f" LIMIT {limit[0]}, {limit[1]}"
        sort_clause = ' ORDER BY ' + ', '.join([f"{key} {value}" for key, value in sort.items()]) if sort else ''
        sql = f"SELECT {select} FROM {tablename} WHERE {where_clause}{sort_clause}{limit_clause}" if where_clause else f"SELECT {select} FROM {tablename}{sort_clause}{limit_clause}"
        if print_sql or self.show_sql:
            print(sql)
        self.cursor.execute(sql, values)
        result = self.cursor.fetchall()
        columns = [col[0] for col in self.cursor.description]
        return [dict(zip(columns, row)) for row in result]

    def delete(self, tabname: str, conditions: Dict = None, physical: bool = False):
        where_clause, values = self._build_conditions(conditions)
        if physical:
            sql = f"DELETE FROM {tabname} WHERE {where_clause}"
        else:
            sql = f"UPDATE {tabname} SET deleted = 1 WHERE {where_clause}"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql, values)
        self.commit()

    def filter_query(self, query_obj, table_class, conditions: Dict = None):
        pass

    def get_session(self):
        return self.conn

    def get_table(self, tabname: str) -> Dict[str, Dict[str, Union[str, bool, Optional[str]]]]:
        sql = f"PRAGMA table_info({tabname})"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql)
        columns = self.cursor.fetchall()
        return {col[1]: {"type": col[2], "primary_key": bool(col[5])} for col in columns}

    def get_tablemaps(self) -> Dict[str, Dict[str, Dict[str, Union[str, bool, Optional[str]]]]]:
        sql = "SELECT name FROM sqlite_master WHERE type='table'"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql)
        tables = [row[0] for row in self.cursor.fetchall()]
        tables = self.filter_tables(tables)
        table_maps = {table: self.get_table(table) for table in tables}
        return table_maps

    def show_tablemap(self):
        table_maps = self.get_tablemaps()
        for table, fields in table_maps.items():
            print(f"Table: {table}")
            for field, info in fields.items():
                print(f"  Field: {field} - {info}")

    def create_table(self, tablename: str, fields: Dict[str, Dict[str, Union[str, bool, Optional[str]]]]):
        columns = [f"{name} {info['type']}" + (" PRIMARY KEY" if info.get('primary_key') else "") for name, info in fields.items()]
        columns_str = ", ".join(columns)
        sql = f"CREATE TABLE IF NOT EXISTS {tablename} ({columns_str})"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql)
        self.commit()

    def create_tables(self, table_maps: Dict[str, Dict[str, Dict[str, Union[str, bool, Optional[str]]]]]):
        for tablename, fields in table_maps.items():
            self.create_table(tablename, fields)

    def drop_table(self, tablename: str):
        sql = f"DROP TABLE IF EXISTS {tablename}"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql)
        self.commit()

    def table_exists(self, tablename: str) -> bool:
        sql = f"SELECT name FROM sqlite_master WHERE type='table' AND name='{tablename}'"
        if self.show_sql:
            print(sql)
        self.cursor.execute(sql)
        return bool(self.cursor.fetchone())

    def migrate_data(self, target_db: Any):
        pass

    def _build_conditions(self, conditions: Dict[str, str]) -> Tuple[str, Tuple]:
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
                values.append(val)
            elif val.endswith("%"):
                clauses.append(f"{key} LIKE ?")
                values.append(val)
            else:
                clauses.append(f"{key} = ?")
                values.append(val)
        return " AND ".join(clauses), tuple(values)