class Main{
     input(selector, content) {
        var dom = document.querySelector(selector);
        if (dom) {
            dom.focus();
            setTimeout(()=>{
                dom.value = content;
                var evt = new InputEvent('input', {
                    inputType: 'insertText',
                    data: content,
                    dataTransfer: null,
                    isComposing: false
                });
        
                dom.dispatchEvent(evt);
            },1000)
        } else {
            console.error('The element with the specified selector cannot be found');
        }
    }
     past(selector) {
        var element = document.querySelector(selector);
        if (element) {
            element.focus();
            var pasteEvent = new KeyboardEvent('keydown', {
                key: 'v',
                ctrlKey: true,
                bubbles: true,
                cancelable: true,
                composed: true
            });
            element.dispatchEvent(pasteEvent);
        } else {
            console.error('The element with the specified selector cannot be found');
        }
    }
}