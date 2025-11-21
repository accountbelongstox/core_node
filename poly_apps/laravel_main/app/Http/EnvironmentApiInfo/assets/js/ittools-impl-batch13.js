// ============================================
// NAMESPACE: ITTools.Implementations.Batch13
// FILE: ittools-impl-batch13.js
// PURPOSE: Cheatsheets, Crontab, Query String Parser
// ============================================

// ============================================
// Git Cheatsheet
// ============================================
ITTools.Tools.Registry.register('git-cheatsheet', {
    name: 'Git Cheatsheet',
    category: 'dev',
    render() {
        const sections = [
            { title: 'Setup', cmds: [
                ['git init', 'Initialize a new Git repository'],
                ['git clone <url>', 'Clone a repository'],
                ['git config --global user.name "Name"', 'Set username'],
                ['git config --global user.email "email"', 'Set email']
            ]},
            { title: 'Basic Commands', cmds: [
                ['git status', 'Show working tree status'],
                ['git add <file>', 'Add file to staging'],
                ['git add .', 'Add all files to staging'],
                ['git commit -m "message"', 'Commit with message'],
                ['git commit --amend', 'Amend last commit']
            ]},
            { title: 'Branches', cmds: [
                ['git branch', 'List branches'],
                ['git branch <name>', 'Create new branch'],
                ['git checkout <branch>', 'Switch to branch'],
                ['git checkout -b <name>', 'Create and switch to branch'],
                ['git merge <branch>', 'Merge branch into current'],
                ['git branch -d <name>', 'Delete branch']
            ]},
            { title: 'Remote', cmds: [
                ['git remote -v', 'List remotes'],
                ['git remote add origin <url>', 'Add remote'],
                ['git push origin <branch>', 'Push to remote'],
                ['git pull origin <branch>', 'Pull from remote'],
                ['git fetch', 'Fetch from remote']
            ]},
            { title: 'History', cmds: [
                ['git log', 'Show commit history'],
                ['git log --oneline', 'Compact log'],
                ['git diff', 'Show changes'],
                ['git diff --staged', 'Show staged changes'],
                ['git blame <file>', 'Show who changed each line']
            ]},
            { title: 'Undo', cmds: [
                ['git reset HEAD <file>', 'Unstage file'],
                ['git checkout -- <file>', 'Discard changes'],
                ['git revert <commit>', 'Revert a commit'],
                ['git reset --hard HEAD~1', 'Undo last commit (destructive)'],
                ['git stash', 'Stash changes'],
                ['git stash pop', 'Apply stashed changes']
            ]}
        ];
        const html = sections.map(s => `
            <div style="margin-bottom:20px;">
                <h4 style="color:#667eea;margin-bottom:10px;">${s.title}</h4>
                ${s.cmds.map(([cmd, desc]) => `
                    <div style="display:flex;gap:10px;padding:8px;background:#f8f9fa;border-radius:4px;margin-bottom:5px;align-items:center;">
                        <code style="flex:1;background:#e9ecef;padding:5px 10px;border-radius:3px;">${cmd}</code>
                        <span style="color:#666;font-size:13px;flex:1;">${desc}</span>
                        <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('${cmd.replace(/'/g, "\\'")}')">Copy</button>
                    </div>
                `).join('')}
            </div>
        `).join('');
        return `<div class="ittools-card"><div class="ittools-card-header">Git Cheatsheet</div><div class="ittools-card-body" style="max-height:500px;overflow:auto;">${html}</div></div>`;
    }
});

// ============================================
// Regex Cheatsheet
// ============================================
ITTools.Tools.Registry.register('regex-cheatsheet', {
    name: 'Regex Cheatsheet',
    category: 'dev',
    render() {
        const sections = [
            { title: 'Character Classes', items: [
                ['.', 'Any character except newline'],
                ['\\d', 'Digit (0-9)'],
                ['\\D', 'Not a digit'],
                ['\\w', 'Word character (a-z, A-Z, 0-9, _)'],
                ['\\W', 'Not a word character'],
                ['\\s', 'Whitespace'],
                ['\\S', 'Not whitespace'],
                ['[abc]', 'Any of a, b, or c'],
                ['[^abc]', 'Not a, b, or c'],
                ['[a-z]', 'Character range a-z']
            ]},
            { title: 'Anchors', items: [
                ['^', 'Start of string'],
                ['$', 'End of string'],
                ['\\b', 'Word boundary'],
                ['\\B', 'Not word boundary']
            ]},
            { title: 'Quantifiers', items: [
                ['*', 'Zero or more'],
                ['+', 'One or more'],
                ['?', 'Zero or one'],
                ['{n}', 'Exactly n'],
                ['{n,}', 'n or more'],
                ['{n,m}', 'Between n and m']
            ]},
            { title: 'Groups', items: [
                ['(abc)', 'Capture group'],
                ['(?:abc)', 'Non-capture group'],
                ['(?=abc)', 'Positive lookahead'],
                ['(?!abc)', 'Negative lookahead'],
                ['(?<=abc)', 'Positive lookbehind'],
                ['(?<!abc)', 'Negative lookbehind']
            ]},
            { title: 'Common Patterns', items: [
                ['^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', 'Email'],
                ['^https?:\\/\\/[^\\s]+$', 'URL'],
                ['^\\d{4}-\\d{2}-\\d{2}$', 'Date (YYYY-MM-DD)'],
                ['^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$', 'Hex color'],
                ['^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$', 'IPv4 address']
            ]}
        ];
        const html = sections.map(s => `
            <div style="margin-bottom:20px;">
                <h4 style="color:#667eea;margin-bottom:10px;">${s.title}</h4>
                ${s.items.map(([pattern, desc]) => `
                    <div style="display:flex;gap:10px;padding:8px;background:#f8f9fa;border-radius:4px;margin-bottom:5px;">
                        <code style="background:#e9ecef;padding:3px 8px;border-radius:3px;min-width:200px;">${pattern.replace(/</g,'&lt;')}</code>
                        <span style="color:#666;font-size:13px;">${desc}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');
        return `<div class="ittools-card"><div class="ittools-card-header">Regex Cheatsheet</div><div class="ittools-card-body" style="max-height:500px;overflow:auto;">${html}</div></div>`;
    }
});

// ============================================
// Crontab Generator
// ============================================
ITTools.Tools.Registry.register('crontab-generator', {
    name: 'Crontab Generator',
    category: 'dev',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Crontab Expression Generator</div>
                <div class="ittools-card-body">
                    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:15px;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Minute</label>
                            <input type="text" id="cron-min" class="ittools-input" value="*" oninput="ITTools.Implementations.CrontabGen.update()">
                            <small style="color:#666;">0-59</small>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Hour</label>
                            <input type="text" id="cron-hour" class="ittools-input" value="*" oninput="ITTools.Implementations.CrontabGen.update()">
                            <small style="color:#666;">0-23</small>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Day (Month)</label>
                            <input type="text" id="cron-dom" class="ittools-input" value="*" oninput="ITTools.Implementations.CrontabGen.update()">
                            <small style="color:#666;">1-31</small>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Month</label>
                            <input type="text" id="cron-month" class="ittools-input" value="*" oninput="ITTools.Implementations.CrontabGen.update()">
                            <small style="color:#666;">1-12</small>
                        </div>
                        <div class="ittools-form-group">
                            <label class="ittools-label">Day (Week)</label>
                            <input type="text" id="cron-dow" class="ittools-input" value="*" oninput="ITTools.Implementations.CrontabGen.update()">
                            <small style="color:#666;">0-6 (Sun-Sat)</small>
                        </div>
                    </div>
                    <div style="background:#667eea;color:white;padding:20px;border-radius:5px;text-align:center;margin-bottom:15px;">
                        <div style="font-size:12px;opacity:0.8;">Cron Expression</div>
                        <div id="cron-expression" style="font-size:28px;font-family:monospace;font-weight:bold;">* * * * *</div>
                        <button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard(document.getElementById('cron-expression').textContent)" style="background:rgba(255,255,255,0.2);border:none;margin-top:10px;">Copy</button>
                    </div>
                    <div id="cron-desc" style="background:#f8f9fa;padding:15px;border-radius:5px;"></div>
                    <div style="margin-top:15px;">
                        <strong>Quick Presets:</strong>
                        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;">
                            <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.CrontabGen.preset('0','*','*','*','*')">Every hour</button>
                            <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.CrontabGen.preset('0','0','*','*','*')">Daily at midnight</button>
                            <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.CrontabGen.preset('0','0','*','*','0')">Weekly (Sunday)</button>
                            <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.CrontabGen.preset('0','0','1','*','*')">Monthly</button>
                            <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.CrontabGen.preset('*/5','*','*','*','*')">Every 5 min</button>
                            <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.CrontabGen.preset('*/15','*','*','*','*')">Every 15 min</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.CrontabGen = {
    update() {
        const min = document.getElementById('cron-min').value || '*';
        const hour = document.getElementById('cron-hour').value || '*';
        const dom = document.getElementById('cron-dom').value || '*';
        const month = document.getElementById('cron-month').value || '*';
        const dow = document.getElementById('cron-dow').value || '*';
        const expr = `${min} ${hour} ${dom} ${month} ${dow}`;
        document.getElementById('cron-expression').textContent = expr;
        document.getElementById('cron-desc').innerHTML = this.describe(min, hour, dom, month, dow);
    },
    preset(min, hour, dom, month, dow) {
        document.getElementById('cron-min').value = min;
        document.getElementById('cron-hour').value = hour;
        document.getElementById('cron-dom').value = dom;
        document.getElementById('cron-month').value = month;
        document.getElementById('cron-dow').value = dow;
        this.update();
    },
    describe(min, hour, dom, month, dow) {
        let desc = 'Runs ';
        if (min === '*' && hour === '*') desc += 'every minute';
        else if (min.startsWith('*/')) desc += `every ${min.slice(2)} minutes`;
        else if (hour === '*') desc += `at minute ${min} of every hour`;
        else if (min === '0' && hour === '0') desc += 'at midnight (00:00)';
        else if (min === '0') desc += `at ${hour}:00`;
        else desc += `at ${hour}:${min.padStart(2,'0')}`;
        if (dom !== '*') desc += `, on day ${dom} of the month`;
        if (month !== '*') desc += `, in month ${month}`;
        if (dow !== '*') {
            const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            desc += `, on ${days[parseInt(dow)] || dow}`;
        }
        return desc;
    }
};

document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('cron-expression')) ITTools.Implementations.CrontabGen.update(); });

// ============================================
// Query String Parser
// ============================================
ITTools.Tools.Registry.register('query-string-parser', {
    name: 'Query String Parser',
    category: 'web',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Query String Parser</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Query String or Full URL:</label>
                        <input type="text" id="qs-input" class="ittools-input" placeholder="?foo=bar&baz=qux or https://example.com?foo=bar" oninput="ITTools.Implementations.QueryStringParser.parse()">
                    </div>
                    <div id="qs-result" style="margin-top:15px;"></div>
                    <hr style="margin:20px 0;">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Build Query String:</label>
                        <div id="qs-builder">
                            <div style="display:flex;gap:10px;margin-bottom:10px;">
                                <input type="text" class="ittools-input qs-key" placeholder="Key" style="flex:1;">
                                <input type="text" class="ittools-input qs-val" placeholder="Value" style="flex:1;">
                                <button class="ittools-btn ittools-btn-sm" onclick="ITTools.Implementations.QueryStringParser.addRow()">+</button>
                            </div>
                        </div>
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.QueryStringParser.build()">Build</button>
                    </div>
                    <div id="qs-built" class="ittools-result" style="display:none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.QueryStringParser = {
    parse() {
        let input = document.getElementById('qs-input').value.trim();
        if (!input) { document.getElementById('qs-result').innerHTML = ''; return; }
        if (input.includes('?')) input = input.split('?')[1];
        if (input.includes('#')) input = input.split('#')[0];
        const params = new URLSearchParams(input);
        const entries = [...params.entries()];
        if (!entries.length) { document.getElementById('qs-result').innerHTML = '<span style="color:#666;">No parameters found</span>'; return; }
        const html = `
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#667eea;color:white;"><th style="padding:10px;text-align:left;">Key</th><th style="padding:10px;text-align:left;">Value</th></tr></thead>
                <tbody>${entries.map(([k, v]) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><code>${k}</code></td><td style="padding:8px;">${v}</td></tr>`).join('')}</tbody>
            </table>
        `;
        document.getElementById('qs-result').innerHTML = html;
    },
    addRow() {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;';
        row.innerHTML = '<input type="text" class="ittools-input qs-key" placeholder="Key" style="flex:1;"><input type="text" class="ittools-input qs-val" placeholder="Value" style="flex:1;"><button class="ittools-btn ittools-btn-sm" onclick="this.parentElement.remove()">-</button>';
        document.getElementById('qs-builder').appendChild(row);
    },
    build() {
        const keys = document.querySelectorAll('.qs-key');
        const vals = document.querySelectorAll('.qs-val');
        const params = new URLSearchParams();
        keys.forEach((k, i) => { if (k.value.trim()) params.append(k.value.trim(), vals[i].value); });
        const qs = params.toString();
        ITTools.UI.showResult('qs-built', `<code style="word-break:break-all;">?${qs}</code><br><button class="ittools-btn ittools-btn-sm" onclick="ITTools.UI.copyToClipboard('?${qs}')" style="margin-top:10px;">Copy</button>`, true);
    }
};

console.log('ITTools Batch 13 loaded (git-cheatsheet, regex-cheatsheet, crontab-generator, query-string-parser)');
