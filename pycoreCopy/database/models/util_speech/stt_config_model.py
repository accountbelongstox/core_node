#!/usr/bin/env python3
"""
SpeechSTTConfigModel - STT configuration storage.
"""

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.models.table_keys import TableKeys
from pycore.database.models.namespaces import TableNamespaces
from pycore.database.models.util_speech.base_config_model import SpeechConfigBaseModel


class SpeechSTTConfigModel(SpeechConfigBaseModel):
    """Key-value configuration table for STT settings."""

    __table_key__ = TableKeys.SPEECH_STT_CONFIG
    __namespace__ = TableNamespaces.UTIL_SPEECH
    __table_name__ = "stt_config"
    __full_table_name__ = "util_speech_stt_config"
    __schema_version__ = 1

    @classmethod
    def define_table_structure(cls, metadata):
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
            sqlalchemy.Column("key", sqlalchemy.String(255), nullable=False, unique=True, index=True),
            sqlalchemy.Column("value", sqlalchemy.Text, nullable=False),
            sqlalchemy.Column("value_type", sqlalchemy.String(50), nullable=False, default="string"),
            sqlalchemy.Column("description", sqlalchemy.String(500), nullable=True),
            sqlalchemy.Column("created_at", sqlalchemy.String(50), nullable=False),
            sqlalchemy.Column("updated_at", sqlalchemy.String(50), nullable=False),
        )
