function findLiByText(text) {
    return Array.from(document.querySelectorAll('li')).find(li => li.textContent.trim() === text);
}
function simulateClick(selector) {
    return new Promise((resolve) => {
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
            setTimeout(() => resolve(true), 1000);
        } else {
            console.log(`Element not found: ${selector}`);
            resolve(false);
        }
    });
}

function findElementByWildcard(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(document.querySelectorAll('*')).find(el => regex.test(el.id));
}

function findLiByDataValue(value) {
    return document.querySelector(`li[data-value="${value}"]`);
}

function simulateEnter(element) {
    const event = new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
    });
    element.dispatchEvent(event);
}

class Counter {
    constructor() {
        this.entries = [
            [18888, 8888, '192.168.100.1'], 
            [901, 18443, '192.168.100.1'], 
            [801, 18080, '192.168.100.1'], 
            [808, 18088, '192.168.100.1'], 
            // [8081, 8081, '192.168.100.3'],
            // [803, 80, '192.168.100.3'],
            // [903, 443, '192.168.100.3'],
            // [33399, 3389, '192.168.100.3'], 
            // [1025, 1025, '192.168.100.5'],
            // [1465, 1465, '192.168.100.5'],
            // [1587, 1587, '192.168.100.5'],
            // [805, 80, '192.168.100.5'],
            // [905, 443, '192.168.100.5'],
            // [5000, 5000, '192.168.100.5'],
            // [5022, 5022, '192.168.100.5'],
            // [5021, 5021, '192.168.100.5'],
            [5006, 5000, '192.168.100.6'], 
            [806, 80, '192.168.100.6'],
            [906, 443, '192.168.100.6'],
            // [810, 80, '192.168.100.10'],
            // [910, 443, '192.168.100.10'],
            // [8888, 18146, '192.168.100.10'],
            // [2222, 22, '192.168.100.10'], 
            // [8001, 8081, '192.168.100.10'], 
            // [33389, 3389, '192.168.100.11'], 
        ];
        this.initializeStorage();
    }

    initializeStorage() {
        try {
            if (!localStorage.getItem('current_mapping_index')) {
                localStorage.setItem('current_mapping_index', '-1');
            }
        } catch (error) {
            console.error('Error initializing port mapping storage:', error);
        }
    }

    next() {
        let currentIndex = parseInt(localStorage.getItem('current_mapping_index'));
        currentIndex++;
        if (currentIndex >= this.entries.length) {
            if (confirm('Reached the end of entries. Reset to beginning?')) {
                currentIndex = -1;
                localStorage.setItem('current_mapping_index', currentIndex.toString());
                return null;
            } else {
                return null;
            }
        }

        localStorage.setItem('current_mapping_index', currentIndex.toString());
        const [externalPort, internalPort, internalIP] = this.entries[currentIndex];
        
        console.log(`currentIndex: ${currentIndex}`);
        console.log(`entries length: ${this.entries.length}`);
        console.log(`externalPort: ${externalPort}`);
        console.log(`internalPort: ${internalPort}`);
        console.log(`internalIP: ${internalIP}`);
        return {
            name: `Port_${externalPort}_to_${internalPort}`,
            externalPort: externalPort,
            internalPort: internalPort,
            internalIP: internalIP
        };
    }

    async start() {
        const mapping = this.next();
        if (!mapping) {
            alert('No more port mappings to process');
            return;
        }

        try {
            const addButton = document.querySelector('.cbi-button.cbi-button-add');
            if (!addButton) throw new Error('Add button not found');
            await simulateClick(addButton);

            const nameInput = findElementByWildcard('widget.cbid.firewall.*.name');
            if (!nameInput) throw new Error('Name input not found');
            nameInput.value = mapping.name;
            nameInput.dispatchEvent(new Event('input'));
            await new Promise(resolve => setTimeout(resolve, 500));

            const portInput = findElementByWildcard('widget.cbid.firewall.*.src_dport');
            if (!portInput) throw new Error('Port input not found');
            portInput.value = mapping.externalPort;
            portInput.dispatchEvent(new Event('input'));
            await new Promise(resolve => setTimeout(resolve, 500));

            const anyLi = findLiByText('任意');
            if (!anyLi) throw new Error('"任意" option not found');
            await simulateClick(anyLi);
            await new Promise(resolve => setTimeout(resolve, 500));

            const targetLi = findLiByDataValue(mapping.internalIP);
            if (!targetLi) throw new Error(`Li with data-value="${mapping.internalIP}" not found`);
            await simulateClick(targetLi);
            await new Promise(resolve => setTimeout(resolve, 500));

            const destPortInput = findElementByWildcard('widget.cbid.firewall.*.dest_port');
            if (!destPortInput) throw new Error('Port input not found');
            destPortInput.value = mapping.internalPort;
            destPortInput.dispatchEvent(new Event('input'));
            await new Promise(resolve => setTimeout(resolve, 500));

            const submitButton = document.querySelector('.cbi-button.cbi-button-positive.important');
            if (!submitButton) throw new Error('Submit button not found');
            await simulateClick(submitButton);

            console.log(`Successfully processed mapping: ${mapping.name}`);
        } catch (error) {
            console.error('Error in start method:', error);
            alert(`Failed to process mapping: ${error.message}`);
        }
    }
}

// Create instance and start
const counter = new Counter();
counter.start().catch(console.error);
  