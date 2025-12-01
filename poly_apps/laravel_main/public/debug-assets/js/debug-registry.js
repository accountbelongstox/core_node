// ============================================
// DEBUG: Registry Checker
// PURPOSE: Check which tools are registered
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('=== ITTools Registry Debug ===');
    
    const allTools = ITTools.Tools.Registry.getAll();
    const toolCount = Object.keys(allTools).length;
    
    console.log(`Total registered tools: ${toolCount}`);
    console.log('Registered tool IDs:', Object.keys(allTools));
    
    // Check Batch 1 tools
    const batch1Tools = [
        'ascii-art',
        'unit-converter-advanced',
        'regex-cheatsheet',
        'git-cheatsheet',
        'ipv4-subnet'
    ];
    
    console.log('\n=== Batch 1 Tools Check ===');
    batch1Tools.forEach(toolId => {
        const tool = ITTools.Tools.Registry.get(toolId);
        if (tool) {
            console.log(`✅ ${toolId} - Registered`);
            console.log(`   Name: ${tool.name}`);
            console.log(`   Has render(): ${typeof tool.render === 'function'}`);
        } else {
            console.error(`❌ ${toolId} - NOT Registered`);
        }
    });
    
    console.log('\n=== Implementation Files Check ===');
    const expectedImpls = {
        'ITTools.Implementations.ASCIIArt': typeof ITTools?.Implementations?.ASCIIArt,
        'ITTools.Implementations.UnitConverter': typeof ITTools?.Implementations?.UnitConverter,
        'ITTools.Implementations.RegexCheatsheet': typeof ITTools?.Implementations?.RegexCheatsheet,
        'ITTools.Implementations.GitCheatsheet': typeof ITTools?.Implementations?.GitCheatsheet,
        'ITTools.Implementations.IPv4Subnet': typeof ITTools?.Implementations?.IPv4Subnet
    };
    
    Object.entries(expectedImpls).forEach(([name, type]) => {
        console.log(`${type === 'object' ? '✅' : '❌'} ${name}: ${type}`);
    });
});
