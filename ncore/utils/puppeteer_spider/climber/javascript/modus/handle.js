// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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