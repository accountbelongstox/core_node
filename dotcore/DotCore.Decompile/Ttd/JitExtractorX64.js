"use strict";

function initializeScript() {
    return [new host.apiVersionSupport(1, 9)];
}

class DebuggerApi {
    static log(message) {
        host.diagnostics.debugLog(`${message}\n`);
    }

    static execute(command) {
        return Array.from(host.namespace.Debugger.Utility.Control.ExecuteCommand(command), line => line.toString());
    }

    static readUInt32(address) {
        return Number(host.memory.readMemoryValues(address, 1, 4)[0]);
    }

    static readPointer(address) {
        return host.memory.readMemoryValues(address, 1, 8)[0];
    }

    static readBytes(address, size) {
        return host.memory.readMemoryValues(address, size, 1);
    }
}

function field(lines, prefix) {
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(prefix)) {
            return trimmed.substring(prefix.length).trim();
        }
    }
    throw new Error(`Field '${prefix}' was not found. Debugger output: ${lines.join(" | ")}`);
}

function bytesToHex(bytes) {
    return Array.from(bytes, value => Number(value).toString(16).padStart(2, "0")).join("");
}

function writeText(path, text) {
    const fileSystem = host.namespace.Debugger.Utility.FileSystem;
    const file = fileSystem.CreateFile(path);
    const writer = fileSystem.CreateTextWriter(file, "Utf8");
    try {
        writer.WriteLine(text);
    } finally {
        file.Close();
    }
}

function writeReport(path, modulePath, methods, failures) {
    writeText(path, JSON.stringify({
        ModulesInfo: [{ ModuleName: modulePath, MethodsInfo: methods }],
        Failures: failures
    }, null, 2));
}

function invokeScript() {
    const outputPath = __OUTPUT_PATH__;
    const targetName = __TARGET_MODULE__;
    const calls = host.currentSession.TTD.Calls("clrjit!CILJit::compileMethod");
    const methods = [];
    const failures = [];
    const callCount = Number(calls.Count());
    let targetModuleKey = null;
    let targetModulePath = targetName;
    DebuggerApi.log(`Processing ${callCount} x64 JIT calls.`);

    for (let index = 0; index < callCount; index++) {
        try {
            calls[index].TimeStart.SeekTo();
            const methodInfo = host.currentThread.Registers.User.r8;
            const methodHandle = DebuggerApi.readPointer(methodInfo);
            const moduleHandle = DebuggerApi.readPointer(methodInfo.add(8));
            const moduleKey = moduleHandle.toString(16);
            if (targetModuleKey === null) {
                const moduleLines = DebuggerApi.execute(`!dumpmodule ${moduleKey}`);
                const moduleName = field(moduleLines, "Name:");
                if (!moduleName.toLowerCase().endsWith(targetName)) {
                    continue;
                }
                targetModuleKey = moduleKey;
                targetModulePath = moduleName;
                DebuggerApi.log(`Target module: ${targetModulePath} (${targetModuleKey}).`);
            } else if (moduleKey !== targetModuleKey) {
                continue;
            }

            const ilAddress = DebuggerApi.readPointer(methodInfo.add(0x10));
            const ilSize = DebuggerApi.readUInt32(methodInfo.add(0x18));
            const maxStack = DebuggerApi.readUInt32(methodInfo.add(0x1c));
            const exceptionHandlerCount = DebuggerApi.readUInt32(methodInfo.add(0x20));
            if (ilSize <= 0 || ilSize > 0x1000000) {
                throw new Error(`Invalid IL size ${ilSize}.`);
            }
            const ilBytes = bytesToHex(DebuggerApi.readBytes(ilAddress, ilSize));
            let methodLines = DebuggerApi.execute(`!dumpmd ${methodHandle.toString(16)}`);
            let tokenText;
            let methodName;
            try {
                tokenText = field(methodLines, "mdToken:");
                methodName = field(methodLines, "Method Name:");
            } catch (error) {
                try {
                    calls[index].TimeEnd.SeekTo();
                    methodLines = DebuggerApi.execute(`!dumpmd ${methodHandle.toString(16)}`);
                    tokenText = field(methodLines, "mdToken:");
                    methodName = field(methodLines, "Method Name:");
                } finally {
                    calls[index].TimeStart.SeekTo();
                }
            }
            methods.push({
                CallIndex: index,
                ModuleName: targetModulePath,
                MethodName: methodName,
                MethodToken: parseInt(tokenText, 16),
                ILBytes: ilBytes,
                ILSize: ilSize,
                MaxStack: maxStack,
                ExceptionHandlerCount: exceptionHandlerCount,
                LocalsSignatureBytes: "",
                ExceptionHandlers: []
            });
            if (methods.length % 25 === 0) {
                DebuggerApi.log(`Captured ${methods.length} target methods at call ${index}/${callCount}.`);
            }
        } catch (error) {
            failures.push({ CallIndex: index, Message: error.message });
            DebuggerApi.log(`Call ${index} failed: ${error.message}`);
        }
    }

    writeReport(outputPath, targetModulePath, methods, failures);
    DebuggerApi.log(`Finished: ${methods.length} target methods, ${failures.length} failures -> ${outputPath}`);
}
