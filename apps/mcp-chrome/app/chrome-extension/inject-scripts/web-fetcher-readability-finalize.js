/* eslint-disable */
(() => {
  const Readability = window.__MCP_WEB_FETCHER_READABILITY__;
  if (!Readability) return;
  Object.assign(Readability.prototype, {
    _cleanConditionally(e, tag) {
      if (!this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY)) {
        return;
      }

      // Gather counts for other typical elements embedded within.
      // Traverse backwards so we can remove nodes at the same time
      // without effecting the traversal.
      //
      // TODO: Consider taking into account original contentScore here.
      this._removeNodes(this._getAllNodesWithTag(e, [tag]), function (node) {
        // First check if this node IS data table, in which case don't remove it.
        var isDataTable = function (t) {
          return t._readabilityDataTable;
        };

        var isList = tag === 'ul' || tag === 'ol';
        if (!isList) {
          var listLength = 0;
          var listNodes = this._getAllNodesWithTag(node, ['ul', 'ol']);
          this._forEachNode(listNodes, (list) => (listLength += this._getInnerText(list).length));
          isList = listLength / this._getInnerText(node).length > 0.9;
        }

        if (tag === 'table' && isDataTable(node)) {
          return false;
        }

        // Next check if we're inside a data table, in which case don't remove it as well.
        if (this._hasAncestorTag(node, 'table', -1, isDataTable)) {
          return false;
        }

        if (this._hasAncestorTag(node, 'code')) {
          return false;
        }

        // keep element if it has a data tables
        if ([...node.getElementsByTagName('table')].some((tbl) => tbl._readabilityDataTable)) {
          return false;
        }

        var weight = this._getClassWeight(node);

        this.log('Cleaning Conditionally', node);

        var contentScore = 0;

        if (weight + contentScore < 0) {
          return true;
        }

        if (this._getCharCount(node, ',') < 10) {
          // If there are not very many commas, and the number of
          // non-paragraph elements is more than paragraphs or other
          // ominous signs, remove the element.
          var p = node.getElementsByTagName('p').length;
          var img = node.getElementsByTagName('img').length;
          var li = node.getElementsByTagName('li').length - 100;
          var input = node.getElementsByTagName('input').length;
          var headingDensity = this._getTextDensity(node, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

          var embedCount = 0;
          var embeds = this._getAllNodesWithTag(node, ['object', 'embed', 'iframe']);

          for (var i = 0; i < embeds.length; i++) {
            // If this embed has attribute that matches video regex, don't delete it.
            for (var j = 0; j < embeds[i].attributes.length; j++) {
              if (this._allowedVideoRegex.test(embeds[i].attributes[j].value)) {
                return false;
              }
            }

            // For embed with <object> tag, check inner HTML as well.
            if (
              embeds[i].tagName === 'object' &&
              this._allowedVideoRegex.test(embeds[i].innerHTML)
            ) {
              return false;
            }

            embedCount++;
          }

          var innerText = this._getInnerText(node);

          // toss any node whose inner text contains nothing but suspicious words
          if (this.REGEXPS.adWords.test(innerText) || this.REGEXPS.loadingWords.test(innerText)) {
            return true;
          }

          var contentLength = innerText.length;
          var linkDensity = this._getLinkDensity(node);
          var textishTags = ['SPAN', 'LI', 'TD'].concat(Array.from(this.DIV_TO_P_ELEMS));
          var textDensity = this._getTextDensity(node, textishTags);
          var isFigureChild = this._hasAncestorTag(node, 'figure');

          // apply shadiness checks, then check for exceptions
          const shouldRemoveNode = () => {
            const errs = [];
            if (!isFigureChild && img > 1 && p / img < 0.5) {
              errs.push(`Bad p to img ratio (img=${img}, p=${p})`);
            }
            if (!isList && li > p) {
              errs.push(`Too many li's outside of a list. (li=${li} > p=${p})`);
            }
            if (input > Math.floor(p / 3)) {
              errs.push(`Too many inputs per p. (input=${input}, p=${p})`);
            }
            if (
              !isList &&
              !isFigureChild &&
              headingDensity < 0.9 &&
              contentLength < 25 &&
              (img === 0 || img > 2) &&
              linkDensity > 0
            ) {
              errs.push(
                `Suspiciously short. (headingDensity=${headingDensity}, img=${img}, linkDensity=${linkDensity})`,
              );
            }
            if (!isList && weight < 25 && linkDensity > 0.2 + this._linkDensityModifier) {
              errs.push(`Low weight and a little linky. (linkDensity=${linkDensity})`);
            }
            if (weight >= 25 && linkDensity > 0.5 + this._linkDensityModifier) {
              errs.push(`High weight and mostly links. (linkDensity=${linkDensity})`);
            }
            if ((embedCount === 1 && contentLength < 75) || embedCount > 1) {
              errs.push(
                `Suspicious embed. (embedCount=${embedCount}, contentLength=${contentLength})`,
              );
            }
            if (img === 0 && textDensity === 0) {
              errs.push(`No useful content. (img=${img}, textDensity=${textDensity})`);
            }

            if (errs.length) {
              this.log('Checks failed', errs);
              return true;
            }

            return false;
          };

          var haveToRemove = shouldRemoveNode();

          // Allow simple lists of images to remain in pages
          if (isList && haveToRemove) {
            for (var x = 0; x < node.children.length; x++) {
              let child = node.children[x];
              // Don't filter in lists with li's that contain more than one child
              if (child.children.length > 1) {
                return haveToRemove;
              }
            }
            let li_count = node.getElementsByTagName('li').length;
            // Only allow the list to remain if every li contains an image
            if (img == li_count) {
              return false;
            }
          }
          return haveToRemove;
        }
        return false;
      });
    },

    /**
     * Clean out elements that match the specified conditions
     *
     * @param Element
     * @param Function determines whether a node should be removed
     * @return void
     **/
    _cleanMatchedNodes(e, filter) {
      var endOfSearchMarkerNode = this._getNextNode(e, true);
      var next = this._getNextNode(e);
      while (next && next != endOfSearchMarkerNode) {
        if (filter.call(this, next, next.className + ' ' + next.id)) {
          next = this._removeAndGetNext(next);
        } else {
          next = this._getNextNode(next);
        }
      }
    },

    /**
     * Clean out spurious headers from an Element.
     *
     * @param Element
     * @return void
     **/
    _cleanHeaders(e) {
      let headingNodes = this._getAllNodesWithTag(e, ['h1', 'h2']);
      this._removeNodes(headingNodes, function (node) {
        let shouldRemove = this._getClassWeight(node) < 0;
        if (shouldRemove) {
          this.log('Removing header with low class weight:', node);
        }
        return shouldRemove;
      });
    },

    /**
     * Check if this node is an H1 or H2 element whose content is mostly
     * the same as the article title.
     *
     * @param Element  the node to check.
     * @return boolean indicating whether this is a title-like header.
     */
    _headerDuplicatesTitle(node) {
      if (node.tagName != 'H1' && node.tagName != 'H2') {
        return false;
      }
      var heading = this._getInnerText(node, false);
      this.log('Evaluating similarity of header:', heading, this._articleTitle);
      return this._textSimilarity(this._articleTitle, heading) > 0.75;
    },

    _flagIsActive(flag) {
      return (this._flags & flag) > 0;
    },

    _removeFlag(flag) {
      this._flags = this._flags & ~flag;
    },

    _isProbablyVisible(node) {
      // Have to null-check node.style and node.className.includes to deal with SVG and MathML nodes.
      return (
        (!node.style || node.style.display != 'none') &&
        (!node.style || node.style.visibility != 'hidden') &&
        !node.hasAttribute('hidden') &&
        //check for "fallback-image" so that wikimedia math images are displayed
        (!node.hasAttribute('aria-hidden') ||
          node.getAttribute('aria-hidden') != 'true' ||
          (node.className && node.className.includes && node.className.includes('fallback-image')))
      );
    },

    /**
     * Runs readability.
     *
     * Workflow:
     *  1. Prep the document by removing script tags, css, etc.
     *  2. Build readability's DOM tree.
     *  3. Grab the article content from the current dom tree.
     *  4. Replace the current DOM tree with the new one.
     *  5. Read peacefully.
     *
     * @return void
     **/
    parse() {
      // Avoid parsing too large documents, as per configuration option
      if (this._maxElemsToParse > 0) {
        var numTags = this._doc.getElementsByTagName('*').length;
        if (numTags > this._maxElemsToParse) {
          throw new Error('Aborting parsing document; ' + numTags + ' elements found');
        }
      }

      // Unwrap image from noscript
      this._unwrapNoscriptImages(this._doc);

      // Extract JSON-LD metadata before removing scripts
      var jsonLd = this._disableJSONLD ? {} : this._getJSONLD(this._doc);

      // Remove script tags from the document.
      this._removeScripts(this._doc);

      this._prepDocument();

      var metadata = this._getArticleMetadata(jsonLd);
      this._metadata = metadata;
      this._articleTitle = metadata.title;

      var articleContent = this._grabArticle();
      if (!articleContent) {
        return null;
      }

      this.log('Grabbed: ' + articleContent.innerHTML);

      this._postProcessContent(articleContent);

      // If we haven't found an excerpt in the article's metadata, use the article's
      // first paragraph as the excerpt. This is used for displaying a preview of
      // the article's content.
      if (!metadata.excerpt) {
        var paragraphs = articleContent.getElementsByTagName('p');
        if (paragraphs.length) {
          metadata.excerpt = paragraphs[0].textContent.trim();
        }
      }

      var textContent = articleContent.textContent;
      return {
        title: this._articleTitle,
        byline: metadata.byline || this._articleByline,
        dir: this._articleDir,
        lang: this._articleLang,
        content: this._serializer(articleContent),
        textContent,
        length: textContent.length,
        excerpt: metadata.excerpt,
        siteName: metadata.siteName || this._articleSiteName,
        publishedTime: metadata.publishedTime,
      };
    },
  });
})();

