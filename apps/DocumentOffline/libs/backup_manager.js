// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const fs = require('fs');
const path = require('path');
const logger = require('#@logger');

class BackupManager {
  constructor(maxBackups = 5) {
    this.maxBackups = maxBackups;
  }

  exists(targetDir) {
    if (!fs.existsSync(targetDir)) {
      return false;
    }
    const stats = fs.statSync(targetDir);
    if (!stats.isDirectory()) {
      return false;
    }
    const files = fs.readdirSync(targetDir);
    return files.length > 0;
  }

  async createBackup(sourceDir) {
    if (!this.exists(sourceDir)) {
      logger.info('No existing download found, skipping backup');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').substring(0, 19);
    const backupName = `backup_${timestamp}`;
    const parentDir = path.dirname(sourceDir);
    const backupDir = path.join(parentDir, backupName);

    try {
      logger.info(`Creating backup: ${backupName}`);
      await this.copyDirectory(sourceDir, backupDir);
      logger.success(`Backup created: ${backupDir}`);

      await this.cleanOldBackups(parentDir);

      return backupDir;
    } catch (error) {
      logger.error(`Failed to create backup: ${error.message}`);
      return null;
    }
  }

  async copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  async cleanOldBackups(parentDir) {
    try {
      const entries = fs.readdirSync(parentDir, { withFileTypes: true });
      const backups = entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('backup_'))
        .map(entry => ({
          name: entry.name,
          path: path.join(parentDir, entry.name),
          mtime: fs.statSync(path.join(parentDir, entry.name)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        logger.info(`Cleaning old backups, keeping latest ${this.maxBackups}`);

        for (const backup of toDelete) {
          logger.info(`Deleting old backup: ${backup.name}`);
          await this.deleteDirectory(backup.path);
        }

        logger.success(`Deleted ${toDelete.length} old backup(s)`);
      }
    } catch (error) {
      logger.error(`Failed to clean old backups: ${error.message}`);
    }
  }

  async deleteDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await this.deleteDirectory(fullPath);
        } else {
          fs.unlinkSync(fullPath);
        }
      }

      fs.rmdirSync(dirPath);
    }
  }

  listBackups(parentDir) {
    try {
      const entries = fs.readdirSync(parentDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('backup_'))
        .map(entry => ({
          name: entry.name,
          path: path.join(parentDir, entry.name),
          mtime: fs.statSync(path.join(parentDir, entry.name)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    } catch (error) {
      return [];
    }
  }
}

module.exports = BackupManager;
