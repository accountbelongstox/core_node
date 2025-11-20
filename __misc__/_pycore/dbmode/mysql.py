from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from typing import Dict, List, Union, Tuple, Optional, Any
from pycore.dbmode.baseclass.dbtoolbase import DBToolBase


class MySQL(DBToolBase):

    def __init__(self, config_or_dburl: str, init_config_file: str = '', debug: bool = False):
        db_url = self.get_db_url_from_config(config_or_dburl)
        print("db_url", db_url)
        self.db_url = db_url
        self.config_file = init_config_file
        self.include_filter = []
        self.exclude_filter = []
        self.show_sql = debug
        self.engine = create_engine(self.db_url, echo=self.show_sql)
        self.Session = sessionmaker(bind=self.engine)

    def set_debug(self, debug):
        self.show_sql = debug

    def get_db_url_from_config(self, config):
        if isinstance(config, str):
            return config
        dbname = config.get('MYSQL_DB', "database")
        user = config.get('MYSQL_USER', "root")
        password = config.get('MYSQL_PWD', "")
        host = config.get('MYSQL_HOST', "localhost")
        port = config.get('MYSQL_PORT', 3306)
        db_url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{dbname}"
        return db_url

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
        self.session = self.Session()

    def _close(self):
        self.session.close()

    def _execute(self, sql: str, params: Union[Tuple, List[Tuple]] = (), many: bool = False):
        self._connect()
        if self.show_sql:
            print(sql)
        if many:
            result = self.session.execute(text(sql), params)
        else:
            result = self.session.execute(text(sql), params)
        self.session.commit()
        self._close()
        return result

    def init_database(self, table_maps: Dict[str, Dict[str, Dict[str, Union[str, bool, Optional[str]]]]]):
        self.create_tables(table_maps)

    def insert_one(self, tabname: str, data: Dict, result_id: bool = True):
        keys = ', '.join(data.keys())
        question_marks = ', '.join([f":{key}" for key in data.keys()])
        sql = f"INSERT INTO {tabname} ({keys}) VALUES ({question_marks})"
        result = self._execute(sql, data)
        if result_id:
            return result.lastrowid

    def update_one(self, tabname: str, data: Dict, conditions: Dict):
        set_clause = ', '.join([f"{key} = :{key}" for key in data.keys()])
        where_clause, values = self._build_conditions(conditions)
        sql = f"UPDATE {tabname} SET {set_clause} WHERE {where_clause}"
        self._execute(sql, {**data, **values})

    def read_one(self, tablename: str, conditions: Dict = None, select: str = "*") -> Optional[Dict[str, Any]]:
        where_clause, values = self._build_conditions(conditions)
        sql = f"SELECT {select} FROM {tablename} WHERE {where_clause}" if where_clause else f"SELECT {select} FROM {tablename}"
        result = self._execute(sql, values).fetchone()
        return dict(result) if result else None

    def insert_many(self, tabname: str, data: List[Dict], result_id: bool = True):
        if not data:
            return
        keys = ', '.join(data[0].keys())
        question_marks = ', '.join([f":{key}" for key in data[0].keys()])
        sql = f"INSERT INTO {tabname} ({keys}) VALUES ({question_marks})"
        result = self._execute(sql, data, many=True)
        if result_id:
            return result.lastrowid

    def update_many(self, tabname: str, data: List[Dict], conditions: Dict):
        if not data:
            return
        set_clause = ', '.join([f"{key} = :{key}" for key in data[0].keys()])
        where_clause, cond_values = self._build_conditions(conditions)
        values = [{**d, **cond_values} for d in data]
        sql = f"UPDATE {tabname} SET {set_clause} WHERE {where_clause}"
        self._execute(sql, values, many=True)

    def read_many(self, tablename: str, conditions: Dict = None, limit: Tuple[int, int] = (0, 1000),
                  select: str = "*", sort: Dict[str, str] = None, print_sql: bool = False) -> List[Dict[str, Any]]:
        where_clause, values = self._build_conditions(conditions)
        limit_clause = f" LIMIT {limit[0]}, {limit[1]}"
        sort_clause = ' ORDER BY ' + ', '.join([f"{key} {value}" for key, value in sort.items()]) if sort else ''
        sql = f"SELECT {select} FROM {tablename} WHERE {where_clause}{sort_clause}{limit_clause}" if where_clause else f"SELECT {select} FROM {tablename}{sort_clause}{limit_clause}"
        result = self._execute(sql, values)
        data = [dict(row) for row in result]
        return data

    def delete(self, tabname: str, conditions: Dict = None, physical: bool = False):
        where_clause, values = self._build_conditions(conditions)
        if physical:
            sql = f"DELETE FROM {tabname} WHERE {where_clause}"
        else:
            sql = f"UPDATE {tabname} SET deleted = 1 WHERE {where_clause}"
        self._execute(sql, values)

    def get_session(self):
        self._connect()
        return self.session

    def get_table(self, tabname: str) -> Dict[str, Dict[str, Union[int, str, bool, Optional[str]]]]:
        sql = f"SHOW FULL COLUMNS FROM {tabname}"
        result = self._execute(sql)
        columns = result.fetchall()

        result = {
            col[0]: {
                "cid": idx,
                "name": col[0],
                "type": col[1],
                "notnull": col[3] == 'NO',
                "default_value": col[5],
                "primary_key": 'PRI' in col[4],
                "hidden": False  # MySQL doesn't have a hidden column concept
            } for idx, col in enumerate(columns)
        }
        return result

    def get_tablemaps(self) -> Dict[str, Dict[str, Dict[str, Union[str, bool, Optional[str]]]]]:
        inspector = self.engine.dialect.get_table_names(self.engine.connect())
        tables = self.filter_tables(inspector)
        table_maps = {table: self.get_table(table) for table in tables}
        return table_maps

    def show_tablemap(self):
        table_maps = self.get_tablemaps()
        for table, fields in table_maps.items():
            print(f"Table: {table}")
            for field, info in fields.items():
                print(f"  Field: {field} - {info}")

    def create_table(self, tablename: str, fields: Dict):
        if self.table_exists(tablename):
            self.info(f"Table '{tablename}' already exists. Skipping creation.")
            return
        columns = []
        is_bad_table = False
        for name, info in fields.items():
            column_type = info['type']
            if not column_type or column_type == "":
                self.warn(f"Column type for '{name}' does not exist, skipping this field.")
                is_bad_table = True
                break
            column_def = f"{name} {self._get_column_type(info['type'])}"
            if info.get('primary_key', False):
                column_def += " PRIMARY KEY"
            if info.get('notnull', True):
                column_def += " NOT NULL"
            if info.get('default_value') is not None:
                column_def += f" DEFAULT {info['default_value']}"
            columns.append(column_def)
        if is_bad_table:
            self.warn(f"Table '{tablename}' information is incomplete, skipping creation.")
        else:
            sql = f"CREATE TABLE {tablename} ({', '.join(columns)})"
            self._execute(sql)
            self.success(f"Table '{tablename}' created successfully.")

    def create_tables(self, table_maps: Dict):
        for tablename, fields in table_maps.items():
            self.create_table(tablename, fields)

    def drop_table(self, tablename: str):
        sql = f"DROP TABLE IF EXISTS {tablename}"
        self._execute(sql)

    def table_exists(self, tablename: str) -> bool:
        sql = f"SELECT 1 FROM information_schema.tables WHERE table_name = '{tablename}'"
        result = self._execute(sql).fetchone()
        return result is not None

    def migrate_data(self, target_db: Any):
        pass

    def _build_conditions(self, conditions: Dict[str, str]):
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


    def _get_column_type(self, col_type: str):
        type_mapping = {
            "INTEGER": "INT",
            "SMALLINT": "SMALLINT",
            "BIGINT": "BIGINT",
            "FLOAT": "FLOAT",
            "DOUBLE": "DOUBLE",
            "DECIMAL": "DECIMAL",
            "STRING": "VARCHAR(255)",
            "TEXT": "TEXT",
            "BLOB": "BLOB",
            "DATE": "DATE",
            "DATETIME": "DATETIME",
            "TIMESTAMP": "TIMESTAMP",
            "TIME": "TIME",
            "CHAR": "CHAR(1)",
            "BOOLEAN": "TINYINT(1)"
        }
        return type_mapping.get(col_type.upper(), "VARCHAR(255)")
