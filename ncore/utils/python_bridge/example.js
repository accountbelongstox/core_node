const { PythonCaller, call, callModule } = require('./index');

async function exampleUsage() {
    const pythonBridge = new PythonCaller({
        verbose: true,
        timeout: 30000
    });

    console.log('\n=== Example 1: Check Python availability ===');
    const available = await pythonBridge.checkPythonAvailable();
    console.log('Python available:', available);

    if (available) {
        const version = await pythonBridge.getPythonVersion();
        console.log('Python version:', version);
    }

    console.log('\n=== Example 2: Call pycore module function ===');
    try {
        const result = await callModule(
            'pycore.pyfoundations.gvar.encyclopedia',
            'get_encyclopedia_info',
            {}
        );
        console.log('Encyclopedia info:', result);
    } catch (error) {
        console.error('Error:', error.message);
    }

    console.log('\n=== Example 3: Call simple Python script ===');
    try {
        const simpleResult = await call(
            'pyutils/examples/simple_example.py',
            { message: 'Hello from Node.js!' }
        );
        console.log('Simple result:', simpleResult);
    } catch (error) {
        console.error('Error:', error.message);
    }

    console.log('\n=== Example 4: Call with custom options ===');
    const customCaller = new PythonCaller({
        pythonPath: 'python3',
        verbose: true,
        timeout: 10000
    });

    try {
        const customResult = await customCaller.callModule(
            'pycore',
            'check_and_install_dependencies',
            { enable_gpu_setup: false }
        );
        console.log('Custom result:', customResult);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

if (require.main === module) {
    exampleUsage()
        .then(() => {
            console.log('\nAll examples completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Example failed:', error);
            process.exit(1);
        });
}

module.exports = exampleUsage;
