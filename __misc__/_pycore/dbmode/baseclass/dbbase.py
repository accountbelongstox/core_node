from pycore.base.base import Base
import json
from datetime import datetime
from typing import Dict, List, Union, Tuple, Optional, Any
from sqlalchemy import create_engine, Column, Integer, String, Table, MetaData, inspect, VARCHAR, DATETIME, BOOLEAN, \
    FLOAT, BLOB, Float, Numeric, DATE, JSON, text, REAL, DOUBLE, DOUBLE_PRECISION, SMALLINT, BIGINT, TIMESTAMP, TIME, \
    CLOB, BINARY, VARBINARY, TEXT, NVARCHAR, CHAR, NCHAR,DateTime
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import asc, desc
from sqlalchemy.pool import QueuePool
from sqlalchemy.sql import func
SQLALCHEMYBase = declarative_base()

class DBBase(Base):
    def __init__(self, db_url: str, config_file: str):
        self.engine = create_engine(db_url, poolclass=QueuePool)
        self.session = scoped_session(sessionmaker(bind=self.engine))
        self.config_file = config_file
        self.include_filter = []
        self.exclude_filter = []
        self.connect()
        if self.config_file_exists():
            self.init_database()

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
            with open(self.config_file, 'r'):
                return True
        except FileNotFoundError:
            return False

    def connect(self):
        self.engine.connect()
        self.session = scoped_session(sessionmaker(bind=self.engine))

    def init_database(self):
        with open(self.config_file, 'r') as f:
            config = json.load(f)
        for table_name, table_info in config.items():
            self.create_table(table_name, table_info)
        self.commit()

    def commit(self):
        self.session.commit()

    def close(self):
        self.session.close()

    def insert_one(self, tabname: str, data: Dict, result_id: bool = True):
        self.insert_many(tabname, [data], result_id)

    def update_one(self, tabname: str, data: Dict, conditions: Dict):
        self.update_many(tabname, [data], conditions)

    def read_one(self, tablename: str, conditions: Dict = None, select: str = "*"):
        results = self.read_many(tablename, conditions, limit=(0, 1), select=select)
        return results[0] if results else None

    def insert_many(self, tabname: str, data: List[Dict], result_id: bool = True):
        table = self.get_table(tabname)
        conn = self.engine.connect()
        trans = conn.begin()
        try:
            result = conn.execute(table.insert(), data)
            trans.commit()
            if result_id:
                return result.inserted_primary_key if len(data) == 1 else [r.inserted_primary_key for r in result]
        except Exception as e:
            trans.rollback()
            raise e
        finally:
            conn.close()

    def update_many(self, tabname: str, data: List[Dict], conditions: Dict):
        table = self.get_table(tabname)
        conn = self.engine.connect()
        trans = conn.begin()
        try:
            for record in data:
                conn.execute(table.update().where(self.filter_query(table, conditions)).values(**record))
            trans.commit()
        except Exception as e:
            trans.rollback()
            raise e
        finally:
            conn.close()

    def read_many(self, tablename: str, conditions: Dict = None, limit: Tuple[int, int] = (0, 1000),
                  select: str = "*", sort: Dict[str, str] = None, print_sql: bool = False) -> List[Dict[str, Any]]:
        session = self.get_session()
        table_class = self.get_table(tablename)

        if conditions is None:
            conditions = {}

        query_obj = self.filter_query(session.query(table_class), table_class, conditions=conditions)

        default_datetime = datetime(1970, 1, 1)

        if select and select != "*":
            columns = [getattr(table_class, col_name.strip()) for col_name in select.split()]
            query_obj = query_obj.with_entities(*columns)
        else:

            for column in table_class.c:
                print(column)
                print(f"Column Name: {column.name}")
                print(f"Type: {column.type}")
            columns = [
                func.ifnull(
                    func.str_to_date(getattr(table_class, col.name), "'%Y-%m-%dT%H:%i:%s'"),
                    default_datetime
                ).label(col.name) if isinstance(col.type, (DateTime, TIMESTAMP)) else getattr(table_class, col.name)
                for col in table_class.c
            ]
            query_obj = query_obj.with_entities(*columns)

        # Apply sorting
        if sort:
            for field, order in sort.items():
                if order.upper() == 'ASC':
                    query_obj = query_obj.order_by(asc(getattr(table_class, field)))
                elif order.upper() == 'DESC':
                    query_obj = query_obj.order_by(desc(getattr(table_class, field)))
                else:
                    self.warn(f"Unsupported sort order: {order}")

        # Apply limit and offset
        query_obj = query_obj.offset(limit[0]).limit(limit[1] - limit[0])

        if print_sql:
            print(str(query_obj.statement.compile(compile_kwargs={"literal_binds": True})))

        # Fetch all results
        result_proxy = query_obj.all()

        # Convert results to dictionary
        results = []
        for row in result_proxy:
            row_dict = {col: getattr(row, col) for col in row._fields}
            results.append(row_dict)

        session.close()
        return results

    def delete(self, tabname: str, conditions: Dict = None, physical: bool = False):
        table = self.get_table(tabname)
        conn = self.engine.connect()
        trans = conn.begin()
        try:
            query = table.delete() if physical else table.update().values(deleted=True)
            conn.execute(self.filter_query(query, table, conditions))
            trans.commit()
        except Exception as e:
            trans.rollback()
            raise e
        finally:
            conn.close()

    def filter_query(self, query_obj, table_class, conditions: Dict = None):
        if conditions:
            for col, val in conditions.items():
                if isinstance(val, str):
                    if val.startswith(">="):
                        query_obj = query_obj.filter(getattr(table_class.c, col) >= val[2:])
                    elif val.startswith("<="):
                        query_obj = query_obj.filter(getattr(table_class.c, col) <= val[2:])
                    elif val.startswith(">"):
                        query_obj = query_obj.filter(getattr(table_class.c, col) > val[1:])
                    elif val.startswith("<"):
                        query_obj = query_obj.filter(getattr(table_class.c, col) < val[1:])
                    elif val.startswith("!="):
                        query_obj = query_obj.filter(getattr(table_class.c, col) != val[2:])
                    elif val.startswith("%") and val.endswith("%"):
                        query_obj = query_obj.filter(getattr(table_class.c, col).like(val))
                    elif val.startswith("%"):
                        query_obj = query_obj.filter(getattr(table_class.c, col).like(f"%{val[1:]}"))
                    elif val.endswith("%"):
                        query_obj = query_obj.filter(getattr(table_class.c, col).like(f"{val[:-1]}%"))
                    else:
                        query_obj = query_obj.filter(getattr(table_class.c, col) == val)
                else:
                    query_obj = query_obj.filter(getattr(table_class.c, col) == val)
        return query_obj

    def get_session(self):
        return self.session

    def get_table(self, tabname: str) -> Table:
        metadata = MetaData()
        table = Table(tabname, metadata, autoload_with=self.engine)
        return table

    def get_tablemaps(self) -> Dict[str, Dict[str, Dict[str, Union[str, bool, Optional[str]]]]]:
        tablemaps = {}
        inspector = inspect(self.engine)
        tables = inspector.get_table_names()
        tables = self.filter_tables(tables)
        for table_name in tables:
            columns = {}
            for column in inspector.get_columns(table_name):
                column_info = {
                    'type': str(column['type'])
                }
                if 'nullable' in column:
                    column_info['nullable'] = column['nullable']
                if 'primary_key' in column:
                    column_info['primary_key'] = column['primary_key']
                if 'default' in column:
                    column_info['default'] = column['default']
                if 'autoincrement' in column:
                    column_info['autoincrement'] = column['autoincrement']
                if 'comment' in column:
                    column_info['comment'] = column['comment']
                if 'computed' in column:
                    column_info['computed'] = column['computed']
                if 'identity' in column:
                    column_info['identity'] = column['identity']
                if 'dialect_options' in column:
                    column_info['dialect_options'] = column['dialect_options']
                columns[column['name']] = column_info
            tablemaps[table_name] = columns
        return tablemaps

    def show_tablemap(self):
        tablemap = self.get_tablemaps()
        print(f"tablemap: {tablemap}")
        for table_name, table_info in tablemap.items():
            print(f"Table: {table_name}")
            for field_name, field_info in table_info.items():
                print(f"  - {field_name}:")
                for attr, value in field_info.items():
                    print(f"    {attr}: {value}")

    def get_table_fields_map(self, tablename: str) -> Dict[str, Dict[str, Union[str, bool, Optional[str]]]]:
        tablemap = self.get_tablemaps()
        table = tablemap.get(tablename)
        if not table:
            raise ValueError(f"Table {tablename} does not exist")
        return table

    def create_table(self, tablename: str, fields: Dict[str, Dict[str, Union[str, bool, Optional[str]]]]):
        if not self.table_exists(tablename):
            columns = []
            for field_name, field_info in fields.items():
                field_type = field_info['type'].upper()
                if '(' in field_type:
                    type_name, type_param = field_type.split('(')
                    type_param = type_param.rstrip(')')
                    if type_name == 'VARCHAR':
                        column_type = VARCHAR(int(type_param))
                    else:
                        column_type = getattr(vars(), type_name.lower(), String)(int(type_param))
                else:
                    if field_type == 'REAL':
                        column_type = REAL
                    elif field_type == 'FLOAT':
                        column_type = FLOAT
                    elif field_type == 'DOUBLE':
                        column_type = DOUBLE
                    elif field_type == 'DOUBLE_PRECISION':
                        column_type = DOUBLE_PRECISION
                    elif field_type == 'NUMERIC':
                        column_type = Numeric
                    elif field_type == 'DECIMAL':
                        column_type = Numeric
                    elif field_type == 'INTEGER':
                        column_type = Integer
                    elif field_type == 'SMALLINT':
                        column_type = SMALLINT
                    elif field_type == 'BIGINT':
                        column_type = BIGINT
                    elif field_type == 'TIMESTAMP':
                        column_type = TIMESTAMP
                    elif field_type == 'DATETIME':
                        column_type = DATETIME
                    elif field_type == 'DATE':
                        column_type = DATE
                    elif field_type == 'TIME':
                        column_type = TIME
                    elif field_type == 'TEXT':
                        column_type = TEXT
                    elif field_type == 'CLOB':
                        column_type = CLOB
                    elif field_type == 'VARCHAR':
                        column_type = VARCHAR
                    elif field_type == 'NVARCHAR':
                        column_type = NVARCHAR
                    elif field_type == 'CHAR':
                        column_type = CHAR
                    elif field_type == 'NCHAR':
                        column_type = NCHAR
                    elif field_type == 'BLOB':
                        column_type = BLOB
                    elif field_type == 'BINARY':
                        column_type = BINARY
                    elif field_type == 'VARBINARY':
                        column_type = VARBINARY
                    elif field_type == 'BOOLEAN':
                        column_type = BOOLEAN
                    elif field_type == 'JSON':
                        column_type = JSON
                    elif field_type == 'STRING':
                        column_type = String
                    else:
                        self.info(f"Unmatched data fields: {field_name} / {field_type}")
                        column_type = TEXT
                column_args = {
                    'primary_key': field_info.get('primary_key', False),
                    'nullable': field_info.get('nullable', True),
                    'default': text(field_info['default']) if field_info.get('default') is not None else None,
                    'autoincrement': field_info.get('autoincrement', False),
                    'comment': field_info.get('comment', None)
                }

                if column_args['primary_key'] and field_name.lower() == 'id':
                    column_args['autoincrement'] = True

                columns.append(Column(field_name, column_type, **column_args))

            table = Table(tablename, SQLALCHEMYBase.metadata, *columns)
            SQLALCHEMYBase.metadata.create_all(self.engine)

    def create_tables(self, table_maps):
        created_count = 0
        existing_count = 0
        for table_name, table_info in table_maps.items():
            if self.table_exists(table_name):
                existing_count += 1
            else:
                self.create_table(table_name, table_info)
                created_count += 1
        print(f"Tables created: {created_count}, Tables already existed: {existing_count}")

    def drop_table(self, tablename: str):
        if self.table_exists(tablename):
            table = self.get_table(tablename)
            table.drop(self.engine)

    def table_exists(self, tablename: str) -> bool:
        inspector = inspect(self.engine)
        return inspector.has_table(tablename)

    def migrate_data(self, target_db: any):
        table_maps = self.get_tablemaps()
        target_db.create_tables(table_maps)

        for table_name in table_maps:
            if table_name not in target_db.get_tablemaps():
                fields = self.get_table_fields_map(table_name)
                target_db.create_table(table_name, fields)
            print("table_name",table_name)
            origin_data = self.read_many(table_name)
            if origin_data:
                target_db.insert_many(table_name, origin_data)

        print("Data migration completed.")