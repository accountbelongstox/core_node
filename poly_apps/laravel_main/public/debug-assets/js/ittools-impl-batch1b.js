// ============================================
// NAMESPACE: ITTools.Implementations.Batch1b
// FILE: ittools-impl-batch1b.js  
// PURPOSE: Batch 1b - Regex/Git/IPv4 (3/5 tools)
// ============================================

// ============================================
// Regex Cheatsheet (Client-side Reference)
// ============================================
ITTools.Tools.Registry.register('regex-cheatsheet', {
    name: 'Regex Cheatsheet',
    category: 'dev',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Regular Expression Cheatsheet</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <input type="text" id="regex-search" class="ittools-input" placeholder="Search patterns..." oninput="ITTools.Implementations.RegexCheatsheet.search()">
                    </div>
                    <div id="regex-cheatsheet-content" style="max-height: 600px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.RegexCheatsheet = {
    patterns: [
        { category: 'Basic', pattern: '.', description: 'Any character except newline' },
        { category: 'Basic', pattern: '\\d', description: 'Digit (0-9)' },
        { category: 'Basic', pattern: '\\D', description: 'Not a digit' },
        { category: 'Basic', pattern: '\\w', description: 'Word character (a-z, A-Z, 0-9, _)' },
        { category: 'Basic', pattern: '\\W', description: 'Not a word character' },
        { category: 'Basic', pattern: '\\s', description: 'Whitespace (space, tab, newline)' },
        { category: 'Basic', pattern: '\\S', description: 'Not whitespace' },
        { category: 'Anchors', pattern: '^', description: 'Start of string' },
        { category: 'Anchors', pattern: '$', description: 'End of string' },
        { category: 'Anchors', pattern: '\\b', description: 'Word boundary' },
        { category: 'Anchors', pattern: '\\B', description: 'Not a word boundary' },
        { category: 'Quantifiers', pattern: '*', description: '0 or more' },
        { category: 'Quantifiers', pattern: '+', description: '1 or more' },
        { category: 'Quantifiers', pattern: '?', description: '0 or 1' },
        { category: 'Quantifiers', pattern: '{3}', description: 'Exactly 3' },
        { category: 'Quantifiers', pattern: '{3,}', description: '3 or more' },
        { category: 'Quantifiers', pattern: '{3,5}', description: '3, 4, or 5' },
        { category: 'Groups', pattern: '(abc)', description: 'Capture group' },
        { category: 'Groups', pattern: '(?:abc)', description: 'Non-capturing group' },
        { category: 'Groups', pattern: '(?<name>abc)', description: 'Named capture group' },
        { category: 'Character Classes', pattern: '[abc]', description: 'Any of a, b, or c' },
        { category: 'Character Classes', pattern: '[^abc]', description: 'Not a, b, or c' },
        { category: 'Character Classes', pattern: '[a-z]', description: 'Character range' },
        { category: 'Character Classes', pattern: '[a-zA-Z0-9]', description: 'Letters and digits' },
        { category: 'Lookahead', pattern: '(?=abc)', description: 'Positive lookahead' },
        { category: 'Lookahead', pattern: '(?!abc)', description: 'Negative lookahead' },
        { category: 'Common', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', description: 'Email address' },
        { category: 'Common', pattern: '^https?://[^\\s]+$', description: 'URL' },
        { category: 'Common', pattern: '^\\d{3}-\\d{3}-\\d{4}$', description: 'Phone (XXX-XXX-XXXX)' },
        { category: 'Common', pattern: '^#?([a-f0-9]{6}|[a-f0-9]{3})$', description: 'Hex color' }
    ],
    
    search() {
        const query = document.getElementById('regex-search').value.toLowerCase();
        const filtered = this.patterns.filter(p => 
            p.pattern.toLowerCase().includes(query) || 
            p.description.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        );
        
        const grouped = {};
        filtered.forEach(p => {
            if (!grouped[p.category]) grouped[p.category] = [];
            grouped[p.category].push(p);
        });
        
        let html = '';
        Object.entries(grouped).forEach(([category, patterns]) => {
            html += `<h4 style="color: #667eea; margin: 20px 0 10px; border-bottom: 2px solid #667eea; padding-bottom: 5px;">${category}</h4>`;
            patterns.forEach(p => {
                html += `
                    <div style="background: #f8f9fa; padding: 12px; margin-bottom: 8px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <code style="background: #667eea; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${p.pattern}</code>
                            <span style="margin-left: 15px; color: #666;">${p.description}</span>
                        </div>
                        <button onclick="ITTools.UI.copyToClipboard('${p.pattern.replace(/'/g, "\\'")}')\" class=\"ittools-btn ittools-btn-sm\">📋</button>
                    </div>
                `;
            });
        });
        
        document.getElementById('regex-cheatsheet-content').innerHTML = html || '<p style="text-align: center; color: #999; padding: 20px;">No patterns found</p>';
    }
};

document.addEventListener('DOMContentLoaded', function() {
    ITTools.Implementations.RegexCheatsheet.search();
});

// ============================================
// Git Cheatsheet (Client-side Reference)
// ============================================
ITTools.Tools.Registry.register('git-cheatsheet', {
    name: 'Git Cheatsheet',
    category: 'dev',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Git Commands Cheatsheet</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <input type="text" id="git-search" class="ittools-input" placeholder="Search commands..." oninput="ITTools.Implementations.GitCheatsheet.search()">
                    </div>
                    <div id="git-cheatsheet-content" style="max-height: 600px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.GitCheatsheet = {
    commands: [
        { category: 'Setup', command: 'git config --global user.name "name"', description: 'Set your name' },
        { category: 'Setup', command: 'git config --global user.email "email"', description: 'Set your email' },
        { category: 'Setup', command: 'git init', description: 'Initialize a repository' },
        { category: 'Setup', command: 'git clone <url>', description: 'Clone a repository' },
        { category: 'Basic', command: 'git status', description: 'Check status' },
        { category: 'Basic', command: 'git add <file>', description: 'Add file to staging' },
        { category: 'Basic', command: 'git add .', description: 'Add all files to staging' },
        { category: 'Basic', command: 'git commit -m "message"', description: 'Commit with message' },
        { category: 'Basic', command: 'git commit -am "message"', description: 'Add and commit' },
        { category: 'Basic', command: 'git diff', description: 'Show unstaged changes' },
        { category: 'Branches', command: 'git branch', description: 'List branches' },
        { category: 'Branches', command: 'git branch <name>', description: 'Create branch' },
        { category: 'Branches', command: 'git checkout <branch>', description: 'Switch branch' },
        { category: 'Branches', command: 'git checkout -b <branch>', description: 'Create and switch branch' },
        { category: 'Branches', command: 'git merge <branch>', description: 'Merge branch' },
        { category: 'Branches', command: 'git branch -d <branch>', description: 'Delete branch' },
        { category: 'Remote', command: 'git remote -v', description: 'List remotes' },
        { category: 'Remote', command: 'git remote add origin <url>', description: 'Add remote' },
        { category: 'Remote', command: 'git push origin <branch>', description: 'Push to remote' },
        { category: 'Remote', command: 'git pull', description: 'Pull from remote' },
        { category: 'Remote', command: 'git fetch', description: 'Fetch from remote' },
        { category: 'History', command: 'git log', description: 'Show commit history' },
        { category: 'History', command: 'git log --oneline', description: 'Compact history' },
        { category: 'History', command: 'git log --graph', description: 'Graphical history' },
        { category: 'History', command: 'git show <commit>', description: 'Show commit details' },
        { category: 'Undo', command: 'git reset <file>', description: 'Unstage file' },
        { category: 'Undo', command: 'git reset --hard', description: 'Reset to last commit' },
        { category: 'Undo', command: 'git revert <commit>', description: 'Revert a commit' },
        { category: 'Undo', command: 'git checkout -- <file>', description: 'Discard changes' },
        { category: 'Stash', command: 'git stash', description: 'Stash changes' },
        { category: 'Stash', command: 'git stash pop', description: 'Apply stashed changes' },
        { category: 'Stash', command: 'git stash list', description: 'List stashes' },
        { category: 'Tags', command: 'git tag <name>', description: 'Create tag' },
        { category: 'Tags', command: 'git tag', description: 'List tags' },
        { category: 'Tags', command: 'git push --tags', description: 'Push tags' }
    ],
    
    search() {
        const query = document.getElementById('git-search').value.toLowerCase();
        const filtered = this.commands.filter(c => 
            c.command.toLowerCase().includes(query) || 
            c.description.toLowerCase().includes(query) ||
            c.category.toLowerCase().includes(query)
        );
        
        const grouped = {};
        filtered.forEach(c => {
            if (!grouped[c.category]) grouped[c.category] = [];
            grouped[c.category].push(c);
        });
        
        let html = '';
        Object.entries(grouped).forEach(([category, commands]) => {
            html += `<h4 style="color: #667eea; margin: 20px 0 10px; border-bottom: 2px solid #667eea; padding-bottom: 5px;">${category}</h4>`;
            commands.forEach(c => {
                html += `
                    <div style="background: #f8f9fa; padding: 12px; margin-bottom: 8px; border-radius: 5px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <code style="background: #2c3e50; color: #00ff00; padding: 6px 10px; border-radius: 3px; font-family: monospace; flex: 1; margin-right: 10px;">${c.command}</code>
                            <button onclick="ITTools.UI.copyToClipboard('${c.command.replace(/'/g, "\\'")}')\" class=\"ittools-btn ittools-btn-sm\">📋</button>
                        </div>
                        <div style="margin-top: 8px; color: #666; font-size: 14px;">${c.description}</div>
                    </div>
                `;
            });
        });
        
        document.getElementById('git-cheatsheet-content').innerHTML = html || '<p style="text-align: center; color: #999; padding: 20px;">No commands found</p>';
    }
};

document.addEventListener('DOMContentLoaded', function() {
    ITTools.Implementations.GitCheatsheet.search();
});

// ============================================
// IPv4 Subnet Calculator (Client-side)
// ============================================
ITTools.Tools.Registry.register('ipv4-subnet', {
    name: 'IPv4 Subnet Calculator',
    category: 'network',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">IPv4 Subnet Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">IP Address:</label>
                        <input type="text" id="ipv4-address" class="ittools-input" placeholder="192.168.1.1" value="192.168.1.1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Subnet Mask / CIDR:</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <input type="text" id="ipv4-mask" class="ittools-input" placeholder="255.255.255.0" value="255.255.255.0" oninput="ITTools.Implementations.IPv4Subnet.updateCIDR()">
                            <input type="number" id="ipv4-cidr" class="ittools-input" placeholder="24" value="24" min="0" max="32" oninput="ITTools.Implementations.IPv4Subnet.updateMask()">
                        </div>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.IPv4Subnet.calculate()">
                            🔢 Calculate Subnet
                        </button>
                    </div>
                    <div id="ipv4-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.IPv4Subnet = {
    ipToInt(ip) {
        const parts = ip.split('.').map(p => parseInt(p));
        return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    },
    
    intToIp(int) {
        return [
            (int >>> 24) & 0xFF,
            (int >>> 16) & 0xFF,
            (int >>> 8) & 0xFF,
            int & 0xFF
        ].join('.');
    },
    
    cidrToMask(cidr) {
        const mask = ~((1 << (32 - cidr)) - 1);
        return this.intToIp(mask >>> 0);
    },
    
    maskToCIDR(mask) {
        const int = this.ipToInt(mask);
        return 32 - Math.log2((~int >>> 0) + 1);
    },
    
    updateMask() {
        const cidr = parseInt(document.getElementById('ipv4-cidr').value);
        if (cidr >= 0 && cidr <= 32) {
            document.getElementById('ipv4-mask').value = this.cidrToMask(cidr);
        }
    },
    
    updateCIDR() {
        const mask = document.getElementById('ipv4-mask').value;
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mask)) {
            document.getElementById('ipv4-cidr').value = this.maskToCIDR(mask);
        }
    },
    
    calculate() {
        const ipStr = document.getElementById('ipv4-address').value;
        const maskStr = document.getElementById('ipv4-mask').value;
        const cidr = parseInt(document.getElementById('ipv4-cidr').value);
        
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipStr)) {
            ITTools.UI.showResult('ipv4-result', 'Invalid IP address', false);
            return;
        }
        
        const ip = this.ipToInt(ipStr);
        const mask = this.ipToInt(maskStr);
        const network = (ip & mask) >>> 0;
        const broadcast = (network | (~mask >>> 0)) >>> 0;
        const firstHost = network + 1;
        const lastHost = broadcast - 1;
        const totalHosts = (broadcast - network - 1);
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="display: grid; gap: 10px;">
                    <div style="background: #667eea; color: white; padding: 15px; border-radius: 5px;">
                        <strong>Network Address:</strong><br>
                        <span style="font-size: 20px; font-family: monospace;">${this.intToIp(network)}/${cidr}</span>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Subnet Mask:</strong> ${maskStr}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Broadcast Address:</strong> ${this.intToIp(broadcast)}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>First Host:</strong> ${this.intToIp(firstHost)}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Last Host:</strong> ${this.intToIp(lastHost)}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Total Hosts:</strong> ${totalHosts.toLocaleString()}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>IP Class:</strong> ${this.getIPClass(ipStr)}
                    </div>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('ipv4-result', html, true);
    },
    
    getIPClass(ip) {
        const first = parseInt(ip.split('.')[0]);
        if (first >= 1 && first <= 126) return 'A (Large Networks)';
        if (first >= 128 && first <= 191) return 'B (Medium Networks)';
        if (first >= 192 && first <= 223) return 'C (Small Networks)';
        if (first >= 224 && first <= 239) return 'D (Multicast)';
        return 'E (Reserved)';
    }
};

console.log('ITTools Batch 1b Implementations loaded');
