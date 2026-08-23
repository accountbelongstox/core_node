/* eslint-disable */

if (!window.__MCP_WEB_FETCHER_READABILITY__) {
  /*
   * Copyright (c) 2010 Arc90 Inc
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  /*
   * This code is heavily based on Arc90's readability.js (1.7.1) script
   * available at: http://code.google.com/p/arc90labs-readability
   */

  /**
   * Public constructor.
   * @param {HTMLDocument} doc     The document to parse.
   * @param {Object}       options The options object.
   */
  function Readability(doc, options) {
    // In some older versions, people passed a URI as the first argument. Cope:
    if (options && options.documentElement) {
      doc = options;
      options = arguments[2];
    } else if (!doc || !doc.documentElement) {
      throw new Error('First argument to Readability constructor should be a document object.');
    }
    options = options || {};

    this._doc = doc;
    this._docJSDOMParser = this._doc.firstChild.__JSDOMParser__;
    this._articleTitle = null;
    this._articleByline = null;
    this._articleDir = null;
    this._articleSiteName = null;
    this._attempts = [];
    this._metadata = {};

    // Configurable options
    this._debug = !!options.debug;
    this._maxElemsToParse = options.maxElemsToParse || this.DEFAULT_MAX_ELEMS_TO_PARSE;
    this._nbTopCandidates = options.nbTopCandidates || this.DEFAULT_N_TOP_CANDIDATES;
    this._charThreshold = options.charThreshold || this.DEFAULT_CHAR_THRESHOLD;
    this._classesToPreserve = this.CLASSES_TO_PRESERVE.concat(options.classesToPreserve || []);
    this._keepClasses = !!options.keepClasses;
    this._serializer =
      options.serializer ||
      function (el) {
        return el.innerHTML;
      };
    this._disableJSONLD = !!options.disableJSONLD;
    this._allowedVideoRegex = options.allowedVideoRegex || this.REGEXPS.videos;
    this._linkDensityModifier = options.linkDensityModifier || 0;

    // Start with all flags set
    this._flags =
      this.FLAG_STRIP_UNLIKELYS | this.FLAG_WEIGHT_CLASSES | this.FLAG_CLEAN_CONDITIONALLY;

    // Control whether log messages are sent to the console
    if (this._debug) {
      let logNode = function (node) {
        if (node.nodeType == node.TEXT_NODE) {
          return `${node.nodeName} ("${node.textContent}")`;
        }
        let attrPairs = Array.from(node.attributes || [], function (attr) {
          return `${attr.name}="${attr.value}"`;
        }).join(' ');
        return `<${node.localName} ${attrPairs}>`;
      };
      this.log = function () {
        if (typeof console !== 'undefined') {
          let args = Array.from(arguments, (arg) => {
            if (arg && arg.nodeType == this.ELEMENT_NODE) {
              return logNode(arg);
            }
            return arg;
          });
          args.unshift('Reader: (Readability)');

          // Debug logging removed
        } else if (typeof dump !== 'undefined') {
          /* global dump */
          var msg = Array.prototype.map
            .call(arguments, function (x) {
              return x && x.nodeName ? logNode(x) : x;
            })
            .join(' ');
          dump('Reader: (Readability) ' + msg + '\n');
        }
      };
    } else {
      this.log = function () {};
    }
  }

  Readability.prototype = {
    FLAG_STRIP_UNLIKELYS: 0x1,
    FLAG_WEIGHT_CLASSES: 0x2,
    FLAG_CLEAN_CONDITIONALLY: 0x4,

    // https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,

    // Max number of nodes supported by this parser. Default: 0 (no limit)
    DEFAULT_MAX_ELEMS_TO_PARSE: 0,

    // The number of top candidates to consider when analysing how
    // tight the competition is among candidates.
    DEFAULT_N_TOP_CANDIDATES: 5,

    // Element tags to score by default.
    DEFAULT_TAGS_TO_SCORE: 'section,h2,h3,h4,h5,h6,p,td,pre'.toUpperCase().split(','),

    // The default number of chars an article must have in order to return a result
    DEFAULT_CHAR_THRESHOLD: 500,

    // All of the regular expressions in use within readability.
    // Defined up here so we don't instantiate them repeatedly in loops.
    REGEXPS: {
      // NOTE: These two regular expressions are duplicated in
      // Readability-readerable.js. Please keep both copies in sync.
      unlikelyCandidates:
        /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,
      okMaybeItsACandidate: /and|article|body|column|content|main|shadow/i,

      positive:
        /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,
      negative:
        /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|footer|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|widget/i,
      extraneous:
        /print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,
      byline: /byline|author|dateline|writtenby|p-author/i,
      replaceFonts: /<(\/?)font[^>]*>/gi,
      normalize: /\s{2,}/g,
      videos:
        /\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/i,
      shareElements: /(\b|_)(share|sharedaddy)(\b|_)/i,
      nextLink: /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i,
      prevLink: /(prev|earl|old|new|<|«)/i,
      tokenize: /\W+/g,
      whitespace: /^\s*$/,
      hasContent: /\S$/,
      hashUrl: /^#.+/,
      srcsetUrl: /(\S+)(\s+[\d.]+[xw])?(\s*(?:,|$))/g,
      b64DataUrl: /^data:\s*([^\s;,]+)\s*;\s*base64\s*,/i,
      // Commas as used in Latin, Sindhi, Chinese and various other scripts.
      // see: https://en.wikipedia.org/wiki/Comma#Comma_variants
      commas: /\u002C|\u060C|\uFE50|\uFE10|\uFE11|\u2E41|\u2E34|\u2E32|\uFF0C/g,
      // See: https://schema.org/Article
      jsonLdArticleTypes:
        /^Article|AdvertiserContentArticle|NewsArticle|AnalysisNewsArticle|AskPublicNewsArticle|BackgroundNewsArticle|OpinionNewsArticle|ReportageNewsArticle|ReviewNewsArticle|Report|SatiricalArticle|ScholarlyArticle|MedicalScholarlyArticle|SocialMediaPosting|BlogPosting|LiveBlogPosting|DiscussionForumPosting|TechArticle|APIReference$/,
      // used to see if a node's content matches words commonly used for ad blocks or loading indicators
      adWords: /^(ad(vertising|vertisement)?|pub(licité)?|werb(ung)?|广告|Реклама|Anuncio)$/iu,
      loadingWords: /^((loading|正在加载|Загрузка|chargement|cargando)(…|\.\.\.)?)$/iu,
    },

    UNLIKELY_ROLES: [
      'menu',
      'menubar',
      'complementary',
      'navigation',
      'alert',
      'alertdialog',
      'dialog',
    ],

    DIV_TO_P_ELEMS: new Set(['BLOCKQUOTE', 'DL', 'DIV', 'IMG', 'OL', 'P', 'PRE', 'TABLE', 'UL']),

    ALTER_TO_DIV_EXCEPTIONS: ['DIV', 'ARTICLE', 'SECTION', 'P', 'OL', 'UL'],

    PRESENTATIONAL_ATTRIBUTES: [
      'align',
      'background',
      'bgcolor',
      'border',
      'cellpadding',
      'cellspacing',
      'frame',
      'hspace',
      'rules',
      'style',
      'valign',
      'vspace',
    ],

    DEPRECATED_SIZE_ATTRIBUTE_ELEMS: ['TABLE', 'TH', 'TD', 'HR', 'PRE'],

    // The commented out elements qualify as phrasing content but tend to be
    // removed by readability when put into paragraphs, so we ignore them here.
    PHRASING_ELEMS: [
      // "CANVAS", "IFRAME", "SVG", "VIDEO",
      'ABBR',
      'AUDIO',
      'B',
      'BDO',
      'BR',
      'BUTTON',
      'CITE',
      'CODE',
      'DATA',
      'DATALIST',
      'DFN',
      'EM',
      'EMBED',
      'I',
      'IMG',
      'INPUT',
      'KBD',
      'LABEL',
      'MARK',
      'MATH',
      'METER',
      'NOSCRIPT',
      'OBJECT',
      'OUTPUT',
      'PROGRESS',
      'Q',
      'RUBY',
      'SAMP',
      'SCRIPT',
      'SELECT',
      'SMALL',
      'SPAN',
      'STRONG',
      'SUB',
      'SUP',
      'TEXTAREA',
      'TIME',
      'VAR',
      'WBR',
    ],

    // These are the classes that readability sets itself.
    CLASSES_TO_PRESERVE: ['page'],

    // These are the list of HTML entities that need to be escaped.
    HTML_ESCAPE_MAP: {
      lt: '<',
      gt: '>',
      amp: '&',
      quot: '"',
      apos: "'",
    },

    /**
     * Run any post-process modifications to article content as necessary.
     *
     * @param Element
     * @return void
     **/
    _postProcessContent(articleContent) {
      // Readability cannot open relative uris so we convert them to absolute uris.
      this._fixRelativeUris(articleContent);

      this._simplifyNestedElements(articleContent);

      if (!this._keepClasses) {
        // Remove classes.
        this._cleanClasses(articleContent);
      }
    },

    /**
     * Iterates over a NodeList, calls `filterFn` for each node and removes node
     * if function returned `true`.
     *
     * If function is not passed, removes all the nodes in node list.
     *
     * @param NodeList nodeList The nodes to operate on
     * @param Function filterFn the function to use as a filter
     * @return void
     */
    _removeNodes(nodeList, filterFn) {
      // Avoid ever operating on live node lists.
      if (this._docJSDOMParser && nodeList._isLiveNodeList) {
        throw new Error('Do not pass live node lists to _removeNodes');
      }
      for (var i = nodeList.length - 1; i >= 0; i--) {
        var node = nodeList[i];
        var parentNode = node.parentNode;
        if (parentNode) {
          if (!filterFn || filterFn.call(this, node, i, nodeList)) {
            parentNode.removeChild(node);
          }
        }
      }
    },

    /**
     * Iterates over a NodeList, and calls _setNodeTag for each node.
     *
     * @param NodeList nodeList The nodes to operate on
     * @param String newTagName the new tag name to use
     * @return void
     */
    _replaceNodeTags(nodeList, newTagName) {
      // Avoid ever operating on live node lists.
      if (this._docJSDOMParser && nodeList._isLiveNodeList) {
        throw new Error('Do not pass live node lists to _replaceNodeTags');
      }
      for (const node of nodeList) {
        this._setNodeTag(node, newTagName);
      }
    },

    /**
     * Iterate over a NodeList, which doesn't natively fully implement the Array
     * interface.
     *
     * For convenience, the current object context is applied to the provided
     * iterate function.
     *
     * @param  NodeList nodeList The NodeList.
     * @param  Function fn       The iterate function.
     * @return void
     */
    _forEachNode(nodeList, fn) {
      Array.prototype.forEach.call(nodeList, fn, this);
    },

    /**
     * Iterate over a NodeList, and return the first node that passes
     * the supplied test function
     *
     * For convenience, the current object context is applied to the provided
     * test function.
     *
     * @param  NodeList nodeList The NodeList.
     * @param  Function fn       The test function.
     * @return void
     */
    _findNode(nodeList, fn) {
      return Array.prototype.find.call(nodeList, fn, this);
    },

    /**
     * Iterate over a NodeList, return true if any of the provided iterate
     * function calls returns true, false otherwise.
     *
     * For convenience, the current object context is applied to the
     * provided iterate function.
     *
     * @param  NodeList nodeList The NodeList.
     * @param  Function fn       The iterate function.
     * @return Boolean
     */
    _someNode(nodeList, fn) {
      return Array.prototype.some.call(nodeList, fn, this);
    },

    /**
     * Iterate over a NodeList, return true if all of the provided iterate
     * function calls return true, false otherwise.
     *
     * For convenience, the current object context is applied to the
     * provided iterate function.
     *
     * @param  NodeList nodeList The NodeList.
     * @param  Function fn       The iterate function.
     * @return Boolean
     */
    _everyNode(nodeList, fn) {
      return Array.prototype.every.call(nodeList, fn, this);
    },

    _getAllNodesWithTag(node, tagNames) {
      if (node.querySelectorAll) {
        return node.querySelectorAll(tagNames.join(','));
      }
      return [].concat.apply(
        [],
        tagNames.map(function (tag) {
          var collection = node.getElementsByTagName(tag);
          return Array.isArray(collection) ? collection : Array.from(collection);
        }),
      );
    },

    /**
     * Removes the class="" attribute from every element in the given
     * subtree, except those that match CLASSES_TO_PRESERVE and
     * the classesToPreserve array from the options object.
     *
     * @param Element
     * @return void
     */
    _cleanClasses(node) {
      var classesToPreserve = this._classesToPreserve;
      var className = (node.getAttribute('class') || '')
        .split(/\s+/)
        .filter((cls) => classesToPreserve.includes(cls))
        .join(' ');

      if (className) {
        node.setAttribute('class', className);
      } else {
        node.removeAttribute('class');
      }

      for (node = node.firstElementChild; node; node = node.nextElementSibling) {
        this._cleanClasses(node);
      }
    },

    /**
     * Tests whether a string is a URL or not.
     *
     * @param {string} str The string to test
     * @return {boolean} true if str is a URL, false if not
     */
    _isUrl(str) {
      try {
        new URL(str);
        return true;
      } catch {
        return false;
      }
    },
    /**
     * Converts each <a> and <img> uri in the given element to an absolute URI,
     * ignoring #ref URIs.
     *
     * @param Element
     * @return void
     */
    _fixRelativeUris(articleContent) {
      var baseURI = this._doc.baseURI;
      var documentURI = this._doc.documentURI;
      function toAbsoluteURI(uri) {
        // Leave hash links alone if the base URI matches the document URI:
        if (baseURI == documentURI && uri.charAt(0) == '#') {
          return uri;
        }

        // Otherwise, resolve against base URI:
        try {
          return new URL(uri, baseURI).href;
        } catch (ex) {
          // Something went wrong, just return the original:
        }
        return uri;
      }

      var links = this._getAllNodesWithTag(articleContent, ['a']);
      this._forEachNode(links, function (link) {
        var href = link.getAttribute('href');
        if (href) {
          // Remove links with javascript: URIs, since
          // they won't work after scripts have been removed from the page.
          if (href.indexOf('javascript:') === 0) {
            // if the link only contains simple text content, it can be converted to a text node
            if (link.childNodes.length === 1 && link.childNodes[0].nodeType === this.TEXT_NODE) {
              var text = this._doc.createTextNode(link.textContent);
              link.parentNode.replaceChild(text, link);
            } else {
              // if the link has multiple children, they should all be preserved
              var container = this._doc.createElement('span');
              while (link.firstChild) {
                container.appendChild(link.firstChild);
              }
              link.parentNode.replaceChild(container, link);
            }
          } else {
            link.setAttribute('href', toAbsoluteURI(href));
          }
        }
      });

      var medias = this._getAllNodesWithTag(articleContent, [
        'img',
        'picture',
        'figure',
        'video',
        'audio',
        'source',
      ]);

      this._forEachNode(medias, function (media) {
        var src = media.getAttribute('src');
        var poster = media.getAttribute('poster');
        var srcset = media.getAttribute('srcset');

        if (src) {
          media.setAttribute('src', toAbsoluteURI(src));
        }

        if (poster) {
          media.setAttribute('poster', toAbsoluteURI(poster));
        }

        if (srcset) {
          var newSrcset = srcset.replace(this.REGEXPS.srcsetUrl, function (_, p1, p2, p3) {
            return toAbsoluteURI(p1) + (p2 || '') + p3;
          });

          media.setAttribute('srcset', newSrcset);
        }
      });
    },

    _simplifyNestedElements(articleContent) {
      var node = articleContent;

      while (node) {
        if (
          node.parentNode &&
          ['DIV', 'SECTION'].includes(node.tagName) &&
          !(node.id && node.id.startsWith('readability'))
        ) {
          if (this._isElementWithoutContent(node)) {
            node = this._removeAndGetNext(node);
            continue;
          } else if (
            this._hasSingleTagInsideElement(node, 'DIV') ||
            this._hasSingleTagInsideElement(node, 'SECTION')
          ) {
            var child = node.children[0];
            for (var i = 0; i < node.attributes.length; i++) {
              child.setAttributeNode(node.attributes[i].cloneNode());
            }
            node.parentNode.replaceChild(child, node);
            node = child;
            continue;
          }
        }

        node = this._getNextNode(node);
      }
    },

    /**
     * Get the article title as an H1.
     *
     * @return string
     **/
    _getArticleTitle() {
      var doc = this._doc;
      var curTitle = '';
      var origTitle = '';

      try {
        curTitle = origTitle = doc.title.trim();

        // If they had an element with id "title" in their HTML
        if (typeof curTitle !== 'string') {
          curTitle = origTitle = this._getInnerText(doc.getElementsByTagName('title')[0]);
        }
      } catch (e) {
        /* ignore exceptions setting the title. */
      }

      var titleHadHierarchicalSeparators = false;
      function wordCount(str) {
        return str.split(/\s+/).length;
      }

      // If there's a separator in the title, first remove the final part
      if (/ [\|\-\\\/>»] /.test(curTitle)) {
        titleHadHierarchicalSeparators = / [\\\/>»] /.test(curTitle);
        let allSeparators = Array.from(origTitle.matchAll(/ [\|\-\\\/>»] /gi));
        curTitle = origTitle.substring(0, allSeparators.pop().index);

        // If the resulting title is too short, remove the first part instead:
        if (wordCount(curTitle) < 3) {
          curTitle = origTitle.replace(/^[^\|\-\\\/>»]*[\|\-\\\/>»]/gi, '');
        }
      } else if (curTitle.includes(': ')) {
        // Check if we have an heading containing this exact string, so we
        // could assume it's the full title.
        var headings = this._getAllNodesWithTag(doc, ['h1', 'h2']);
        var trimmedTitle = curTitle.trim();
        var match = this._someNode(headings, function (heading) {
          return heading.textContent.trim() === trimmedTitle;
        });

        // If we don't, let's extract the title out of the original title string.
        if (!match) {
          curTitle = origTitle.substring(origTitle.lastIndexOf(':') + 1);

          // If the title is now too short, try the first colon instead:
          if (wordCount(curTitle) < 3) {
            curTitle = origTitle.substring(origTitle.indexOf(':') + 1);
            // But if we have too many words before the colon there's something weird
            // with the titles and the H tags so let's just use the original title instead
          } else if (wordCount(origTitle.substr(0, origTitle.indexOf(':'))) > 5) {
            curTitle = origTitle;
          }
        }
      } else if (curTitle.length > 150 || curTitle.length < 15) {
        var hOnes = doc.getElementsByTagName('h1');

        if (hOnes.length === 1) {
          curTitle = this._getInnerText(hOnes[0]);
        }
      }

      curTitle = curTitle.trim().replace(this.REGEXPS.normalize, ' ');
      // If we now have 4 words or fewer as our title, and either no
      // 'hierarchical' separators (\, /, > or ») were found in the original
      // title or we decreased the number of words by more than 1 word, use
      // the original title.
      var curTitleWordCount = wordCount(curTitle);
      if (
        curTitleWordCount <= 4 &&
        (!titleHadHierarchicalSeparators ||
          curTitleWordCount != wordCount(origTitle.replace(/[\|\-\\\/>»]+/g, '')) - 1)
      ) {
        curTitle = origTitle;
      }

      return curTitle;
    },

    /**
     * Prepare the HTML document for readability to scrape it.
     * This includes things like stripping javascript, CSS, and handling terrible markup.
     *
     * @return void
     **/
    _prepDocument() {
      var doc = this._doc;

      // Remove all style tags in head
      this._removeNodes(this._getAllNodesWithTag(doc, ['style']));

      if (doc.body) {
        this._replaceBrs(doc.body);
      }

      this._replaceNodeTags(this._getAllNodesWithTag(doc, ['font']), 'SPAN');
    },

    /**
     * Finds the next node, starting from the given node, and ignoring
     * whitespace in between. If the given node is an element, the same node is
     * returned.
     */
    _nextNode(node) {
      var next = node;
      while (
        next &&
        next.nodeType != this.ELEMENT_NODE &&
        this.REGEXPS.whitespace.test(next.textContent)
      ) {
        next = next.nextSibling;
      }
      return next;
    },

    /**
     * Replaces 2 or more successive <br> elements with a single <p>.
     * Whitespace between <br> elements are ignored. For example:
     *   <div>foo<br>bar<br> <br><br>abc</div>
     * will become:
     *   <div>foo<br>bar<p>abc</p></div>
     */
    _replaceBrs(elem) {
      this._forEachNode(this._getAllNodesWithTag(elem, ['br']), function (br) {
        var next = br.nextSibling;

        // Whether 2 or more <br> elements have been found and replaced with a
        // <p> block.
        var replaced = false;

        // If we find a <br> chain, remove the <br>s until we hit another node
        // or non-whitespace. This leaves behind the first <br> in the chain
        // (which will be replaced with a <p> later).
        while ((next = this._nextNode(next)) && next.tagName == 'BR') {
          replaced = true;
          var brSibling = next.nextSibling;
          next.remove();
          next = brSibling;
        }

        // If we removed a <br> chain, replace the remaining <br> with a <p>. Add
        // all sibling nodes as children of the <p> until we hit another <br>
        // chain.
        if (replaced) {
          var p = this._doc.createElement('p');
          br.parentNode.replaceChild(p, br);

          next = p.nextSibling;
          while (next) {
            // If we've hit another <br><br>, we're done adding children to this <p>.
            if (next.tagName == 'BR') {
              var nextElem = this._nextNode(next.nextSibling);
              if (nextElem && nextElem.tagName == 'BR') {
                break;
              }
            }

            if (!this._isPhrasingContent(next)) {
              break;
            }

            // Otherwise, make this node a child of the new <p>.
            var sibling = next.nextSibling;
            p.appendChild(next);
            next = sibling;
          }

          while (p.lastChild && this._isWhitespace(p.lastChild)) {
            p.lastChild.remove();
          }

          if (p.parentNode.tagName === 'P') {
            this._setNodeTag(p.parentNode, 'DIV');
          }
        }
      });
    },

    _setNodeTag(node, tag) {
      this.log('_setNodeTag', node, tag);
      if (this._docJSDOMParser) {
        node.localName = tag.toLowerCase();
        node.tagName = tag.toUpperCase();
        return node;
      }

      var replacement = node.ownerDocument.createElement(tag);
      while (node.firstChild) {
        replacement.appendChild(node.firstChild);
      }
      node.parentNode.replaceChild(replacement, node);
      if (node.readability) {
        replacement.readability = node.readability;
      }

      for (var i = 0; i < node.attributes.length; i++) {
        replacement.setAttributeNode(node.attributes[i].cloneNode());
      }
      return replacement;
    },

    /**
     * Prepare the article node for display. Clean out any inline styles,
     * iframes, forms, strip extraneous <p> tags, etc.
     *
     * @param Element
     * @return void
     **/
  };

  if (typeof module === 'object') {
    module.exports = Readability;
  }
  window.__MCP_WEB_FETCHER_READABILITY__ = Readability;
}
