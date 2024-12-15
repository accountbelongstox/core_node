
class Counter {
  constructor() {
    this.entries = [
      [1025, 1025, '192.168.100.5'],
      [1465, 1465, '192.168.100.5'],
      [1587, 1587, '192.168.100.5'],
      [805, 80, '192.168.100.5'],
      [905, 443, '192.168.100.5'],
      [5000, 5000, '192.168.100.5'],
      [5022, 5022, '192.168.100.5'],
      [5021, 5021, '192.168.100.5'],
      [810, 80, '192.168.100.10'],
      [910, 443, '192.168.100.10'],
      [8888, 18146, '192.168.100.10'],
      [2222, 22, '192.168.100.10'],
      [8081, 8081, '192.168.100.3'],
      [803, 80, '192.168.100.3'],
      [903, 443, '192.168.100.3'],
      [33389, 3389, '192.168.100.11'], 
      [33399, 3389, '192.168.100.3'], 
      [5006, 5000, '192.168.100.6'], 
      [8001, 8081, '192.168.100.10'], 
      [18100, 18100, '192.168.100.1'], 
      [806, 80, '192.168.100.6'],
      [906, 443, '192.168.100.6'],
    ];
    
    this.maxValue = this.entries.length;
    this.key = 'counterValue';
  }

  valueGet() {
    let value = this.getValue();
    this.saveValue(value);
    alert(`Current Value: ${value}/${this.maxValue}`);
    return value;
  }

  incrementValueAndSave() {
    let value = this.getValue();
    value = this.incrementValue(value);
    this.saveValue(value);
    return value;
  }

  getValue() {
    let value = localStorage.getItem(this.key);
    if (!value && value !== 0) {
      value = 0;
    } else {
      value = parseInt(value, 10);
    }
    return value;
  }

  incrementValue(value) {
    value += 1;
    if (value >= this.maxValue) {
      alert('Max value reached, resetting to 0');
    }
    return value;
  }

  saveValue(value) {
    localStorage.setItem(this.key, value);
  }

  simulateClick(selector) {
    let element;
    if (typeof selector === 'string') {
      element = document.querySelector(selector);
    } else {
      element = selector;
    }

    if (element) {
      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(event);
    } else {
      console.log(`Element not found: ${selector}`);
    }
  }

  selectOption(selector, val, fuzzyMatch = false) {
    let element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (element && element.tagName === 'SELECT') {
      const options = element.options;
      for (let i = 0; i < options.length; i++) {
        if (fuzzyMatch ? options[i].text.includes(val) : options[i].value === val) {
          options[i].selected = true;
          break;
        }
      }
    } else {
      console.log(`Element not found or is not a SELECT element: ${selector}`);
    }
  }

  showCustomHideOther() {
    const customElement = document.getElementById('_newfwd.intaddr');
    const comboboxElement = document.getElementById('cbi.combobox._newfwd.intaddr');

    if (customElement && comboboxElement) {
      comboboxElement.style.display = 'none';
      customElement.style.display = 'block';
    } else {
      console.log(`Elements not found: _newfwd.intaddr or cbi.combobox._newfwd.intaddr`);
    }
  }

  performActions(wanPort, targetPort, targetIP, value) {
    this.selectOption('#_newfwd\\.extzone', 'wan'); // 选择“wan”项
    this.showCustomHideOther(); // 调用 showCustomHideOther 方法
    this.selectOption('#_newfwd\\.intzone', 'lan'); // 选择“lan”项
    document.getElementById('_newfwd.extport').value = wanPort; // 设置 wanPort
    document.getElementById('_newfwd.intaddr').value = targetIP; // 设置 targetIP
    document.getElementById('_newfwd.intport').value = targetPort; // 设置 targetPort
    document.getElementById('_newfwd.name').value = `Forward${wanPort}->${targetPort}`; // 设置 Forward name

    // 查找以 name="cbi.cts.firewall.redirect." 开头的元素并模拟点击
    const redirectButtons = document.querySelectorAll('input[name^="cbi.cts.firewall.redirect."]');
    redirectButtons.forEach(button => this.simulateClick(button));
  }

  executeEntry() {
    let value = this.valueGet();
    if (value >= this.maxValue) {
      alert('执行完毕');
      localStorage.removeItem(this.key);
      return 
    }
    const [wanPort, targetPort, targetIP] = this.entries[value];
    this.performActions(wanPort, targetPort, targetIP, value);
    console.log(`添加成功: Current Value: ${value}, Remaining Length: ${this.maxValue - value - 1}`);
    this.incrementValueAndSave()
  }
}

const counter = new Counter();
counter.executeEntry();
