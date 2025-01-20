const OpenAIChat = require('.');
const fs = require('fs');
const path = require('path');
// const { parseConversionResult } = require('./utils/xmlParser');
const CodeExtractor = require('./utils/codeExtractor');
const FileHandler = require('./utils/fileHandler');
const CodeAnalyzer = require('./utils/codeAnalyzer');
const { getConversionPrompt } = require('./prompts');
const ModuleExtractor = require('./utils/moduleExtractor');

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

            // Extract modules using the new helper
            const moduleResult = ModuleExtractor.extractModules(result);
            if (moduleResult) {
                console.log('\nExtracted Module Information:');
                console.log(`Original File: ${moduleResult.originalFile.filePath}`);
                console.log(`Number of Modules: ${moduleResult.modules.length}`);
                
                // Print module information
                moduleResult.modules.forEach((module, index) => {
                    console.log(`\nModule ${index + 1}:`);
                    console.log(`Path: ${module.filePath}`);
                    console.log(`Content Length: ${module.content.length} characters`);
                });

                // Optionally save all files
                const saved = await moduleResult.saveFiles();
                if (saved) {
                    console.log('\nAll files saved successfully');
                } else {
                    console.error('\nError saving files');
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