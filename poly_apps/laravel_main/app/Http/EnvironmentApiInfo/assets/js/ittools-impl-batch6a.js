// ============================================
// NAMESPACE: ITTools.Implementations.Batch6
// FILE: ittools-impl-batch6.js  
// PURPOSE: Batch 6 - Calculator & Color Tools (10 tools)
// ============================================

// ============================================
// Age Calculator
// ============================================
ITTools.Tools.Registry.register('age-calculator', {
    name: 'Age Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Age Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Date of Birth:</label>
                        <input type="date" id="age-dob" class="ittools-input">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.AgeCalculator.calculate()">
                            🎂 Calculate Age
                        </button>
                    </div>
                    <div id="age-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.AgeCalculator = {
    calculate() {
        const dob = new Date(document.getElementById('age-dob').value);
        if (isNaN(dob.getTime())) {
            ITTools.UI.showResult('age-result', 'Please select a valid date', false);
            return;
        }
        const today = new Date();
        let years = today.getFullYear() - dob.getFullYear();
        let months = today.getMonth() - dob.getMonth();
        let days = today.getDate() - dob.getDate();
        if (days < 0) { months--; days += 30; }
        if (months < 0) { years--; months += 12; }
        const totalDays = Math.floor((today - dob) / (1000 * 60 * 60 * 24));
        const html = `
            <div style="margin-top: 15px; display: grid; gap: 10px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 36px; font-weight: bold;">${years}</div>
                    <div>Years Old</div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                        <strong>${years}</strong><br>Years
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                        <strong>${months}</strong><br>Months
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                        <strong>${days}</strong><br>Days
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; text-align: center;">
                    Total: <strong>${totalDays.toLocaleString()}</strong> days lived
                </div>
            </div>
        `;
        ITTools.UI.showResult('age-result', html, true);
    }
};

// ============================================
// BMI Calculator
// ============================================
ITTools.Tools.Registry.register('bmi-calculator', {
    name: 'BMI Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">BMI Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Weight (kg):</label>
                        <input type="number" id="bmi-weight" class="ittools-input" placeholder="70" step="0.1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Height (cm):</label>
                        <input type="number" id="bmi-height" class="ittools-input" placeholder="175">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.BMICalculator.calculate()">
                            ⚖️ Calculate BMI
                        </button>
                    </div>
                    <div id="bmi-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.BMICalculator = {
    calculate() {
        const weight = parseFloat(document.getElementById('bmi-weight').value);
        const height = parseFloat(document.getElementById('bmi-height').value) / 100;
        if (!weight || !height) {
            ITTools.UI.showResult('bmi-result', 'Please enter weight and height', false);
            return;
        }
        const bmi = weight / (height * height);
        let category, color;
        if (bmi < 18.5) { category = 'Underweight'; color = '#17a2b8'; }
        else if (bmi < 25) { category = 'Normal'; color = '#28a745'; }
        else if (bmi < 30) { category = 'Overweight'; color = '#ffc107'; }
        else { category = 'Obese'; color = '#dc3545'; }
        const html = `
            <div style="margin-top: 15px;">
                <div style="background: ${color}; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 36px; font-weight: bold;">${bmi.toFixed(1)}</div>
                    <div style="font-size: 18px;">${category}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px; font-size: 13px;">
                    <strong>BMI Categories:</strong><br>
                    Underweight: &lt; 18.5 | Normal: 18.5-24.9 | Overweight: 25-29.9 | Obese: ≥ 30
                </div>
            </div>
        `;
        ITTools.UI.showResult('bmi-result', html, true);
    }
};

// ============================================
// Loan EMI Calculator
// ============================================
ITTools.Tools.Registry.register('loan-calculator', {
    name: 'Loan EMI Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Loan EMI Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Loan Amount:</label>
                        <input type="number" id="loan-amount" class="ittools-input" placeholder="100000" value="100000">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Interest Rate (% per year):</label>
                        <input type="number" id="loan-rate" class="ittools-input" placeholder="10" value="10" step="0.1">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Loan Term (months):</label>
                        <input type="number" id="loan-term" class="ittools-input" placeholder="12" value="12">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.LoanCalculator.calculate()">
                            💰 Calculate EMI
                        </button>
                    </div>
                    <div id="loan-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.LoanCalculator = {
    calculate() {
        const P = parseFloat(document.getElementById('loan-amount').value);
        const r = parseFloat(document.getElementById('loan-rate').value) / 100 / 12;
        const n = parseInt(document.getElementById('loan-term').value);
        if (!P || !r || !n) {
            ITTools.UI.showResult('loan-result', 'Please fill all fields', false);
            return;
        }
        const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        const totalPayment = emi * n;
        const totalInterest = totalPayment - P;
        const html = `
            <div style="margin-top: 15px; display: grid; gap: 10px;">
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px;">Monthly EMI</div>
                    <div style="font-size: 36px; font-weight: bold;">$${emi.toFixed(2)}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Total Payment:</strong><br>$${totalPayment.toFixed(2)}
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <strong>Total Interest:</strong><br>$${totalInterest.toFixed(2)}
                    </div>
                </div>
            </div>
        `;
        ITTools.UI.showResult('loan-result', html, true);
    }
};

// ============================================
// GST Calculator
// ============================================
ITTools.Tools.Registry.register('gst-calculator', {
    name: 'GST Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">GST Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Amount:</label>
                        <input type="number" id="gst-amount" class="ittools-input" placeholder="1000" value="1000">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">GST Rate (%):</label>
                        <select id="gst-rate" class="ittools-input">
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18" selected>18%</option>
                            <option value="28">28%</option>
                        </select>
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Calculation Type:</label>
                        <select id="gst-type" class="ittools-input">
                            <option value="exclusive">Add GST (Exclusive)</option>
                            <option value="inclusive">Remove GST (Inclusive)</option>
                        </select>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.GSTCalculator.calculate()">
                            🧾 Calculate GST
                        </button>
                    </div>
                    <div id="gst-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.GSTCalculator = {
    calculate() {
        const amount = parseFloat(document.getElementById('gst-amount').value);
        const rate = parseFloat(document.getElementById('gst-rate').value);
        const type = document.getElementById('gst-type').value;
        if (!amount) {
            ITTools.UI.showResult('gst-result', 'Please enter an amount', false);
            return;
        }
        let baseAmount, gstAmount, totalAmount;
        if (type === 'exclusive') {
            baseAmount = amount;
            gstAmount = amount * (rate / 100);
            totalAmount = amount + gstAmount;
        } else {
            totalAmount = amount;
            baseAmount = amount / (1 + rate / 100);
            gstAmount = totalAmount - baseAmount;
        }
        const html = `
            <div style="margin-top: 15px; display: grid; gap: 10px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                    <strong>Base Amount:</strong> $${baseAmount.toFixed(2)}
                </div>
                <div style="background: #fff3cd; padding: 15px; border-radius: 5px;">
                    <strong>GST (${rate}%):</strong> $${gstAmount.toFixed(2)}
                </div>
                <div style="background: #667eea; color: white; padding: 15px; border-radius: 5px;">
                    <strong>Total Amount:</strong> $${totalAmount.toFixed(2)}
                </div>
            </div>
        `;
        ITTools.UI.showResult('gst-result', html, true);
    }
};

// ============================================
// Percentage Calculator
// ============================================
ITTools.Tools.Registry.register('percentage-calculator', {
    name: 'Percentage Calculator',
    category: 'calculator',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Percentage Calculator</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">What is <input type="number" id="pct-x" style="width: 80px; display: inline;"> % of <input type="number" id="pct-y" style="width: 100px; display: inline;"> ?</label>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.PercentCalc.calculate()">
                            📊 Calculate
                        </button>
                    </div>
                    <div id="pct-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.PercentCalc = {
    calculate() {
        const x = parseFloat(document.getElementById('pct-x').value);
        const y = parseFloat(document.getElementById('pct-y').value);
        if (isNaN(x) || isNaN(y)) {
            ITTools.UI.showResult('pct-result', 'Please enter both values', false);
            return;
        }
        const result = (x / 100) * y;
        const html = `
            <div style="margin-top: 15px; background: #667eea; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                <div style="font-size: 14px;">${x}% of ${y} =</div>
                <div style="font-size: 36px; font-weight: bold;">${result.toFixed(2)}</div>
            </div>
        `;
        ITTools.UI.showResult('pct-result', html, true);
    }
};

// ============================================
// HEX to RGB Converter
// ============================================
ITTools.Tools.Registry.register('hex-rgb-converter', {
    name: 'HEX to RGB Converter',
console.log('ITTools Batch 6a loaded (age-calculator, bmi-calculator, loan-calculator, gst-calculator, percentage-calculator)');
