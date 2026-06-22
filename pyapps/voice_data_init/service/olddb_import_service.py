#!/usr/bin/env python3
"""
Old Database Import Service
Handles importing legacy vocabulary databases
"""

from pathlib import Path
from typing import List, Dict, Any
import hashlib

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_sqlalchemy, get_third_package_requests

sqlalchemy = get_third_package_sqlalchemy()
requests = get_third_package_requests()
from pycore.database import database_manager
from pycore.database.models import TableKeys, VoiceDictionariesModel, VoiceCacheDbDoneModel
from pycore.pygvar import CACHE_DIR, DEFAULT_TEMP_DIR


class OldDbImportService:
    """
    Service for importing old/legacy vocabulary databases

    Handles:
    - Downloading old database files
    - Extracting compressed databases
    - Reading SQLite data from old format
    - Converting and importing to new format
    - Tracking import progress
    """

    def __init__(self, db_name: str = "voice_main"):
        """
        Initialize old DB import service

        Args:
            db_name: Target database name
        """
        self.db_name = db_name
        self.old_db_dir = Path(CACHE_DIR) / "voice_data" / "old_databases"
        self.old_db_dir.mkdir(parents=True, exist_ok=True)

    def download_old_database(self, url: str, target_path: Path) -> bool:
        """
        Download old database file from URL

        Args:
            url: Download URL
            target_path: Target file path

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.blue(f"Downloading old database from: {url}")

        response = requests.get(url, stream=True)

        if response.status_code != 200:
            ColorPrint.red(f"Download failed: HTTP {response.status_code}")
            return False

        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0

        with open(target_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        progress = (downloaded / total_size) * 100
                        ColorPrint.green(f"Downloaded: {progress:.1f}%")

        ColorPrint.green(f"Download complete: {target_path}")
        return True

    def extract_database(self, archive_path: Path) -> Path:
        """
        Extract compressed database file

        Args:
            archive_path: Path to compressed archive

        Returns:
            Path to extracted database file
        """
        ColorPrint.blue(f"Extracting: {archive_path}")

        import zipfile
        import py7zr

        extract_dir = archive_path.parent

        if archive_path.suffix == '.zip':
            with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
        elif archive_path.suffix == '.7z':
            with py7zr.SevenZipFile(archive_path, mode='r') as archive:
                archive.extractall(path=extract_dir)

        db_file = extract_dir / archive_path.stem
        if not db_file.exists():
            db_file = db_file.with_suffix('.db')

        ColorPrint.green(f"Extracted to: {db_file}")
        return db_file

    def read_old_database(self, db_path: Path) -> List[Dict[str, Any]]:
        """
        Read records from old database format

        Args:
            db_path: Path to old database file

        Returns:
            List of records
        """
        ColorPrint.blue(f"Reading old database: {db_path}")

        engine = sqlalchemy.create_engine(f'sqlite:///{db_path}')
        connection = engine.connect()

        metadata = sqlalchemy.MetaData()
        metadata.reflect(bind=engine)

        records = []

        for table_name in metadata.tables:
            table = metadata.tables[table_name]
            query = sqlalchemy.select(table)
            result = connection.execute(query)

            for row in result:
                record = dict(row._mapping)
                records.append(record)

        connection.close()

        ColorPrint.green(f"Read {len(records)} records from old database")
        return records

    def convert_old_record(self, old_record: Dict) -> Dict:
        """
        Convert old record format to new format

        Args:
            old_record: Old format record

        Returns:
            New format record
        """
        content = old_record.get('content', old_record.get('word', ''))

        if not content:
            return None

        md5_hash = hashlib.md5(content.encode('utf-8')).hexdigest()

        new_record = {
            'content': content,
            'md5': md5_hash
        }

        if 'translation' in old_record and old_record['translation'] not in ['{}', None]:
            new_record['translation'] = old_record['translation']
            new_record['is_translation'] = True

        if 'us_phonetic' in old_record:
            new_record['us_phonetic'] = old_record['us_phonetic']

        if 'uk_phonetic' in old_record:
            new_record['uk_phonetic'] = old_record['uk_phonetic']

        return new_record

    def import_old_database(self, db_path: Path, db_name: str) -> int:
        """
        Import old database into main database

        Args:
            db_path: Path to old database
            db_name: Name identifier for tracking

        Returns:
            Number of records imported
        """
        with database_manager.get_connection(self.db_name) as conn:
            if VoiceCacheDbDoneModel.is_db_imported(conn, db_name):
                ColorPrint.yellow(f"Database already imported: {db_name}")
                return 0

        ColorPrint.blue(f"Importing old database: {db_name}")

        old_records = self.read_old_database(db_path)

        existing_contents = set()
        with database_manager.get_connection(self.db_name) as conn:
            existing_contents = set(VoiceDictionariesModel.get_all_contents(conn))

        new_records = []
        for old_record in old_records:
            converted = self.convert_old_record(old_record)
            if converted and converted['content'] not in existing_contents:
                new_records.append(converted)
                existing_contents.add(converted['content'])

        ColorPrint.green(f"Found {len(new_records)} new records to import")

        batch_size = 10000
        imported_count = 0

        for i in range(0, len(new_records), batch_size):
            batch = new_records[i:i + batch_size]

            with database_manager.get_connection(self.db_name) as conn:
                for record in batch:
                    VoiceDictionariesModel.insert(conn, record)

            imported_count += len(batch)
            ColorPrint.green(f"Imported {imported_count}/{len(new_records)}")

        with database_manager.get_connection(self.db_name) as conn:
            VoiceCacheDbDoneModel.mark_db_done(conn, db_name)

        ColorPrint.green(f"Import complete: {imported_count} records")
        return imported_count

    def start_old_db_input(self, db_url: str = None):
        """
        Main entry point for old database import

        Args:
            db_url: Optional URL to download database from
        """
        ColorPrint.blue("=== Old Database Import ===")

        if db_url:
            archive_name = db_url.split('/')[-1]
            archive_path = self.old_db_dir / archive_name

            if not archive_path.exists() or archive_path.stat().st_size < 100:
                if not self.download_old_database(db_url, archive_path):
                    ColorPrint.red("Download failed")
                    return

                db_path = self.extract_database(archive_path)
            else:
                ColorPrint.yellow("Archive already exists, using cached version")
                db_path = self.old_db_dir / archive_path.stem
                if not db_path.exists():
                    db_path = self.extract_database(archive_path)
        else:
            db_files = list(self.old_db_dir.glob("*.db"))
            if not db_files:
                ColorPrint.yellow("No old database files found")
                return
            db_path = db_files[0]

        imported = self.import_old_database(db_path, db_path.name)

        ColorPrint.green(f"Old database import complete: {imported} records")
