<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

content.getCurrentPage() # Get the current page instance.
content.getFullPageOuterHTMLAndWait() # Get the outer HTML of the full page after waiting for page load.
content.getFullPageOuterHTML() # Get the outer HTML of the full page.
content.getAllAnchorHrefs(completeURL = false) # Get all anchor href attributes. If completeURL is true, returns complete URLs.
content.getAllImageSrcs(completeURL = false) # Get all image src attributes. If completeURL is true, returns complete URLs.
content.getAllCssResourcePaths(completeURL = false) # Get all CSS resource paths. If completeURL is true, returns complete URLs.
content.getAllJsResourcePaths(completeURL = false) # Get all JS resource paths. If completeURL is true, returns complete URLs.
content.queryAllElements(selector) # Query all elements by selector.
content.isImageElement(selector) # Check if an element with the given selector is an image.
content.isAnchorElement(selector) # Check if an element with the given selector is an anchor.
content.isJsElement(selector) # Check if an element with the given selector is a script.
content.isCssElement(selector) # Check if an element with the given selector is a stylesheet.
content.getElementBySelector(selector) # Get the element with the given selector.
content.getElementBySelectorAndWait(selector, waitDuration = 50000) # Get the element with the given selector after waiting for it.
content.getElementsBySelectorAndWait(selector, waitDuration = 50000) # Get all elements with the given selector after waiting for them.
content.getTextBySelector(selector) # Get text content of an element with the given selector.
content.getAllTextsBySelector(selector) # Get an array of text content of all elements with the given selector.
content.getHTMLBySelector(selector) # Get inner HTML of an element with the given selector.
content.getTextBySelectorAndWait(selector, waitDuration = 50000) # Get text content of an element with the given selector after waiting for it.
content.getHTMLBySelectorAndWait(selector, waitDuration = 50000) # Get inner HTML of an element with the given selector after waiting for it.
content.getElementsByTag(tag) # Query all elements by tag name.
content.getElementByXpath(xpath) # Get the element with the given XPath.
content.getSiblingBeforeText(selector, n = 0) # Get the text content of the sibling before the element with the given selector.
content.getSiblingAfterText(selector, n = 0) # Get the text content of the sibling after the element with the given selector.
content.getDataAttributeBySelector(selector) # Get dataset attributes of an element with the given selector.
content.getAllDataAttributesBySelector(selector) # Get dataset attributes of all elements with the given selector.
content.countElementsBySelector(selector) # Count the number of elements with the given selector.
content.getTextBySelectorAndIndex(selector, index = 0) # Get text content of an element with the given selector and index.
content.getHTMLBySelectorAndIndex(selector, index = 0) # Get inner HTML of an element with the given selector and index.
content.getDataBySelectorAndIndex(selector, index = 0) # Get dataset attributes of an element with the given selector and index.
content.getValueBySelectorAndIndex(selector, index = 0) # Get the value attribute of an element with the given selector and index.
content.getElementByText(text) # Get an element with the specified text content.
content.getBrowserLogValues() # Get values from the browser console log.
content.replaceClassBySelector(selector, newClass) # Replace the class of elements with the given selector with a new class.
content.addClassBySelector(selector, newClass) # Add a class to elements with the given selector if it doesn't already exist.
content.removeClassBySelector(selector, className) # Remove a class from elements with the given selector.
content.setStyleBySelector(selector, style) # Set styles for elements with the given selector.
content.waitFor(str) # Wait for a specific string to appear in the page.
content.waitForElement(selector) # Wait for an element with the given selector to become visible.
content.waitForCallback(selector, callback, timeout = 2000) # Wait for an element with the given selector and execute a callback.
content.findIPsInHTML() # Find all IP addresses in the HTML content of the current page.
content.getLastIPInHTML() # Get the last IP address found in the HTML content of the current page.
content.searchContentInFullHTML(content) # Search for a specific content in the full HTML of the current page.
content.getChildElementsMatchingSelector(parentSelector, childSelector) # Get data (tag name and text content) of child elements matching a selector within a parent element.
content.getHeightBySelector(selector) # Get the height of an element with the given selector.
content.getWidthBySelector(selector) # Get the width of an element with the given selector.
content.getSubElementsBase64BySelector(selector) # Get base64-encoded data (src, data, class, id) of sub-elements (images) within an element matching a selector.
content.getElementsMatchingSelector(selector) # Get data (tag name and text content) of elements matching a selector.
content.getImagesMatchingSelector(selector) # Get image elements matching a selector.
content.getImgAttributesMatchingSelector(selector) # Get attributes (src, class, data attributes, id, alt) of img elements matching a selector.
content.getBase64BySrcs(selector) # Get base64-encoded data (src, data, class, id) of images within an element matching a selector.
content.getLinkAttributesMatchingSelector(selector) # Get attributes (href, class, data-attr, id, text content) of link elements matching a selector.