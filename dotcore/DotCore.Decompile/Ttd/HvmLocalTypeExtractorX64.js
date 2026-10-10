"use strict";

function initializeScript() {
    return [new host.apiVersionSupport(1, 9)];
}

function readPointer(address) {
    return host.memory.readMemoryValues(address, 1, 8)[0];
}

function readUInt32(address) {
    return Number(host.memory.readMemoryValues(address, 1, 4)[0]);
}

function safeReadPointer(address) {
    try {
        return readPointer(address);
    } catch (_) {
        return host.parseInt64(0);
    }
}

function safeReadUInt32(address) {
    try {
        return readUInt32(address);
    } catch (_) {
        return 0;
    }
}

function pointerText(value) {
    return `0x${value.toString(16)}`;
}

function signatureBytes(address) {
    try {
        return Array.from(host.memory.readMemoryValues(address, 0x70, 1),
            value => Number(value).toString(16).padStart(2, "0")).join("");
    } catch (_) {
        return "";
    }
}

function signatureDetails(address) {
    const signaturePointer = safeReadPointer(address.add(0x48));
    const signatureLength = safeReadUInt32(address.add(0x50));
    let data = "";
    try {
        if (signaturePointer.toString(16) !== "0" && signatureLength > 0) {
            data = Array.from(host.memory.readMemoryValues(signaturePointer,
                Math.min(signatureLength, 64), 1),
                value => Number(value).toString(16).padStart(2, "0")).join("");
        }
    } catch (_) {
        data = "";
    }
    return { SignaturePointer: pointerText(signaturePointer), SignatureLength: signatureLength,
        SignatureData: data };
}

function hasLocalSignatureBlob(details) {
    return details.SignatureData.length >= 2 && details.SignatureData.substring(0, 2) === "07";
}

function parsePosition(value) {
    if (value === "Min Position") return [0, 0];
    if (value === "Max Position") return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    const parts = value.split(":");
    return [parseInt(parts[0], 16), parseInt(parts[1], 16)];
}

function comparePosition(left, right) {
    return left[0] === right[0] ? left[1] - right[1] : left[0] - right[0];
}

function findRange(ranges, position) {
    let best = null;
    for (const range of ranges) {
        if (comparePosition(range.Start, position) <= 0 && comparePosition(range.End, position) >= 0
            && (best === null || comparePosition(range.Start, best.Start) > 0)) {
            best = range;
        }
    }
    return best;
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
    const getArgTypeAddress = __GET_ARG_TYPE_ADDRESS__;
    const getArgClassAddress = __GET_ARG_CLASS_ADDRESS__;
    const rangeInput = __JIT_RANGES__;
    const jitCalls = host.currentSession.TTD.Calls("clrjit!CILJit::compileMethod");
    const selectedRanges = rangeInput.map(range => ({
        Index: range.Index,
        Start: parsePosition(range.StartPosition),
        End: parsePosition(range.EndPosition),
        LocalsSignatureInfo: "",
        SignatureBytes: ""
    }));
    const selectedByIndex = {};
    const ranges = [];
    const jitCallCount = Number(jitCalls.Count());
    for (const range of selectedRanges) selectedByIndex[range.Index] = range;
    for (let index = 0; index < jitCallCount; index++) {
        ranges.push({
            Index: index,
            Start: parsePosition(jitCalls[index].TimeStart.toString()),
            End: parsePosition(jitCalls[index].TimeEnd.toString())
        });
    }
    const argTypeCalls = host.currentSession.TTD.Calls(getArgTypeAddress);
    const argClassCalls = host.currentSession.TTD.Calls(getArgClassAddress);
    const records = [];
    const classes = [];
    const failures = [];
    const signatures = [];
    const methodSignatures = [];

    for (const range of selectedRanges) {
        try {
            jitCalls[range.Index].TimeStart.SeekTo();
            range.LocalsSignatureInfo = pointerText(host.currentThread.Registers.User.r8.add(0x98));
            range.SignatureBytes = signatureBytes(host.currentThread.Registers.User.r8.add(0x98));
            methodSignatures.push({ JitCallIndex: range.Index,
                LocalsSignatureInfo: range.LocalsSignatureInfo, Bytes: range.SignatureBytes,
                Details: signatureDetails(host.currentThread.Registers.User.r8.add(0x98)),
                JitInterface: pointerText(host.currentThread.Registers.User.rdx),
                JitInterfaceVtable: pointerText(safeReadPointer(host.currentThread.Registers.User.rdx)) });
        } catch (error) {
            failures.push({ JitCallIndex: range.Index, Message: error.message });
        }
    }

    const callCount = Number(argTypeCalls.Count());
    host.diagnostics.debugLog(`Processing ${callCount} runtime getArgType calls for ${selectedRanges.length} HVM methods.\n`);
    for (let index = 0; index < callCount; index++) {
        const startText = argTypeCalls[index].TimeStart.toString();
        const containingRange = findRange(ranges, parsePosition(startText));
        const range = containingRange === null ? null : selectedByIndex[containingRange.Index];
        if (range === null || range === undefined) continue;
        try {
            argTypeCalls[index].TimeStart.SeekTo();
            const registers = host.currentThread.Registers.User;
            const signatureInfo = pointerText(registers.rdx);
            if (signatureInfo !== range.LocalsSignatureInfo) {
                const observed = signatureBytes(registers.rdx);
                const details = signatureDetails(registers.rdx);
                signatures.push({ Kind: "Type", JitCallIndex: range.Index, SignatureInfo: signatureInfo,
                    StartPosition: startText, Expected: range.SignatureBytes, Observed: observed,
                    Details: details });
                if ((range.SignatureBytes === "" || observed !== range.SignatureBytes)
                    && !hasLocalSignatureBlob(details)) continue;
            }
            const argumentPointer = registers.r8;
            const typeHandlePointer = registers.r9;
            argTypeCalls[index].TimeEnd.SeekTo();
            const typeHandle = safeReadPointer(typeHandlePointer);
            const hasTypeHandle = typeHandle.toString(16) !== "0";
            const tag = Number(typeHandle) & 3;
            const descriptor = typeHandle.subtract(tag);
            const parameterTypeHandle = tag === 0 ? host.parseInt64(0) : safeReadPointer(descriptor.add(0x10));
            const definitionHandle = tag === 0 ? typeHandle : parameterTypeHandle;
            const typeRid = !hasTypeHandle ? 0 : ((safeReadUInt32(definitionHandle.add(8)) >>> 16) & 0xffff);
            records.push({
                CallIndex: index,
                JitCallIndex: range.Index,
                ArgumentPointer: pointerText(argumentPointer),
                CorInfoType: Number(host.currentThread.Registers.User.eax) >>> 0,
                TypeHandle: pointerText(typeHandle),
                TypeDescriptorKind: tag === 0 ? 0 : (safeReadUInt32(descriptor) & 0xff),
                ModuleHandle: !hasTypeHandle ? "0x0" : pointerText(safeReadPointer(definitionHandle.add(0x18))),
                TypeDefinitionToken: typeRid === 0 ? 0 : (0x02000000 | typeRid)
            });
        } catch (error) {
            failures.push({ CallIndex: index, JitCallIndex: range.Index, Message: error.message });
        }
    }

    const classCallCount = Number(argClassCalls.Count());
    host.diagnostics.debugLog(`Processing ${classCallCount} runtime getArgClass calls.\n`);
    for (let index = 0; index < classCallCount; index++) {
        const startText = argClassCalls[index].TimeStart.toString();
        const containingRange = findRange(ranges, parsePosition(startText));
        const range = containingRange === null ? null : selectedByIndex[containingRange.Index];
        if (range === null || range === undefined) continue;
        try {
            argClassCalls[index].TimeStart.SeekTo();
            const registers = host.currentThread.Registers.User;
            const signatureInfo = pointerText(registers.rdx);
            if (signatureInfo !== range.LocalsSignatureInfo) {
                const observed = signatureBytes(registers.rdx);
                const details = signatureDetails(registers.rdx);
                signatures.push({ Kind: "Class", JitCallIndex: range.Index, SignatureInfo: signatureInfo,
                    StartPosition: startText, Expected: range.SignatureBytes, Observed: observed,
                    Details: details });
                if ((range.SignatureBytes === "" || observed !== range.SignatureBytes)
                    && !hasLocalSignatureBlob(details)) continue;
            }
            const argumentPointer = registers.r8;
            argClassCalls[index].TimeEnd.SeekTo();
            const typeHandle = host.currentThread.Registers.User.rax;
            const tag = Number(typeHandle) & 3;
            const descriptor = typeHandle.subtract(tag);
            const parameterTypeHandle = tag === 0 ? host.parseInt64(0) : safeReadPointer(descriptor.add(0x10));
            const definitionHandle = tag === 0 ? typeHandle : parameterTypeHandle;
            const typeRid = (safeReadUInt32(definitionHandle.add(8)) >>> 16) & 0xffff;
            classes.push({
                CallIndex: index,
                JitCallIndex: range.Index,
                ArgumentPointer: pointerText(argumentPointer),
                TypeHandle: pointerText(typeHandle),
                TypeDescriptorKind: tag === 0 ? 0 : (safeReadUInt32(descriptor) & 0xff),
                ParameterTypeHandle: pointerText(parameterTypeHandle),
                ModuleHandle: pointerText(safeReadPointer(definitionHandle.add(0x18))),
                TypeDefinitionToken: typeRid === 0 ? 0 : (0x02000000 | typeRid)
            });
        } catch (error) {
            failures.push({ CallIndex: index, JitCallIndex: range.Index, Message: error.message });
        }
    }

    writeText(outputPath, JSON.stringify({ Locals: records, Classes: classes, Failures: failures,
        Signatures: signatures, MethodSignatures: methodSignatures }, null, 2));
    host.diagnostics.debugLog(`Finished HVM local extraction: ${records.length} types, ${classes.length} classes, ${failures.length} failures.\n`);
}
