"use strict";

function initializeScript() {
    return [new host.apiVersionSupport(1, 9)];
}

function readUInt32(address) {
    return Number(host.memory.readMemoryValues(address, 1, 4)[0]);
}

function readPointer(address) {
    return host.memory.readMemoryValues(address, 1, 8)[0];
}

function safeReadUInt32(address) {
    try {
        return readUInt32(address);
    } catch (_) {
        return 0;
    }
}

function safeReadPointer(address) {
    try {
        return readPointer(address);
    } catch (_) {
        return host.parseInt64(0);
    }
}

function pointerText(value) {
    return `0x${value.toString(16)}`;
}

function positionText(value) {
    return value.toString();
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

function invokeScript() {
    const outputPath = __OUTPUT_PATH__;
    const helperAddress = __HELPER_ADDRESS__;
    const calls = host.currentSession.TTD.Calls(helperAddress);
    const jitCalls = host.currentSession.TTD.Calls("clrjit!CILJit::compileMethod");
    const records = [];
    const jitRecords = [];
    const failures = [];
    const callCount = Number(calls.Count());
    const jitCallCount = Number(jitCalls.Count());
    host.diagnostics.debugLog(`Processing ${callCount} HVM token helper calls.\n`);

    for (let index = 0; index < jitCallCount; index++) {
        jitRecords.push({
            Index: index,
            StartPosition: positionText(jitCalls[index].TimeStart),
            EndPosition: positionText(jitCalls[index].TimeEnd)
        });
    }

    for (let index = 0; index < callCount; index++) {
        try {
            calls[index].TimeStart.SeekTo();
            const registers = host.currentThread.Registers.User;
            const proxyBase = registers.rcx.subtract(8);
            const returnAddress = readPointer(registers.rsp);
            const resolvedTokenPointer = safeReadPointer(proxyBase.add(0x290));
            const virtualToken = Number(registers.edx) >>> 0;
            const argumentPointer = registers.r8;
            calls[index].TimeEnd.SeekTo();
            const typeHandle = safeReadPointer(resolvedTokenPointer.add(0x18));
            const methodHandle = safeReadPointer(resolvedTokenPointer.add(0x20));
            const fieldHandle = safeReadPointer(resolvedTokenPointer.add(0x28));
            const typeTag = Number(typeHandle) & 3;
            const typeDescriptor = typeHandle.subtract(typeTag);
            const typeParameterHandle = typeTag === 0 ? host.parseInt64(0) : safeReadPointer(typeDescriptor.add(0x10));
            const typeDefinitionHandle = typeTag === 0 ? typeHandle : typeParameterHandle;
            const typeRid = (safeReadUInt32(typeHandle.add(8)) >>> 16) & 0xffff;
            const resolvedTypeRid = (safeReadUInt32(typeDefinitionHandle.add(8)) >>> 16) & 0xffff;
            const methodRid = safeReadUInt32(methodHandle) & 0xffff;
            const fieldRid = safeReadUInt32(fieldHandle.add(8)) & 0x0003ffff;
            records.push({
                Index: index,
                StartPosition: positionText(calls[index].TimeStart),
                EndPosition: positionText(calls[index].TimeEnd),
                ReturnAddress: pointerText(returnAddress),
                VirtualToken: virtualToken,
                ProxyBase: pointerText(proxyBase),
                ArgumentPointer: pointerText(argumentPointer),
                ResolvedTokenPointer: pointerText(resolvedTokenPointer),
                TokenAfter: safeReadUInt32(resolvedTokenPointer.add(0x10)),
                ModuleHandle: pointerText(safeReadPointer(typeHandle.add(0x18))),
                TypeHandle: pointerText(typeHandle),
                TypeDescriptorKind: typeTag === 0 ? 0 : (safeReadUInt32(typeDescriptor) & 0xff),
                TypeModuleHandle: pointerText(safeReadPointer(typeDefinitionHandle.add(0x18))),
                ResolvedTypeDefinitionToken: resolvedTypeRid === 0 ? 0 : (0x02000000 | resolvedTypeRid),
                MethodHandle: pointerText(methodHandle),
                FieldHandle: pointerText(fieldHandle),
                TypeDefinitionToken: typeRid === 0 ? 0 : (0x02000000 | typeRid),
                MethodDefinitionToken: methodRid === 0 ? 0 : (0x06000000 | methodRid),
                FieldDefinitionToken: fieldRid === 0 ? 0 : (0x04000000 | fieldRid)
            });
            if (records.length % 250 === 0) {
                host.diagnostics.debugLog(`Captured ${records.length}/${callCount} HVM token helper calls.\n`);
            }
        } catch (error) {
            failures.push({ Index: index, Message: error.message });
        }
    }

    writeText(outputPath, JSON.stringify({ Calls: records, JitCalls: jitRecords, Failures: failures }, null, 2));
    host.diagnostics.debugLog(`Finished HVM token extraction: ${records.length} calls, ${failures.length} failures.\n`);
}
