// ============================================
// NAMESPACE: ITTools.Implementations.Dev
// FILE: ittools-impl-dev.js  
// PURPOSE: Development tool implementations
// ============================================

// ============================================
// Chmod Calculator
// ============================================
ITTools.Tools.Registry.register('chmod-calculator', {
    name: 'Chmod Calculator',
    category: 'dev',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Chmod Calculator (Unix Permissions)</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Owner Permissions:</label>
                        <div style="display: flex; gap: 15px;">
                            <label><input type="checkbox" id="chmod-owner-r" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Read (4)</label>
                            <label><input type="checkbox" id="chmod-owner-w" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Write (2)</label>
                            <label><input type="checkbox" id="chmod-owner-x" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Execute (1)</label>
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Group Permissions:</label>
                        <div style="display: flex; gap: 15px;">
                            <label><input type="checkbox" id="chmod-group-r" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Read (4)</label>
                            <label><input type="checkbox" id="chmod-group-w" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Write (2)</label>
                            <label><input type="checkbox" id="chmod-group-x" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Execute (1)</label>
                        </div>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Others Permissions:</label>
                        <div style="display: flex; gap: 15px;">
                            <label><input type="checkbox" id="chmod-others-r" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Read (4)</label>
                            <label><input type="checkbox" id="chmod-others-w" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Write (2)</label>
                            <label><input type="checkbox" id="chmod-others-x" onchange="ITTools.Implementations.ChmodCalculator.calculate()"> Execute (1)</label>
                        </div>
                    </div>
                    <div id="chmod-result" style="margin-top: 20px;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ChmodCalculator = {
    calculate() {
        const ownerR = document.getElementById('chmod-owner-r').checked ? 4 : 0;
        const ownerW = document.getElementById('chmod-owner-w').checked ? 2 : 0;
        const ownerX = document.getElementById('chmod-owner-x').checked ? 1 : 0;
        
        const groupR = document.getElementById('chmod-group-r').checked ? 4 : 0;
        const groupW = document.getElementById('chmod-group-w').checked ? 2 : 0;
        const groupX = document.getElementById('chmod-group-x').checked ? 1 : 0;
        
        const othersR = document.getElementById('chmod-others-r').checked ? 4 : 0;
        const othersW = document.getElementById('chmod-others-w').checked ? 2 : 0;
        const othersX = document.getElementById('chmod-others-x').checked ? 1 : 0;
        
        const owner = ownerR + ownerW + ownerX;
        const group = groupR + groupW + groupX;
        const others = othersR + othersW + othersX;
        
        const numeric = `${owner}${group}${others}`;
        
        const ownerStr = (ownerR ? 'r' : '-') + (ownerW ? 'w' : '-') + (ownerX ? 'x' : '-');
        const groupStr = (groupR ? 'r' : '-') + (groupW ? 'w' : '-') + (groupX ? 'x' : '-');
        const othersStr = (othersR ? 'r' : '-') + (othersW ? 'w' : '-') + (othersX ? 'x' : '-');
        const symbolic = ownerStr + groupStr + othersStr;
        
        const html = `
            <div style="display: grid; gap: 15px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px; opacity: 0.9;">Numeric Notation</div>
                    <div style="font-size: 48px; font-weight: bold; margin: 10px 0;">${numeric}</div>
                    <button onclick="ITTools.UI.copyToClipboard('${numeric}')" class="ittools-btn ittools-btn-sm" style="background: rgba(255,255,255,0.2); border: none;">📋 Copy</button>
                </div>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px; color: #666;">Symbolic Notation</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 10px 0; font-family: monospace;">${symbolic}</div>
                    <button onclick="ITTools.UI.copyToClipboard('${symbolic}')" class="ittools-btn ittools-btn-sm">📋 Copy</button>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                    <strong>Command:</strong><br>
                    <code style="background: white; padding: 8px; border-radius: 3px; display: inline-block; margin-top: 8px;">chmod ${numeric} filename</code>
                    <button onclick="ITTools.UI.copyToClipboard('chmod ${numeric} filename')" class="ittools-btn ittools-btn-sm" style="margin-left: 10px;">📋</button>
                </div>
            </div>
        `;
        
        document.getElementById('chmod-result').innerHTML = html;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    ITTools.Implementations.ChmodCalculator.calculate();
});

// ============================================
// ETA Calculator (Client-side)
// ============================================
ITTools.Tools.Registry.register('eta-calculator', {
    name: 'ETA Calculator',
    category: 'dev',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">ETA (Estimated Time of Arrival) Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Total Items:</label>
                        <input type="number" id="eta-total" class="ittools-input" placeholder="1000">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Completed Items:</label>
                        <input type="number" id="eta-completed" class="ittools-input" placeholder="250">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Time Elapsed (minutes):</label>
                        <input type="number" id="eta-elapsed" class="ittools-input" placeholder="30">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ETACalculator.calculate()">
                            ⏱️ Calculate ETA
                        </button>
                    </div>
                    <div id="eta-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ETACalculator = {
    calculate() {
        const total = parseFloat(document.getElementById('eta-total').value);
        const completed = parseFloat(document.getElementById('eta-completed').value);
        const elapsed = parseFloat(document.getElementById('eta-elapsed').value);
        
        if (!total || !completed || !elapsed) {
            ITTools.UI.showResult('eta-result', 'Please fill all fields', false);
            return;
        }
        
        if (completed > total) {
            ITTools.UI.showResult('eta-result', 'Completed cannot exceed total', false);
            return;
        }
        
        const remaining = total - completed;
        const rate = completed / elapsed;
        const etaMinutes = remaining / rate;
        
        const hours = Math.floor(etaMinutes / 60);
        const minutes = Math.floor(etaMinutes % 60);
        const percentage = ((completed / total) * 100).toFixed(2);
        
        const now = new Date();
        const etaTime = new Date(now.getTime() + etaMinutes * 60000);
        
        const html = `
            <div style="margin-top: 15px;">
                <div style="display: grid; gap: 15px;">
                    <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                        <div style="font-size: 14px; opacity: 0.9;">Estimated Time Remaining</div>
                        <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">${hours}h ${minutes}m</div>
                        <div style="font-size: 12px; opacity: 0.8;">ETA: ${etaTime.toLocaleString()}</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Progress:</strong> ${percentage}% (${completed} / ${total})
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Rate:</strong> ${rate.toFixed(2)} items/minute
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Remaining:</strong> ${remaining} items
                    </div>
                </div>
            </div>
        `;
        
        ITTools.UI.showResult('eta-result', html, true);
    }
};

console.log('ITTools Dev Implementations loaded');
