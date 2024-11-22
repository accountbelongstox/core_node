'use strict';

class HandleInterface {
    init(browser, page) {}
    getCurrentPage(page) {}

    executeJsCode(jsCode) {
        // 执行一段js代码，返回结果
        // Executes the provided JavaScript code and returns the result.
    }

    triggerBySelector(selector, action = 'click') {
        // 根据一个选择器，触发其上面的功能（默认为点击）
        // Triggers a specified action (default is click) on an element found by the provided selector.
    }

    loadJsFileLocal(filePath) {
        // 载入一个JS文件（本地）
        // Loads and executes a local JavaScript file specified by the given path.
    }

    loadJsFileRemote(url) {
        // 载入一个JS文件（远程）
        // Loads and executes a remote JavaScript file from the provided URL.
    }

    loadJsFile(source) {
        // 载入一个JS文件（判断是本地还是远程，调用对应方法）
        // Determines whether the source is local or remote and loads the JavaScript file accordingly.
        if (source.startsWith('http://') || source.startsWith('https://')) {
            this.loadJsFileRemote(source);
        } else {
            this.loadJsFileLocal(source);
        }
    }

    executeJsCodeAndReturn(jsCode) {
        // 执行一段JS代码并返回
        // Executes the provided JavaScript code and returns its result.
    }

    executeJsCodeAndWait(jsCode) {
        // 执行一段JS代码，并等待执行完毕
        // Executes the provided JavaScript code and waits for it to complete.
    }

    dragAndDropElement(selector, targetX, targetY) {
        // 点击一个元素，并拖动到指定位置，然后放开鼠标
        // Finds an element by the selector, drags it, and drops it at the specified X and Y coordinates.
    }

    setInputBySelector(selector, value) {
        // 通过一个选择器，选择一个input，并发送指定值
        // Finds an input element by the selector and sets its value.
    }

    setSelectValueBySelector(selector, valueOrIndex) {
        // 通过一个选择器，选择一个select元素的指定值（支持值和index）
        // Finds a select element by the selector and sets its value or selects an option by index.
    }

    setCheckboxValueBySelector(selector, valueOrIndex) {
        // 通过一个选择器，选择一个复选元素的指定值（支持值和index）
        // Finds a checkbox element by the selector and checks/unchecks based on the value or index provided.
    }

    setRadioValueBySelector(selector, valueOrIndex) {
        // 通过一个选择器，选择一个单选元素的指定值（支持值和index）
        // Finds a radio element by the selector and selects the option based on the value or index provided.
    }

    setElementValueBySelector(selector, valueOrIndex) {
        // 通过一个选择器，根据元素类型，调用对应的方法并设置指定值
        // Finds an element by the selector and, depending on its type, sets its value accordingly.
    }

    getSelectValueBySelector(selector) {
        // 通过一个选择器，选择一个select元素的，获取指定值
        // Retrieves the selected value or option from a select element found by the selector.
    }

    getCheckboxValueBySelector(selector) {
        // 通过一个选择器，选择一个复选元素，获取指定值
        // Determines if the checkbox found by the selector is checked or unchecked.
    }

    getRadioValueBySelector(selector) {
        // 通过一个选择器，选择一个单选元素，获取指定值
        // Retrieves the value of the selected radio option found by the selector.
    }

    getElementValueBySelector(selector) {
        // 通过一个选择器，根据元素类型，调用对应的方法并获取指定值
        // Retrieves the value of an element found by the selector, depending on its type.
    }

    getCoordinatesBySelector(selector) {
        // 通过一个选择器，获取元素的指定位置x,y坐标
        // Retrieves the X and Y coordinates of an element found by the selector.
    }

    executeJsIfElementExists(selector, jsCode) {
        // 通过一个选择器，如果获取到指定元素，则执行JS代码
        // Executes the provided JavaScript code if an element matching the selector is found.
    }

    setFocusBySelector(selector) {
        // 通过一个选择器，设置为焦点
        // Sets focus on an element found by the selector.
    }

    clickElementBySelector(selector) {
        // 通过一个选择器，进行点击
        // Simulates a click action on an element found by the selector.
    }

    removeElementBySelector(selector) {
        // 通过一个选择器，移除该元素
        // Removes the element found by the selector from the DOM.
    }

    setInnerHtmlBySelector(selector, html) {
        // 通过一个选择器，设置innerHTML
        // Sets the innerHTML of the element found by the selector to the provided HTML string.
    }

    insertHtmlBeforeElementBySelector(selector, html) {
        // 通过一个选择器，在之前插入html代码
        // Inserts the provided HTML string before the element found by the selector.
    }

    insertHtmlAfterElementBySelector(selector, html) {
        // 通过一个选择器，在之后插入html代码
        // Inserts the provided HTML string after the element found by the selector.
    }

    insertHtmlInsideElementBySelector(selector, html) {
        // 通过一个选择器，在该选择器内部插入html代码
        // Inserts the provided HTML string inside the element found by the selector.
    }

    insertHtmlInsideEndOfElementBySelector(selector, html) {
        // 通过一个选择器，在该选择器内部/尾部插入html代码
        // Inserts the provided HTML string at the end inside the element found by the
    }

    createAndInsertHtmlElement(htmlString, targetSelector = 'BODY', position = 'beforeend', jsToExecute = null) {
        /* 根据提供的字符串创建HTML元素，并相对于目标元素在指定位置插入。插入后可选择执行提供的JavaScript。 */
        /* Creates an HTML element from the provided string and inserts it at the specified position relative to the target element. Optionally executes provided JavaScript after insertion. */
    }

    getScrollHeightBySelector(selector) {
        /* 检索通过选择器找到的元素的滚动高度。 */
        /* Retrieves the scroll height of an element found by the selector. */
    }

    scrollToPositionBySelector(selector, position = 'top') {
        /* 将通过选择器找到的元素滚动到指定位置（默认为顶部）。 */
        /* Scrolls the element found by the selector to the specified position (top by default). */
    }

    scrollToBottomBySelector(selector) {
        /* 将通过选择器找到的元素滚动到底部。 */
        /* Scrolls the element found by the selector to the bottom. */
    }

    horizontalSwipeBySelector(selector, length, direction = 'right') {
        /* 在通过选择器找到的元素上模拟水平滑动，以指定的方向（默认为右）滑动给定长度。 */
        /* Simulates a horizontal swipe on the element found by the selector for the given length in the specified direction (right by default). */
    }

    verticalSwipeBySelector(selector, length, direction = 'down') {
        /* 在通过选择器找到的元素上模拟垂直滑动，以指定的方向（默认向下）滑动给定长度。 */
        /* Simulates a vertical swipe on the element found by the selector for the given length in the specified direction (down by default). */
    }

    toString() {
        /* 返回HandleInterface类的字符串表示形式。 */
        /* Returns a string representation of the HandleInterface class. */
        return '[class HandleInterface]';
    }
}

module.exports = {
    HandleInterface
}
