#!/usr/bin/env node
import { COMMAND_NAME } from './constant';
import { colorText, registerWithElevatedPermissions } from './utils';

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log(colorText(`Registering ${COMMAND_NAME} Native Messaging host...`, 'blue'));

  try {
    await registerWithElevatedPermissions();
    console.log(
      colorText('Registration successful! Chrome extension can now communicate with local service via Native Messaging.', 'green'),
    );
  } catch (error: any) {
    console.error(colorText(`Registration failed: ${error.message}`, 'red'));
    process.exit(1);
  }
}

// Execute main function
main();
