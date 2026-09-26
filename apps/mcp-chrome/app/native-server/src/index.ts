#!/usr/bin/env node
import serverInstance from './server';
import nativeMessagingHostInstance from './native-messaging-host';
import { watchOwnBuild } from './util/build-watch';

function shutdown(reason: string, exitCode: number): void {
  void nativeMessagingHostInstance.shutdown(reason, exitCode);
}

try {
  serverInstance.setNativeHost(nativeMessagingHostInstance);
  nativeMessagingHostInstance.setServer(serverInstance);
  nativeMessagingHostInstance.start();
  // A rebuilt host exits; the extension reconnect watchdog starts the new build.
  watchOwnBuild(__filename, () => shutdown('Native host build changed; restarting on the new build.', 0));
} catch (error) {
  shutdown('Native host initialization failed.', 1);
}

process.on('error', () => {
  shutdown('Native host process error.', 1);
});

// Handle process signals and uncaught exceptions
process.on('SIGINT', () => {
  shutdown('Native host received SIGINT.', 0);
});

process.on('SIGTERM', () => {
  shutdown('Native host received SIGTERM.', 0);
});

process.on('uncaughtException', () => {
  shutdown('Native host encountered an uncaught exception.', 1);
});

process.on('unhandledRejection', () => {
  shutdown('Native host encountered an unhandled rejection.', 1);
});
