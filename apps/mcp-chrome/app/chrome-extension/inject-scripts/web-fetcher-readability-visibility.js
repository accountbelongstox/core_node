/* eslint-disable */
(() => {
  const Readability = window.__MCP_WEB_FETCHER_READABILITY__;
  if (!Readability) return;
  Object.assign(Readability.prototype, {
    _unwrapNoscriptImages(doc) {
      // Find img without source or attributes that might contains image, and remove it.
      // This is done to prevent a placeholder img is replaced by img from noscript in next step.
      var imgs = Array.from(doc.getElementsByTagName('img'));
      this._forEachNode(imgs, function (img) {
        for (var i = 0; i < img.attributes.length; i++) {
          var attr = img.attributes[i];
          switch (attr.name) {
            case 'src':
            case 'srcset':
            case 'data-src':
            case 'data-srcset':
              return;
          }

          if (/\.(jpg|jpeg|png|webp)/i.test(attr.value)) {
            return;
          }
        }

        img.remove();
      });

      // Next find noscript and try to extract its image
      var noscripts = Array.from(doc.getElementsByTagName('noscript'));
      this._forEachNode(noscripts, function (noscript) {
        // Parse content of noscript and make sure it only contains image
        if (!this._isSingleImage(noscript)) {
          return;
        }
        var tmp = doc.createElement('div');
        // We're running in the document context, and using unmodified
        // document contents, so doing this should be safe.
        // (Also we heavily discourage people from allowing script to
        // run at all in this document...)
        // eslint-disable-next-line no-unsanitized/property
        tmp.innerHTML = noscript.innerHTML;

        // If noscript has previous sibling and it only contains image,
        // replace it with noscript content. However we also keep old
        // attributes that might contains image.
        var prevElement = noscript.previousElementSibling;
        if (prevElement && this._isSingleImage(prevElement)) {
          var prevImg = prevElement;
          if (prevImg.tagName !== 'IMG') {
            prevImg = prevElement.getElementsByTagName('img')[0];
          }

          var newImg = tmp.getElementsByTagName('img')[0];
          for (var i = 0; i < prevImg.attributes.length; i++) {
            var attr = prevImg.attributes[i];
            if (attr.value === '') {
              continue;
            }

            if (
              attr.name === 'src' ||
              attr.name === 'srcset' ||
              /\.(jpg|jpeg|png|webp)/i.test(attr.value)
            ) {
              if (newImg.getAttribute(attr.name) === attr.value) {
                continue;
              }

              var attrName = attr.name;
              if (newImg.hasAttribute(attrName)) {
                attrName = 'data-old-' + attrName;
              }

              newImg.setAttribute(attrName, attr.value);
            }
          }

          noscript.parentNode.replaceChild(tmp.firstElementChild, prevElement);
        }
      });
    },

    /**
     * Removes script tags from the document.
     *
     * @param Element
     **/
    _removeScripts(doc) {
      this._removeNodes(this._getAllNodesWithTag(doc, ['script', 'noscript']));
    },

    /**
     * Check if this node has only whitespace and a single element with given tag
     * Returns false if the DIV node contains non-empty text nodes
     * or if it contains no element with given tag or more than 1 element.
     *
     * @param Element
     * @param string tag of child element
     **/
    _hasSingleTagInsideElement(element, tag) {
      // There should be exactly 1 element child with given tag
      if (element.children.length != 1 || element.children[0].tagName !== tag) {
        return false;
      }

      // And there should be no text nodes with real content
      return !this._someNode(element.childNodes, function (node) {
        return node.nodeType === this.TEXT_NODE && this.REGEXPS.hasContent.test(node.textContent);
      });
    },

    _isElementWithoutContent(node) {
      return (
        node.nodeType === this.ELEMENT_NODE &&
        !node.textContent.trim().length &&
        (!node.children.length ||
          node.children.length ==
            node.getElementsByTagName('br').length + node.getElementsByTagName('hr').length)
      );
    },

    /**
     * Determine whether element has any children block level elements.
     *
     * @param Element
     */
    _hasChildBlockElement(element) {
      return this._someNode(element.childNodes, function (node) {
        return this.DIV_TO_P_ELEMS.has(node.tagName) || this._hasChildBlockElement(node);
      });
    },

    /***
     * Determine if a node qualifies as phrasing content.
     * https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_categories#Phrasing_content
     **/
    _isPhrasingContent(node) {
      return (
        node.nodeType === this.TEXT_NODE ||
        this.PHRASING_ELEMS.includes(node.tagName) ||
        ((node.tagName === 'A' || node.tagName === 'DEL' || node.tagName === 'INS') &&
          this._everyNode(node.childNodes, this._isPhrasingContent))
      );
    },

    _isWhitespace(node) {
      return (
        (node.nodeType === this.TEXT_NODE && node.textContent.trim().length === 0) ||
        (node.nodeType === this.ELEMENT_NODE && node.tagName === 'BR')
      );
    },

    /**
     * Get the inner text of a node - cross browser compatibly.
     * This also strips out any excess whitespace to be found.
     *
     * @param Element
     * @param Boolean normalizeSpaces (default: true)
     * @return string
     **/
    _getInnerText(e, normalizeSpaces) {
      normalizeSpaces = typeof normalizeSpaces === 'undefined' ? true : normalizeSpaces;
      var textContent = e.textContent.trim();

      if (normalizeSpaces) {
        return textContent.replace(this.REGEXPS.normalize, ' ');
      }
      return textContent;
    },

    /**
     * Get the number of times a string s appears in the node e.
     *
     * @param Element
     * @param string - what to split on. Default is ","
     * @return number (integer)
     **/
    _getCharCount(e, s) {
      s = s || ',';
      return this._getInnerText(e).split(s).length - 1;
    },

    /**
     * Remove the style attribute on every e and under.
     * TODO: Test if getElementsByTagName(*) is faster.
     *
     * @param Element
     * @return void
     **/
    _cleanStyles(e) {
      if (!e || e.tagName.toLowerCase() === 'svg') {
        return;
      }

      // Remove `style` and deprecated presentational attributes
      for (var i = 0; i < this.PRESENTATIONAL_ATTRIBUTES.length; i++) {
        e.removeAttribute(this.PRESENTATIONAL_ATTRIBUTES[i]);
      }

      if (this.DEPRECATED_SIZE_ATTRIBUTE_ELEMS.includes(e.tagName)) {
        e.removeAttribute('width');
        e.removeAttribute('height');
      }

      var cur = e.firstElementChild;
      while (cur !== null) {
        this._cleanStyles(cur);
        cur = cur.nextElementSibling;
      }
    },

    /**
     * Get the density of links as a percentage of the content
     * This is the amount of text that is inside a link divided by the total text in the node.
     *
     * @param Element
     * @return number (float)
     **/
    _getLinkDensity(element) {
      var textLength = this._getInnerText(element).length;
      if (textLength === 0) {
        return 0;
      }

      var linkLength = 0;

      // XXX implement _reduceNodeList?
      this._forEachNode(element.getElementsByTagName('a'), function (linkNode) {
        var href = linkNode.getAttribute('href');
        var coefficient = href && this.REGEXPS.hashUrl.test(href) ? 0.3 : 1;
        linkLength += this._getInnerText(linkNode).length * coefficient;
      });

      return linkLength / textLength;
    },

    /**
     * Get an elements class/id weight. Uses regular expressions to tell if this
     * element looks good or bad.
     *
     * @param Element
     * @return number (Integer)
     **/
    _getClassWeight(e) {
      if (!this._flagIsActive(this.FLAG_WEIGHT_CLASSES)) {
        return 0;
      }

      var weight = 0;

      // Look for a special classname
      if (typeof e.className === 'string' && e.className !== '') {
        if (this.REGEXPS.negative.test(e.className)) {
          weight -= 25;
        }

        if (this.REGEXPS.positive.test(e.className)) {
          weight += 25;
        }
      }

      // Look for a special ID
      if (typeof e.id === 'string' && e.id !== '') {
        if (this.REGEXPS.negative.test(e.id)) {
          weight -= 25;
        }

        if (this.REGEXPS.positive.test(e.id)) {
          weight += 25;
        }
      }

      return weight;
    },

    /**
     * Clean a node of all elements of type "tag".
     * (Unless it's a youtube/vimeo video. People love movies.)
     *
     * @param Element
     * @param string tag to clean
     * @return void
     **/
    _clean(e, tag) {
      var isEmbed = ['object', 'embed', 'iframe'].includes(tag);

      this._removeNodes(this._getAllNodesWithTag(e, [tag]), function (element) {
        // Allow youtube and vimeo videos through as people usually want to see those.
        if (isEmbed) {
          // First, check the elements attributes to see if any of them contain youtube or vimeo
          for (var i = 0; i < element.attributes.length; i++) {
            if (this._allowedVideoRegex.test(element.attributes[i].value)) {
              return false;
            }
          }

          // For embed with <object> tag, check inner HTML as well.
          if (element.tagName === 'object' && this._allowedVideoRegex.test(element.innerHTML)) {
            return false;
          }
        }

        return true;
      });
    },

    /**
     * Check if a given node has one of its ancestor tag name matching the
     * provided one.
     * @param  HTMLElement node
     * @param  String      tagName
     * @param  Number      maxDepth
     * @param  Function    filterFn a filter to invoke to determine whether this node 'counts'
     * @return Boolean
     */
    _hasAncestorTag(node, tagName, maxDepth, filterFn) {
      maxDepth = maxDepth || 3;
      tagName = tagName.toUpperCase();
      var depth = 0;
      while (node.parentNode) {
        if (maxDepth > 0 && depth > maxDepth) {
          return false;
        }
        if (node.parentNode.tagName === tagName && (!filterFn || filterFn(node.parentNode))) {
          return true;
        }
        node = node.parentNode;
        depth++;
      }
      return false;
    },

    /**
     * Return an object indicating how many rows and columns this table has.
     */
    _getRowAndColumnCount(table) {
      var rows = 0;
      var columns = 0;
      var trs = table.getElementsByTagName('tr');
      for (var i = 0; i < trs.length; i++) {
        var rowspan = trs[i].getAttribute('rowspan') || 0;
        if (rowspan) {
          rowspan = parseInt(rowspan, 10);
        }
        rows += rowspan || 1;

        // Now look for column-related info
        var columnsInThisRow = 0;
        var cells = trs[i].getElementsByTagName('td');
        for (var j = 0; j < cells.length; j++) {
          var colspan = cells[j].getAttribute('colspan') || 0;
          if (colspan) {
            colspan = parseInt(colspan, 10);
          }
          columnsInThisRow += colspan || 1;
        }
        columns = Math.max(columns, columnsInThisRow);
      }
      return { rows, columns };
    },

    /**
     * Look for 'data' (as opposed to 'layout') tables, for which we use
     * similar checks as
     * https://searchfox.org/mozilla-central/rev/f82d5c549f046cb64ce5602bfd894b7ae807c8f8/accessible/generic/TableAccessible.cpp#19
     */
    _markDataTables(root) {
      var tables = root.getElementsByTagName('table');
      for (var i = 0; i < tables.length; i++) {
        var table = tables[i];
        var role = table.getAttribute('role');
        if (role == 'presentation') {
          table._readabilityDataTable = false;
          continue;
        }
        var datatable = table.getAttribute('datatable');
        if (datatable == '0') {
          table._readabilityDataTable = false;
          continue;
        }
        var summary = table.getAttribute('summary');
        if (summary) {
          table._readabilityDataTable = true;
          continue;
        }

        var caption = table.getElementsByTagName('caption')[0];
        if (caption && caption.childNodes.length) {
          table._readabilityDataTable = true;
          continue;
        }

        // If the table has a descendant with any of these tags, consider a data table:
        var dataTableDescendants = ['col', 'colgroup', 'tfoot', 'thead', 'th'];
        var descendantExists = function (tag) {
          return !!table.getElementsByTagName(tag)[0];
        };
        if (dataTableDescendants.some(descendantExists)) {
          this.log('Data table because found data-y descendant');
          table._readabilityDataTable = true;
          continue;
        }

        // Nested tables indicate a layout table:
        if (table.getElementsByTagName('table')[0]) {
          table._readabilityDataTable = false;
          continue;
        }

        var sizeInfo = this._getRowAndColumnCount(table);

        if (sizeInfo.columns == 1 || sizeInfo.rows == 1) {
          // single colum/row tables are commonly used for page layout purposes.
          table._readabilityDataTable = false;
          continue;
        }

        if (sizeInfo.rows >= 10 || sizeInfo.columns > 4) {
          table._readabilityDataTable = true;
          continue;
        }
        // Now just go by size entirely:
        table._readabilityDataTable = sizeInfo.rows * sizeInfo.columns > 10;
      }
    },

    /* convert images and figures that have properties like data-src into images that can be loaded without JS */
    _fixLazyImages(root) {
      this._forEachNode(
        this._getAllNodesWithTag(root, ['img', 'picture', 'figure']),
        function (elem) {
          // In some sites (e.g. Kotaku), they put 1px square image as base64 data uri in the src attribute.
          // So, here we check if the data uri is too short, just might as well remove it.
          if (elem.src && this.REGEXPS.b64DataUrl.test(elem.src)) {
            // Make sure it's not SVG, because SVG can have a meaningful image in under 133 bytes.
            var parts = this.REGEXPS.b64DataUrl.exec(elem.src);
            if (parts[1] === 'image/svg+xml') {
              return;
            }

            // Make sure this element has other attributes which contains image.
            // If it doesn't, then this src is important and shouldn't be removed.
            var srcCouldBeRemoved = false;
            for (var i = 0; i < elem.attributes.length; i++) {
              var attr = elem.attributes[i];
              if (attr.name === 'src') {
                continue;
              }

              if (/\.(jpg|jpeg|png|webp)/i.test(attr.value)) {
                srcCouldBeRemoved = true;
                break;
              }
            }

            // Here we assume if image is less than 100 bytes (or 133 after encoded to base64)
            // it will be too small, therefore it might be placeholder image.
            if (srcCouldBeRemoved) {
              var b64starts = parts[0].length;
              var b64length = elem.src.length - b64starts;
              if (b64length < 133) {
                elem.removeAttribute('src');
              }
            }
          }

          // also check for "null" to work around https://github.com/jsdom/jsdom/issues/2580
          if (
            (elem.src || (elem.srcset && elem.srcset != 'null')) &&
            !elem.className.toLowerCase().includes('lazy')
          ) {
            return;
          }

          for (var j = 0; j < elem.attributes.length; j++) {
            attr = elem.attributes[j];
            if (attr.name === 'src' || attr.name === 'srcset' || attr.name === 'alt') {
              continue;
            }
            var copyTo = null;
            if (/\.(jpg|jpeg|png|webp)\s+\d/.test(attr.value)) {
              copyTo = 'srcset';
            } else if (/^\s*\S+\.(jpg|jpeg|png|webp)\S*\s*$/.test(attr.value)) {
              copyTo = 'src';
            }
            if (copyTo) {
              //if this is an img or picture, set the attribute directly
              if (elem.tagName === 'IMG' || elem.tagName === 'PICTURE') {
                elem.setAttribute(copyTo, attr.value);
              } else if (
                elem.tagName === 'FIGURE' &&
                !this._getAllNodesWithTag(elem, ['img', 'picture']).length
              ) {
                //if the item is a <figure> that does not contain an image or picture, create one and place it inside the figure
                //see the nytimes-3 testcase for an example
                var img = this._doc.createElement('img');
                img.setAttribute(copyTo, attr.value);
                elem.appendChild(img);
              }
            }
          }
        },
      );
    },

    _getTextDensity(e, tags) {
      var textLength = this._getInnerText(e, true).length;
      if (textLength === 0) {
        return 0;
      }
      var childrenLength = 0;
      var children = this._getAllNodesWithTag(e, tags);
      this._forEachNode(
        children,
        (child) => (childrenLength += this._getInnerText(child, true).length),
      );
      return childrenLength / textLength;
    },

    /**
     * Clean an element of all tags of type "tag" if they look fishy.
     * "Fishy" is an algorithm based on content length, classnames, link density, number of images & embeds, etc.
     *
     * @return void
     **/
  });
})();
