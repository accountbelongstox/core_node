/**
 * App Registry
 * Scans src/apps/ directory to discover and register all available apps
 * Replaces the old configs-based system
 */

import { Platform } from 'react-native';
import * as fs from 'fs';
import * as path from 'path';

export interface AppInfo {
  /** App namespace identifier (directory name) */
  namespace: string;
  /** App display name */
  displayName: string;
  /** App entry file path */
  entryPath: string;
  /** App entry component */
  AppComponent?: React.ComponentType<any>;
  /** Supported platforms */
  platforms: ('ios' | 'android' | 'web')[];
  /** App metadata */
  metadata?: {
    version?: string;
    bundleId?: string;
    description?: string;
  };
}

/**
 * Scan src/apps/ directory to discover all apps
 */
export function scanApps(): AppInfo[] {
  const appsDir = path.join(__dirname, '../../apps');
  const apps: AppInfo[] = [];

  if (!fs.existsSync(appsDir)) {
    console.warn(`Apps directory not found: ${appsDir}`);
    return apps;
  }

  const entries = fs.readdirSync(appsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const namespace = entry.name;
    const appDir = path.join(appsDir, namespace);
    const appEntryPath = path.join(appDir, 'App.tsx');

    // Check if App.tsx exists
    if (!fs.existsSync(appEntryPath)) {
      console.warn(`App entry not found for ${namespace}: ${appEntryPath}`);
      continue;
    }

    // Try to read app metadata from package.json or app.json if exists
    const packageJsonPath = path.join(appDir, 'package.json');
    const appJsonPath = path.join(appDir, 'app.json');
    
    let metadata: AppInfo['metadata'] = {};
    let displayName = namespace.charAt(0).toUpperCase() + namespace.slice(1);

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        displayName = packageJson.displayName || packageJson.name || displayName;
        metadata = {
          version: packageJson.version,
          description: packageJson.description,
        };
      } catch (e) {
        console.warn(`Failed to parse package.json for ${namespace}:`, e);
      }
    }

    if (fs.existsSync(appJsonPath)) {
      try {
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
        displayName = appJson.displayName || displayName;
        metadata.bundleId = appJson.bundleId;
      } catch (e) {
        console.warn(`Failed to parse app.json for ${namespace}:`, e);
      }
    }

    // Default to all platforms if not specified
    const platforms: AppInfo['platforms'] = ['ios', 'android', 'web'];

    apps.push({
      namespace,
      displayName,
      entryPath: appEntryPath,
      platforms,
      metadata,
    });
  }

  return apps;
}

/**
 * Get app by namespace
 */
export function getApp(namespace: string): AppInfo | undefined {
  const apps = scanApps();
  return apps.find((app) => app.namespace === namespace);
}

/**
 * Get all registered apps
 */
export function getAllApps(): AppInfo[] {
  return scanApps();
}

/**
 * Check if app exists
 */
export function appExists(namespace: string): boolean {
  return getApp(namespace) !== undefined;
}

/**
 * Get active app namespace
 * 
 * Note: In React Native, we cannot use process.env.
 * The active app is determined by which App.tsx is imported in index.js
 * This function returns a default value and should be overridden by app-specific logic
 */
export function getActiveAppNamespace(): string {
  // Default to 'awy' - this should be set by the app itself
  // The actual app is determined by index.js imports
  return 'awy';
}

/**
 * Load app component dynamically
 */
export async function loadAppComponent(namespace: string): Promise<React.ComponentType<any> | null> {
  try {
    const app = getApp(namespace);
    if (!app) {
      console.error(`App not found: ${namespace}`);
      return null;
    }

    // Dynamic import based on namespace
    // This will be handled by Metro bundler
    const appModule = await import(`../apps/${namespace}/App`);
    return appModule.default || appModule.App;
  } catch (error) {
    console.error(`Failed to load app component for ${namespace}:`, error);
    return null;
  }
}

