from sqlalchemy import Integer, SmallInteger, BigInteger, String, Text, LargeBinary, Float, Numeric, Boolean, Date, DateTime
from enum import Enum

class DataTypes(Enum):
    MYSQL = {
        "INT": Integer,
        "INTEGER": Integer,
        "TINYINT": Integer,
        "SMALLINT": Integer,
        "MEDIUMINT": Integer,
        "BIGINT": BigInteger,
        "UNSIGNED BIG INT": BigInteger,
        "BIG INT": BigInteger,
        "INT2": SmallInteger,
        "INT8": BigInteger,
        "CHARACTER": String,
        "VARCHAR": String,
        "CHAR": String,
        "VARYING CHARACTER": String,
        "NCHAR": String,
        "NATIVE CHARACTER": String,
        "NVARCHAR": String,
        "TEXT": Text,
        "FILE": Text,
        "CLOB": Text,
        "BLOB": LargeBinary,
        "REAL": Float,
        "DOUBLE": Float,
        "DOUBLE PRECISION": Float,
        "FLOAT": Float,
        "NUMERIC": Numeric,
        "DECIMAL": Numeric,
        "BOOLEAN": Boolean,
        "DATE": Date,
        "DATETIME": DateTime
    }

    SQLITE = {
        "INT": Integer,
        "INTEGER": Integer,
        "TINYINT": Integer,
        "SMALLINT": Integer,
        "MEDIUMINT": Integer,
        "BIGINT": BigInteger,
        "UNSIGNED BIG INT": BigInteger,
        "BIG INT": BigInteger,
        "INT2": SmallInteger,
        "INT8": BigInteger,
        "CHARACTER": String,
        "VARCHAR": String,
        "CHAR": String,
        "VARYING CHARACTER": String,
        "NCHAR": String,
        "NATIVE CHARACTER": String,
        "NVARCHAR": String,
        "TEXT": Text,
        "CLOB": Text,
        "BLOB": LargeBinary,
        "REAL": Float,
        "DOUBLE": Float,
        "DOUBLE PRECISION": Float,
        "FLOAT": Float,
        "NUMERIC": Numeric,
        "DECIMAL": Numeric,
        "BOOLEAN": Boolean,
        "DATE": Date,
        "DATETIME": DateTime
    }

    @classmethod
    def get_field_type(cls, db_type: str, db: str = 'MYSQL'):
        """
        Get SQLAlchemy field type based on database type and field type string.

        Args:
        - db_type: Field type string from the database.
        - db: Database type ('MYSQL' or 'SQLITE').

        Returns:
        - Corresponding SQLAlchemy field type.
        """
        if db == 'MYSQL':
            return cls.MYSQL.get(db_type.upper(), String)
        elif db == 'SQLITE':
            return cls.SQLITE.get(db_type.upper(), String)
        else:
            raise ValueError(f"Unsupported database type: {db}")
