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

import { natoAlphabet } from './text-to-nato-alphabet.constants';

export { textToNatoAlphabet };

function getLetterPositionInAlphabet({ letter }: { letter: string }) {
  return letter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
}

function textToNatoAlphabet({ text }: { text: string }) {
  return text
    .split('')
    .map((character) => {
      const alphabetIndex = getLetterPositionInAlphabet({ letter: character });
      const natoWord = natoAlphabet[alphabetIndex];

      return natoWord ?? character;
    })
    .join(' ');
}
