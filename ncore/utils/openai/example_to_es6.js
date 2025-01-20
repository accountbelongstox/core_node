const OpenAIChat = require('.');
const fs = require('fs');
const path = require('path');
// const { parseConversionResult } = require('./utils/xmlParser');
const CodeExtractor = require('./utils/codeExtractor');
const FileHandler = require('./utils/fileHandler');
const CodeAnalyzer = require('./utils/codeAnalyzer');
const { getConversionPrompt } = require('./prompts');

const importFiles = fs.readFileSync('D:\\programing\\core_node\\scripts\\import_files.txt', 'utf8');

async function processFiles() {
    const files = importFiles.split('\n');
    const filterExcludeEmpty = files.filter(file => file.trim() !== '');
    const totalFiles = filterExcludeEmpty.length;
    const chat = new OpenAIChat();

    const startTime = Date.now();
    let processedCount = 0;

    // Process each file
    for (const filePath of filterExcludeEmpty) {
        if (!filePath.trim()) continue;

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.warn(`\nSkipping non-existent file: ${filePath}`);
            console.log('----------------------------------------\n');
            continue;
        }

        processedCount++;
        const remainingFiles = totalFiles - processedCount;
        const elapsedTime = (Date.now() - startTime) / 1000;
        const averageTimePerFile = processedCount > 1 ? elapsedTime / (processedCount - 1) : 0;
        const estimatedRemainingTime = remainingFiles * averageTimePerFile;

        console.log('\n========== Progress Info ==========');
        console.log(`Processing file ${processedCount}/${totalFiles}`);
        console.log(`Remaining files: ${remainingFiles}`);
        console.log(`Elapsed time: ${elapsedTime.toFixed(1)}s`);
        console.log(`Average time per file: ${averageTimePerFile.toFixed(1)}s`);
        console.log(`Estimated remaining time: ${estimatedRemainingTime.toFixed(1)}s`);
        console.log('==================================\n');

        try {
            // Read file content
            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            // Analyze code for ES6 features
            const analysis = CodeAnalyzer.hasES6Features(fileContent);
            const analysisMessage = CodeAnalyzer.getAnalysisMessage(analysis, filePath);
            console.log('\n' + analysisMessage);
            
            // Skip if no conversion needed
            if (!analysis.needsConversion) {
                console.log('----------------------------------------\n');
                continue;
            }
            
            // Get prompt from configuration
            const prompt = getConversionPrompt(filePath, fileContent);

            console.log('----------------------------------------');
            
            // Call API and wait for complete response
            const result = await chat.streamChat(
                prompt,
                (content) => process.stdout.write(content),
                true
            );

            // Extract code using the new helper
            const codeResult = CodeExtractor.extractCode(result, filePath);
            if (codeResult) {
                console.log('\nExtracted Code Information:');
                console.log(`Total Lines: ${codeResult.totalLines}`);
                
                // Attempt to safely replace the file
                const replaceResult = await FileHandler.safeReplaceFile(codeResult, filePath);
                
                if (replaceResult.success) {
                    console.log('\nFile successfully updated:');
                    console.log(`Original lines: ${replaceResult.originalLines}`);
                    console.log(`New lines: ${replaceResult.newLines}`);
                    console.log(`Backup saved at: ${replaceResult.backupPath}`);
                } else {
                    console.error('\nFile update failed:', replaceResult.error);
                    console.log('Original file unchanged');
                    if (replaceResult.backupPath) {
                        console.log(`Backup available at: ${replaceResult.backupPath}`);
                    }
                }
            }

            console.log('\n----------------------------------------');
            console.log(`Completed processing: ${filePath}`);
            console.log('----------------------------------------\n');

            // Optional: Save result to file
            // fs.writeFileSync(`${filePath}.analysis.txt`, result, 'utf8');

            // Add delay to avoid too frequent requests
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`Error processing ${filePath}:`, error);
        }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    console.log('\n========== Final Statistics ==========');
    console.log(`Total files processed: ${processedCount}`);
    console.log(`Total time taken: ${totalTime.toFixed(1)}s`);
    console.log(`Average time per file: ${(totalTime / processedCount).toFixed(1)}s`);
    console.log('=====================================\n');
}

processFiles().catch(console.error); 