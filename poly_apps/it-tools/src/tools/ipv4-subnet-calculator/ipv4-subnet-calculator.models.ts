// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

export { getIPClass };

function getIPClass({ ip }: { ip: string }) {
  const [firstOctet] = ip.split('.').map(Number);

  if (firstOctet < 128) {
    return 'A';
  }
  if (firstOctet > 127 && firstOctet < 192) {
    return 'B';
  }
  if (firstOctet > 191 && firstOctet < 224) {
    return 'C';
  }
  if (firstOctet > 223 && firstOctet < 240) {
    return 'D';
  }
  if (firstOctet > 239 && firstOctet < 256) {
    return 'E';
  }

  return undefined;
}
