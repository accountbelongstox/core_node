/* eslint-disable */
(() => {
  const Readability = window.__MCP_WEB_FETCHER_READABILITY__;
  if (!Readability) return;
  Object.assign(Readability.prototype, {
    _prepArticle(articleContent) {
      this._cleanStyles(articleContent);

      // Check for data tables before we continue, to avoid removing items in
      // those tables, which will often be isolated even though they're
      // visually linked to other content-ful elements (text, images, etc.).
      this._markDataTables(articleContent);

      this._fixLazyImages(articleContent);

      // Clean out junk from the article content
      this._cleanConditionally(articleContent, 'form');
      this._cleanConditionally(articleContent, 'fieldset');
      this._clean(articleContent, 'object');
      this._clean(articleContent, 'embed');
      this._clean(articleContent, 'footer');
      this._clean(articleContent, 'link');
      this._clean(articleContent, 'aside');

      // Clean out elements with little content that have "share" in their id/class combinations from final top candidates,
      // which means we don't remove the top candidates even they have "share".

      var shareElementThreshold = this.DEFAULT_CHAR_THRESHOLD;

      this._forEachNode(articleContent.children, function (topCandidate) {
        this._cleanMatchedNodes(topCandidate, function (node, matchString) {
          return (
            this.REGEXPS.shareElements.test(matchString) &&
            node.textContent.length < shareElementThreshold
          );
        });
      });

      this._clean(articleContent, 'iframe');
      this._clean(articleContent, 'input');
      this._clean(articleContent, 'textarea');
      this._clean(articleContent, 'select');
      this._clean(articleContent, 'button');
      this._cleanHeaders(articleContent);

      // Do these last as the previous stuff may have removed junk
      // that will affect these
      this._cleanConditionally(articleContent, 'table');
      this._cleanConditionally(articleContent, 'ul');
      this._cleanConditionally(articleContent, 'div');

      // replace H1 with H2 as H1 should be only title that is displayed separately
      this._replaceNodeTags(this._getAllNodesWithTag(articleContent, ['h1']), 'h2');

      // Remove extra paragraphs
      this._removeNodes(this._getAllNodesWithTag(articleContent, ['p']), function (paragraph) {
        // At this point, nasty iframes have been removed; only embedded video
        // ones remain.
        var contentElementCount = this._getAllNodesWithTag(paragraph, [
          'img',
          'embed',
          'object',
          'iframe',
        ]).length;
        return contentElementCount === 0 && !this._getInnerText(paragraph, false);
      });

      this._forEachNode(this._getAllNodesWithTag(articleContent, ['br']), function (br) {
        var next = this._nextNode(br.nextSibling);
        if (next && next.tagName == 'P') {
          br.remove();
        }
      });

      // Remove single-cell tables
      this._forEachNode(this._getAllNodesWithTag(articleContent, ['table']), function (table) {
        var tbody = this._hasSingleTagInsideElement(table, 'TBODY')
          ? table.firstElementChild
          : table;
        if (this._hasSingleTagInsideElement(tbody, 'TR')) {
          var row = tbody.firstElementChild;
          if (this._hasSingleTagInsideElement(row, 'TD')) {
            var cell = row.firstElementChild;
            cell = this._setNodeTag(
              cell,
              this._everyNode(cell.childNodes, this._isPhrasingContent) ? 'P' : 'DIV',
            );
            table.parentNode.replaceChild(cell, table);
          }
        }
      });
    },

    /**
     * Initialize a node with the readability object. Also checks the
     * className/id for special names to add to its score.
     *
     * @param Element
     * @return void
     **/
    _initializeNode(node) {
      node.readability = { contentScore: 0 };

      switch (node.tagName) {
        case 'DIV':
          node.readability.contentScore += 5;
          break;

        case 'PRE':
        case 'TD':
        case 'BLOCKQUOTE':
          node.readability.contentScore += 3;
          break;

        case 'ADDRESS':
        case 'OL':
        case 'UL':
        case 'DL':
        case 'DD':
        case 'DT':
        case 'LI':
        case 'FORM':
          node.readability.contentScore -= 3;
          break;

        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6':
        case 'TH':
          node.readability.contentScore -= 5;
          break;
      }

      node.readability.contentScore += this._getClassWeight(node);
    },

    _removeAndGetNext(node) {
      var nextNode = this._getNextNode(node, true);
      node.remove();
      return nextNode;
    },

    /**
     * Traverse the DOM from node to node, starting at the node passed in.
     * Pass true for the second parameter to indicate this node itself
     * (and its kids) are going away, and we want the next node over.
     *
     * Calling this in a loop will traverse the DOM depth-first.
     *
     * @param {Element} node
     * @param {boolean} ignoreSelfAndKids
     * @return {Element}
     */
    _getNextNode(node, ignoreSelfAndKids) {
      // First check for kids if those aren't being ignored
      if (!ignoreSelfAndKids && node.firstElementChild) {
        return node.firstElementChild;
      }
      // Then for siblings...
      if (node.nextElementSibling) {
        return node.nextElementSibling;
      }
      // And finally, move up the parent chain *and* find a sibling
      // (because this is depth-first traversal, we will have already
      // seen the parent nodes themselves).
      do {
        node = node.parentNode;
      } while (node && !node.nextElementSibling);
      return node && node.nextElementSibling;
    },

    // compares second text to first one
    // 1 = same text, 0 = completely different text
    // works the way that it splits both texts into words and then finds words that are unique in second text
    // the result is given by the lower length of unique parts
    _textSimilarity(textA, textB) {
      var tokensA = textA.toLowerCase().split(this.REGEXPS.tokenize).filter(Boolean);
      var tokensB = textB.toLowerCase().split(this.REGEXPS.tokenize).filter(Boolean);
      if (!tokensA.length || !tokensB.length) {
        return 0;
      }
      var uniqTokensB = tokensB.filter((token) => !tokensA.includes(token));
      var distanceB = uniqTokensB.join(' ').length / tokensB.join(' ').length;
      return 1 - distanceB;
    },

    /**
     * Checks whether an element node contains a valid byline
     *
     * @param node {Element}
     * @param matchString {string}
     * @return boolean
     */
    _isValidByline(node, matchString) {
      var rel = node.getAttribute('rel');
      var itemprop = node.getAttribute('itemprop');
      var bylineLength = node.textContent.trim().length;

      return (
        (rel === 'author' ||
          (itemprop && itemprop.includes('author')) ||
          this.REGEXPS.byline.test(matchString)) &&
        !!bylineLength &&
        bylineLength < 100
      );
    },

    _getNodeAncestors(node, maxDepth) {
      maxDepth = maxDepth || 0;
      var i = 0,
        ancestors = [];
      while (node.parentNode) {
        ancestors.push(node.parentNode);
        if (maxDepth && ++i === maxDepth) {
          break;
        }
        node = node.parentNode;
      }
      return ancestors;
    },

    /***
     * grabArticle - Using a variety of metrics (content score, classname, element types), find the content that is
     *         most likely to be the stuff a user wants to read. Then return it wrapped up in a div.
     *
     * @param page a document to run upon. Needs to be a full document, complete with body.
     * @return Element
     **/
  });
})();

