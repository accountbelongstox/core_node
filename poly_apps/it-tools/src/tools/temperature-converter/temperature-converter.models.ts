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

export const convertCelsiusToKelvin = (temperature: number) => temperature + 273.15;
export const convertKelvinToCelsius = (temperature: number) => temperature - 273.15;

export const convertFahrenheitToKelvin = (temperature: number) => (temperature + 459.67) * (5 / 9);
export const convertKelvinToFahrenheit = (temperature: number) => temperature * (9 / 5) - 459.67;

export const convertRankineToKelvin = (temperature: number) => temperature * (5 / 9);
export const convertKelvinToRankine = (temperature: number) => temperature * (9 / 5);

export const convertDelisleToKelvin = (temperature: number) => 373.15 - (2 / 3) * temperature;
export const convertKelvinToDelisle = (temperature: number) => (3 / 2) * (373.15 - temperature);

export const convertNewtonToKelvin = (temperature: number) => temperature * (100 / 33) + 273.15;
export const convertKelvinToNewton = (temperature: number) => (temperature - 273.15) * (33 / 100);

export const convertReaumurToKelvin = (temperature: number) => temperature * (5 / 4) + 273.15;
export const convertKelvinToReaumur = (temperature: number) => (temperature - 273.15) * (4 / 5);

export const convertRomerToKelvin = (temperature: number) => (temperature - 7.5) * (40 / 21) + 273.15;
export const convertKelvinToRomer = (temperature: number) => (temperature - 273.15) * (21 / 40) + 7.5;
