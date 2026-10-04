// PY-REF: none (DOT-only)
using System.Text;
using Iced.Intel;

namespace DotCore.Decompile.Dynamic;

public sealed class NativeHvmSection
{
    public NativeHvmSection(string name, ulong address, uint virtualSize, uint rawOffset, uint rawSize,
        bool executable, bool readable)
    {
        Name = name;
        Address = address;
        VirtualSize = virtualSize;
        RawOffset = rawOffset;
        RawSize = rawSize;
        Executable = executable;
        Readable = readable;
    }

    public string Name { get; }
    public ulong Address { get; }
    public uint VirtualSize { get; }
    public uint RawOffset { get; }
    public uint RawSize { get; }
    public bool Executable { get; }
    public bool Readable { get; }
}

public sealed class NativeHvmPointerTable
{
    public NativeHvmPointerTable(ulong address, int entryCount, IReadOnlyList<ulong> targets,
        IReadOnlyList<ulong> references)
    {
        Address = address;
        EntryCount = entryCount;
        Targets = targets;
        References = references;
    }

    public ulong Address { get; }
    public int EntryCount { get; }
    public IReadOnlyList<ulong> Targets { get; }
    public IReadOnlyList<ulong> References { get; }
}

public sealed class NativeHvmIndirectBranch
{
    public NativeHvmIndirectBranch(ulong address, string mnemonic, string memoryBase, string memoryIndex,
        int memoryScale, ulong memoryDisplacement)
    {
        Address = address;
        Mnemonic = mnemonic;
        MemoryBase = memoryBase;
        MemoryIndex = memoryIndex;
        MemoryScale = memoryScale;
        MemoryDisplacement = memoryDisplacement;
    }

    public ulong Address { get; }
    public string Mnemonic { get; }
    public string MemoryBase { get; }
    public string MemoryIndex { get; }
    public int MemoryScale { get; }
    public ulong MemoryDisplacement { get; }
}

public sealed class NativeHvmMarker
{
    public NativeHvmMarker(string text, ulong address, IReadOnlyList<ulong> references)
    {
        Text = text;
        Address = address;
        References = references;
    }

    public string Text { get; }
    public ulong Address { get; }
    public IReadOnlyList<ulong> References { get; }
}

public sealed class NativeHvmAnalysisReport
{
    public NativeHvmAnalysisReport(string inputPath, string machine, int bitness, ulong imageBase,
        IReadOnlyList<NativeHvmSection> sections, IReadOnlyList<NativeHvmPointerTable> candidatePointerTables,
        IReadOnlyList<NativeHvmIndirectBranch> indirectBranches, IReadOnlyList<NativeHvmMarker> markers,
        IReadOnlyList<NativeHvmImport> imports, IReadOnlyList<NativeHvmIndirectBranch> indirectCalls)
    {
        InputPath = inputPath;
        Machine = machine;
        Bitness = bitness;
        ImageBase = imageBase;
        Sections = sections;
        CandidatePointerTables = candidatePointerTables;
        IndirectBranches = indirectBranches;
        Markers = markers;
        Imports = imports;
        IndirectCalls = indirectCalls;
    }

    public string InputPath { get; }
    public string Machine { get; }
    public int Bitness { get; }
    public ulong ImageBase { get; }
    public IReadOnlyList<NativeHvmSection> Sections { get; }
    public IReadOnlyList<NativeHvmPointerTable> CandidatePointerTables { get; }
    public IReadOnlyList<NativeHvmIndirectBranch> IndirectBranches { get; }
    public IReadOnlyList<NativeHvmMarker> Markers { get; }
    public IReadOnlyList<NativeHvmImport> Imports { get; }
    public IReadOnlyList<NativeHvmIndirectBranch> IndirectCalls { get; }
}

public sealed class NativeHvmImport
{
    public NativeHvmImport(string module, string name, ulong iatAddress, int ordinal)
    {
        Module = module;
        Name = name;
        IatAddress = iatAddress;
        Ordinal = ordinal;
    }

    public string Module { get; }
    public string Name { get; }
    public ulong IatAddress { get; }
    public int Ordinal { get; }
}

public sealed class NativeHvmInstruction
{
    public NativeHvmInstruction(ulong address, int length, string text, string flowControl,
        ulong nearBranchTarget, ulong memoryAddress)
    {
        Address = address;
        Length = length;
        Text = text;
        FlowControl = flowControl;
        NearBranchTarget = nearBranchTarget;
        MemoryAddress = memoryAddress;
    }

    public ulong Address { get; }
    public int Length { get; }
    public string Text { get; }
    public string FlowControl { get; }
    public ulong NearBranchTarget { get; }
    public ulong MemoryAddress { get; }
}

public sealed class NativeHvmAnalyzer
{
    private const ushort Pe32Magic = 0x10B;
    private const ushort Pe32PlusMagic = 0x20B;
    private const uint ExecutableSection = 0x20000000;
    private const uint ReadableSection = 0x40000000;
    private const int MinimumPointerTableEntries = 4;
    private const int MaximumReportedTargets = 256;
    private static readonly string[] RuntimeMarkers =
    {
        "DNGuard HVM", "clrjit.dll", "mscorjit.dll", "coreclr.dll", "clr.dll", "getJit",
        "HVMRuntime.dll", "DNGuard Runtime Error", "ICorMethodInfo", "ICorJitInfo", "HVMEEProxy"
    };

    public NativeHvmAnalysisReport Analyze(string path)
    {
        return AnalyzeCore(path, false);
    }

    public NativeHvmAnalysisReport AnalyzeMappedImage(string path)
    {
        return AnalyzeCore(path, true);
    }

    public IReadOnlyList<NativeHvmInstruction> Disassemble(string path, ulong address, int instructionCount,
        bool mappedImage = false)
    {
        string inputPath = Path.GetFullPath(path);
        byte[] image;
        PeLayout layout;
        NativeHvmSection? section;
        int rawOffset;
        int available;
        byte[] code;
        Iced.Intel.Decoder decoder;
        var result = new List<NativeHvmInstruction>();
        if (instructionCount <= 0)
            throw new ArgumentOutOfRangeException(nameof(instructionCount));
        image = File.ReadAllBytes(inputPath);
        layout = ReadLayout(image, mappedImage);
        section = layout.Sections.FirstOrDefault(item => address >= item.Address
            && address < item.Address + Math.Max(item.VirtualSize, item.RawSize));
        if (section == null)
            throw new ArgumentOutOfRangeException(nameof(address), "The address is outside all PE sections.");
        rawOffset = checked((int)(section.RawOffset + address - section.Address));
        available = Math.Min(image.Length - rawOffset,
            checked((int)(section.RawSize - (address - section.Address))));
        code = new byte[available];
        Buffer.BlockCopy(image, rawOffset, code, 0, available);
        decoder = Iced.Intel.Decoder.Create(layout.Bitness, new ByteArrayCodeReader(code));
        decoder.IP = address;
        while (result.Count < instructionCount && decoder.IP < address + (ulong)available)
        {
            decoder.Decode(out Instruction instruction);
            ulong memoryAddress;
            if (instruction.Length == 0)
                break;
            memoryAddress = instruction.IsIPRelativeMemoryOperand
                ? instruction.IPRelativeMemoryAddress
                : instruction.MemoryDisplacement64;
            result.Add(new NativeHvmInstruction(instruction.IP, instruction.Length, instruction.ToString(),
                instruction.FlowControl.ToString(), instruction.NearBranchTarget, memoryAddress));
        }
        return result;
    }

    private static NativeHvmAnalysisReport AnalyzeCore(string path, bool mappedImage)
    {
        string inputPath = Path.GetFullPath(path);
        byte[] image;
        PeLayout layout;
        List<DecodedInstruction> instructions;
        List<NativeHvmPointerTable> pointerTables;
        List<NativeHvmIndirectBranch> indirectBranches;
        List<NativeHvmMarker> markers;
        List<NativeHvmImport> imports;
        List<NativeHvmIndirectBranch> indirectCalls;
        if (!File.Exists(inputPath))
            throw new FileNotFoundException("The native runtime was not found.", inputPath);

        image = File.ReadAllBytes(inputPath);
        layout = ReadLayout(image, mappedImage);
        instructions = DecodeExecutableSections(image, layout);
        pointerTables = FindPointerTables(image, layout, instructions);
        indirectBranches = FindIndirectBranches(instructions);
        markers = FindMarkers(image, layout, instructions);
        imports = ReadImports(image, layout);
        indirectCalls = FindIndirectCalls(instructions);
        return new NativeHvmAnalysisReport(inputPath, GetMachineName(layout.Machine), layout.Bitness,
            layout.ImageBase, layout.Sections, pointerTables, indirectBranches, markers, imports, indirectCalls);
    }

    private static PeLayout ReadLayout(byte[] image, bool mappedImage)
    {
        int peOffset;
        ushort machine;
        ushort sectionCount;
        ushort optionalHeaderSize;
        int optionalHeaderOffset;
        ushort magic;
        int bitness;
        ulong imageBase;
        uint importTableRva;
        uint importTableSize;
        int dataDirectoryOffset;
        int sectionTableOffset;
        var sections = new List<NativeHvmSection>();
        if (image.Length < 0x40 || ReadUInt16(image, 0) != 0x5A4D)
            throw new BadImageFormatException("The file does not have a DOS header.");
        peOffset = ReadInt32(image, 0x3C);
        if (peOffset < 0 || peOffset + 24 > image.Length || ReadUInt32(image, peOffset) != 0x00004550)
            throw new BadImageFormatException("The file does not have a valid PE header.");
        machine = ReadUInt16(image, peOffset + 4);
        sectionCount = ReadUInt16(image, peOffset + 6);
        optionalHeaderSize = ReadUInt16(image, peOffset + 20);
        optionalHeaderOffset = peOffset + 24;
        if (optionalHeaderOffset + optionalHeaderSize > image.Length)
            throw new BadImageFormatException("The PE optional header is truncated.");
        magic = ReadUInt16(image, optionalHeaderOffset);
        if (magic == Pe32PlusMagic)
        {
            bitness = 64;
            imageBase = ReadUInt64(image, optionalHeaderOffset + 24);
        }
        else if (magic == Pe32Magic)
        {
            bitness = 32;
            imageBase = ReadUInt32(image, optionalHeaderOffset + 28);
        }
        else
        {
            throw new BadImageFormatException("The PE optional header has an unsupported format.");
        }
        dataDirectoryOffset = optionalHeaderOffset + (bitness == 64 ? 112 : 96);
        importTableRva = ReadUInt32(image, dataDirectoryOffset + 8);
        importTableSize = ReadUInt32(image, dataDirectoryOffset + 12);
        sectionTableOffset = optionalHeaderOffset + optionalHeaderSize;
        for (int index = 0; index < sectionCount; index++)
        {
            int offset = sectionTableOffset + index * 40;
            string name;
            uint virtualSize;
            uint virtualAddress;
            uint rawSize;
            uint rawOffset;
            uint characteristics;
            if (offset + 40 > image.Length)
                throw new BadImageFormatException("The PE section table is truncated.");
            name = Encoding.ASCII.GetString(image, offset, 8).TrimEnd('\0');
            virtualSize = ReadUInt32(image, offset + 8);
            virtualAddress = ReadUInt32(image, offset + 12);
            rawSize = mappedImage ? virtualSize : ReadUInt32(image, offset + 16);
            rawOffset = mappedImage ? virtualAddress : ReadUInt32(image, offset + 20);
            if ((ulong)rawOffset + rawSize > (ulong)image.Length)
                rawSize = rawOffset >= image.Length ? 0 : checked((uint)(image.Length - rawOffset));
            characteristics = ReadUInt32(image, offset + 36);
            sections.Add(new NativeHvmSection(name, imageBase + virtualAddress, virtualSize, rawOffset,
                rawSize, (characteristics & ExecutableSection) != 0, (characteristics & ReadableSection) != 0));
        }
        return new PeLayout(machine, bitness, imageBase, importTableRva, importTableSize, sections);
    }

    private static List<NativeHvmImport> ReadImports(byte[] image, PeLayout layout)
    {
        int pointerSize = layout.Bitness / 8;
        var imports = new List<NativeHvmImport>();
        if (layout.ImportTableRva == 0 || layout.ImportTableSize < 20)
            return imports;
        int descriptorOffset = RvaToFileOffset(layout.ImportTableRva, layout);
        int descriptorEnd = Math.Min(image.Length,
            checked(descriptorOffset + (int)layout.ImportTableSize));
        while (descriptorOffset + 20 <= descriptorEnd)
        {
            uint originalFirstThunk = ReadUInt32(image, descriptorOffset);
            uint nameRva = ReadUInt32(image, descriptorOffset + 12);
            uint firstThunk = ReadUInt32(image, descriptorOffset + 16);
            uint namesThunk;
            string module;
            int thunkOffset;
            int index = 0;
            if (originalFirstThunk == 0 && nameRva == 0 && firstThunk == 0)
                break;
            namesThunk = originalFirstThunk == 0 ? firstThunk : originalFirstThunk;
            module = ReadAsciiString(image, RvaToFileOffset(nameRva, layout));
            thunkOffset = RvaToFileOffset(namesThunk, layout);
            while (thunkOffset + pointerSize <= image.Length)
            {
                ulong thunk = pointerSize == 8 ? ReadUInt64(image, thunkOffset) : ReadUInt32(image, thunkOffset);
                ulong ordinalFlag = pointerSize == 8 ? 0x8000000000000000UL : 0x80000000UL;
                string name;
                int ordinal;
                if (thunk == 0)
                    break;
                if ((thunk & ordinalFlag) != 0)
                {
                    ordinal = checked((int)(thunk & 0xFFFF));
                    name = "#" + ordinal;
                }
                else
                {
                    ordinal = 0;
                    name = ReadAsciiString(image, RvaToFileOffset(checked((uint)thunk), layout) + 2);
                }
                imports.Add(new NativeHvmImport(module, name,
                    layout.ImageBase + firstThunk + checked((uint)(index * pointerSize)), ordinal));
                index++;
                thunkOffset += pointerSize;
            }
            descriptorOffset += 20;
        }
        return imports;
    }

    private static List<DecodedInstruction> DecodeExecutableSections(byte[] image, PeLayout layout)
    {
        var result = new List<DecodedInstruction>();
        foreach (NativeHvmSection section in layout.Sections.Where(item => item.Executable && item.RawSize > 0))
        {
            int rawOffset = checked((int)section.RawOffset);
            int rawSize = checked((int)Math.Min(section.RawSize, (uint)Math.Max(0, image.Length - rawOffset)));
            byte[] code;
            Iced.Intel.Decoder decoder;
            if (rawOffset < 0 || rawOffset >= image.Length || rawSize == 0)
                continue;
            code = new byte[rawSize];
            Buffer.BlockCopy(image, rawOffset, code, 0, rawSize);
            decoder = Iced.Intel.Decoder.Create(layout.Bitness, new ByteArrayCodeReader(code));
            decoder.IP = section.Address;
            while (decoder.IP < section.Address + (ulong)rawSize)
            {
                decoder.Decode(out Instruction instruction);
                if (instruction.Length == 0)
                    break;
                result.Add(new DecodedInstruction(instruction));
            }
        }
        return result;
    }

    private static List<NativeHvmPointerTable> FindPointerTables(byte[] image, PeLayout layout,
        IReadOnlyList<DecodedInstruction> instructions)
    {
        int pointerSize = layout.Bitness / 8;
        var tables = new List<NativeHvmPointerTable>();
        foreach (NativeHvmSection section in layout.Sections.Where(item => item.Readable && !item.Executable && item.RawSize > 0))
        {
            int sectionStart = checked((int)section.RawOffset);
            int sectionEnd = Math.Min(image.Length, checked(sectionStart + (int)section.RawSize));
            int cursor = sectionStart;
            while (cursor + pointerSize <= sectionEnd)
            {
                int tableStart = cursor;
                var targets = new List<ulong>();
                while (cursor + pointerSize <= sectionEnd)
                {
                    ulong rawTarget = pointerSize == 8 ? ReadUInt64(image, cursor) : ReadUInt32(image, cursor);
                    ulong target = NormalizeAddress(rawTarget, layout);
                    if (!IsExecutableAddress(target, layout.Sections))
                        break;
                    if (targets.Count < MaximumReportedTargets)
                        targets.Add(target);
                    cursor += pointerSize;
                }
                int entryCount = (cursor - tableStart) / pointerSize;
                if (entryCount >= MinimumPointerTableEntries)
                {
                    ulong address = section.Address + checked((uint)(tableStart - sectionStart));
                    ulong endAddress = address + checked((ulong)(entryCount * pointerSize));
                    List<ulong> references = instructions
                        .Where(item => item.MemoryAddress >= address && item.MemoryAddress < endAddress)
                        .Select(item => item.Address).Distinct().ToList();
                    tables.Add(new NativeHvmPointerTable(address, entryCount, targets, references));
                }
                cursor = entryCount == 0 ? cursor + pointerSize : cursor;
            }
        }
        return tables.OrderByDescending(table => table.References.Count)
            .ThenByDescending(table => table.EntryCount).ToList();
    }

    private static List<NativeHvmIndirectBranch> FindIndirectBranches(IReadOnlyList<DecodedInstruction> instructions)
    {
        return instructions.Where(item => item.IsIndirectBranch)
            .Select(item => new NativeHvmIndirectBranch(item.Address, item.Mnemonic, item.MemoryBase,
                item.MemoryIndex, item.MemoryScale, item.MemoryAddress))
            .ToList();
    }

    private static List<NativeHvmIndirectBranch> FindIndirectCalls(IReadOnlyList<DecodedInstruction> instructions)
    {
        return instructions.Where(item => item.IsIndirectCall)
            .Select(item => new NativeHvmIndirectBranch(item.Address, item.Mnemonic, item.MemoryBase,
                item.MemoryIndex, item.MemoryScale, item.MemoryAddress))
            .ToList();
    }

    private static List<NativeHvmMarker> FindMarkers(byte[] image, PeLayout layout,
        IReadOnlyList<DecodedInstruction> instructions)
    {
        var markers = new List<NativeHvmMarker>();
        foreach (string marker in RuntimeMarkers)
        {
            byte[] pattern = Encoding.ASCII.GetBytes(marker);
            int offset = 0;
            while ((offset = FindBytes(image, pattern, offset)) >= 0)
            {
                ulong address = FileOffsetToAddress(offset, layout);
                List<ulong> references = instructions.Where(item => item.MemoryAddress == address)
                    .Select(item => item.Address).Distinct().ToList();
                markers.Add(new NativeHvmMarker(marker, address, references));
                offset += pattern.Length;
            }
        }
        return markers.OrderByDescending(marker => marker.References.Count).ThenBy(marker => marker.Address).ToList();
    }

    private static ulong NormalizeAddress(ulong value, PeLayout layout)
    {
        ulong maximumRva = layout.Sections.Count == 0 ? 0 : layout.Sections.Max(section =>
            section.Address - layout.ImageBase + Math.Max(section.VirtualSize, section.RawSize));
        if (value >= layout.ImageBase && value < layout.ImageBase + maximumRva)
            return value;
        return value < maximumRva ? layout.ImageBase + value : value;
    }

    private static bool IsExecutableAddress(ulong address, IReadOnlyList<NativeHvmSection> sections)
    {
        return sections.Any(section => section.Executable && address >= section.Address
            && address < section.Address + Math.Max(section.VirtualSize, section.RawSize));
    }

    private static ulong FileOffsetToAddress(int offset, PeLayout layout)
    {
        NativeHvmSection? section = layout.Sections.FirstOrDefault(item => offset >= item.RawOffset
            && (ulong)offset < (ulong)item.RawOffset + item.RawSize);
        return section == null ? layout.ImageBase + checked((uint)offset)
            : section.Address + checked((uint)(offset - section.RawOffset));
    }

    private static int RvaToFileOffset(uint rva, PeLayout layout)
    {
        ulong address = layout.ImageBase + rva;
        NativeHvmSection? section = layout.Sections.FirstOrDefault(item => address >= item.Address
            && address < item.Address + Math.Max(item.VirtualSize, item.RawSize));
        if (section == null)
            return checked((int)rva);
        return checked((int)(section.RawOffset + address - section.Address));
    }

    private static string ReadAsciiString(byte[] data, int offset)
    {
        int end = offset;
        if (offset < 0 || offset >= data.Length)
            throw new BadImageFormatException("A PE string address is outside the image.");
        while (end < data.Length && data[end] != 0)
            end++;
        return Encoding.ASCII.GetString(data, offset, end - offset);
    }

    private static int FindBytes(byte[] data, byte[] pattern, int start)
    {
        for (int offset = start; offset <= data.Length - pattern.Length; offset++)
        {
            int index;
            for (index = 0; index < pattern.Length && data[offset + index] == pattern[index]; index++)
            {
            }
            if (index == pattern.Length)
                return offset;
        }
        return -1;
    }

    private static string GetMachineName(ushort machine)
    {
        return machine switch
        {
            0x014C => "I386",
            0x8664 => "AMD64",
            0xAA64 => "ARM64",
            _ => "0x" + machine.ToString("X4")
        };
    }

    private static ushort ReadUInt16(byte[] data, int offset) => BitConverter.ToUInt16(data, offset);
    private static uint ReadUInt32(byte[] data, int offset) => BitConverter.ToUInt32(data, offset);
    private static int ReadInt32(byte[] data, int offset) => BitConverter.ToInt32(data, offset);
    private static ulong ReadUInt64(byte[] data, int offset) => BitConverter.ToUInt64(data, offset);

    private sealed class PeLayout
    {
        public PeLayout(ushort machine, int bitness, ulong imageBase, uint importTableRva,
            uint importTableSize, IReadOnlyList<NativeHvmSection> sections)
        {
            Machine = machine;
            Bitness = bitness;
            ImageBase = imageBase;
            ImportTableRva = importTableRva;
            ImportTableSize = importTableSize;
            Sections = sections;
        }

        public ushort Machine { get; }
        public int Bitness { get; }
        public ulong ImageBase { get; }
        public uint ImportTableRva { get; }
        public uint ImportTableSize { get; }
        public IReadOnlyList<NativeHvmSection> Sections { get; }
    }

    private sealed class DecodedInstruction
    {
        public DecodedInstruction(Instruction instruction)
        {
            Address = instruction.IP;
            Mnemonic = instruction.Mnemonic.ToString();
            MemoryBase = instruction.MemoryBase.ToString();
            MemoryIndex = instruction.MemoryIndex.ToString();
            MemoryScale = instruction.MemoryIndexScale;
            MemoryAddress = instruction.IsIPRelativeMemoryOperand
                ? instruction.IPRelativeMemoryAddress
                : instruction.MemoryDisplacement64;
            IsIndirectBranch = instruction.FlowControl == FlowControl.IndirectBranch;
            IsIndirectCall = instruction.FlowControl == FlowControl.IndirectCall;
        }

        public ulong Address { get; }
        public string Mnemonic { get; }
        public string MemoryBase { get; }
        public string MemoryIndex { get; }
        public int MemoryScale { get; }
        public ulong MemoryAddress { get; }
        public bool IsIndirectBranch { get; }
        public bool IsIndirectCall { get; }
    }
}
