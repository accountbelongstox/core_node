/* eslint-disable */
(() => {
  const Readability = window.__MCP_WEB_FETCHER_READABILITY__;
  if (!Readability) return;
  Object.assign(Readability.prototype, {
    _getJSONLD(doc) {
      var scripts = this._getAllNodesWithTag(doc, ['script']);

      var metadata;

      this._forEachNode(scripts, function (jsonLdElement) {
        if (!metadata && jsonLdElement.getAttribute('type') === 'application/ld+json') {
          try {
            // Strip CDATA markers if present
            var content = jsonLdElement.textContent.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '');
            var parsed = JSON.parse(content);

            if (Array.isArray(parsed)) {
              parsed = parsed.find((it) => {
                return it['@type'] && it['@type'].match(this.REGEXPS.jsonLdArticleTypes);
              });
              if (!parsed) {
                return;
              }
            }

            var schemaDotOrgRegex = /^https?\:\/\/schema\.org\/?$/;
            var matches =
              (typeof parsed['@context'] === 'string' &&
                parsed['@context'].match(schemaDotOrgRegex)) ||
              (typeof parsed['@context'] === 'object' &&
                typeof parsed['@context']['@vocab'] == 'string' &&
                parsed['@context']['@vocab'].match(schemaDotOrgRegex));

            if (!matches) {
              return;
            }

            if (!parsed['@type'] && Array.isArray(parsed['@graph'])) {
              parsed = parsed['@graph'].find((it) => {
                return (it['@type'] || '').match(this.REGEXPS.jsonLdArticleTypes);
              });
            }

            if (
              !parsed ||
              !parsed['@type'] ||
              !parsed['@type'].match(this.REGEXPS.jsonLdArticleTypes)
            ) {
              return;
            }

            metadata = {};

            if (
              typeof parsed.name === 'string' &&
              typeof parsed.headline === 'string' &&
              parsed.name !== parsed.headline
            ) {
              // we have both name and headline element in the JSON-LD. They should both be the same but some websites like aktualne.cz
              // put their own name into "name" and the article title to "headline" which confuses Readability. So we try to check if either
              // "name" or "headline" closely matches the html title, and if so, use that one. If not, then we use "name" by default.

              var title = this._getArticleTitle();
              var nameMatches = this._textSimilarity(parsed.name, title) > 0.75;
              var headlineMatches = this._textSimilarity(parsed.headline, title) > 0.75;

              if (headlineMatches && !nameMatches) {
                metadata.title = parsed.headline;
              } else {
                metadata.title = parsed.name;
              }
            } else if (typeof parsed.name === 'string') {
              metadata.title = parsed.name.trim();
            } else if (typeof parsed.headline === 'string') {
              metadata.title = parsed.headline.trim();
            }
            if (parsed.author) {
              if (typeof parsed.author.name === 'string') {
                metadata.byline = parsed.author.name.trim();
              } else if (
                Array.isArray(parsed.author) &&
                parsed.author[0] &&
                typeof parsed.author[0].name === 'string'
              ) {
                metadata.byline = parsed.author
                  .filter(function (author) {
                    return author && typeof author.name === 'string';
                  })
                  .map(function (author) {
                    return author.name.trim();
                  })
                  .join(', ');
              }
            }
            if (typeof parsed.description === 'string') {
              metadata.excerpt = parsed.description.trim();
            }
            if (parsed.publisher && typeof parsed.publisher.name === 'string') {
              metadata.siteName = parsed.publisher.name.trim();
            }
            if (typeof parsed.datePublished === 'string') {
              metadata.datePublished = parsed.datePublished.trim();
            }
          } catch (err) {
            this.log(err.message);
          }
        }
      });
      return metadata ? metadata : {};
    },

    /**
     * Attempts to get excerpt and byline metadata for the article.
     *
     * @param {Object} jsonld — object containing any metadata that
     * could be extracted from JSON-LD object.
     *
     * @return Object with optional "excerpt" and "byline" properties
     */
    _getArticleMetadata(jsonld) {
      var metadata = {};
      var values = {};
      var metaElements = this._doc.getElementsByTagName('meta');

      // property is a space-separated list of values
      var propertyPattern =
        /\s*(article|dc|dcterm|og|twitter)\s*:\s*(author|creator|description|published_time|title|site_name)\s*/gi;

      // name is a single value
      var namePattern =
        /^\s*(?:(dc|dcterm|og|twitter|parsely|weibo:(article|webpage))\s*[-\.:]\s*)?(author|creator|pub-date|description|title|site_name)\s*$/i;

      // Find description tags.
      this._forEachNode(metaElements, function (element) {
        var elementName = element.getAttribute('name');
        var elementProperty = element.getAttribute('property');
        var content = element.getAttribute('content');
        if (!content) {
          return;
        }
        var matches = null;
        var name = null;

        if (elementProperty) {
          matches = elementProperty.match(propertyPattern);
          if (matches) {
            // Convert to lowercase, and remove any whitespace
            // so we can match below.
            name = matches[0].toLowerCase().replace(/\s/g, '');
            // multiple authors
            values[name] = content.trim();
          }
        }
        if (!matches && elementName && namePattern.test(elementName)) {
          name = elementName;
          if (content) {
            // Convert to lowercase, remove any whitespace, and convert dots
            // to colons so we can match below.
            name = name.toLowerCase().replace(/\s/g, '').replace(/\./g, ':');
            values[name] = content.trim();
          }
        }
      });

      // get title
      metadata.title =
        jsonld.title ||
        values['dc:title'] ||
        values['dcterm:title'] ||
        values['og:title'] ||
        values['weibo:article:title'] ||
        values['weibo:webpage:title'] ||
        values.title ||
        values['twitter:title'] ||
        values['parsely-title'];

      if (!metadata.title) {
        metadata.title = this._getArticleTitle();
      }

      const articleAuthor =
        typeof values['article:author'] === 'string' && !this._isUrl(values['article:author'])
          ? values['article:author']
          : undefined;

      // get author
      metadata.byline =
        jsonld.byline ||
        values['dc:creator'] ||
        values['dcterm:creator'] ||
        values.author ||
        values['parsely-author'] ||
        articleAuthor;

      // get description
      metadata.excerpt =
        jsonld.excerpt ||
        values['dc:description'] ||
        values['dcterm:description'] ||
        values['og:description'] ||
        values['weibo:article:description'] ||
        values['weibo:webpage:description'] ||
        values.description ||
        values['twitter:description'];

      // get site name
      metadata.siteName = jsonld.siteName || values['og:site_name'];

      // get article published time
      metadata.publishedTime =
        jsonld.datePublished ||
        values['article:published_time'] ||
        values['parsely-pub-date'] ||
        null;

      // in many sites the meta value is escaped with HTML entities,
      // so here we need to unescape it
      metadata.title = this._unescapeHtmlEntities(metadata.title);
      metadata.byline = this._unescapeHtmlEntities(metadata.byline);
      metadata.excerpt = this._unescapeHtmlEntities(metadata.excerpt);
      metadata.siteName = this._unescapeHtmlEntities(metadata.siteName);
      metadata.publishedTime = this._unescapeHtmlEntities(metadata.publishedTime);

      return metadata;
    },

    /**
     * Check if node is image, or if node contains exactly only one image
     * whether as a direct child or as its descendants.
     *
     * @param Element
     **/
    _isSingleImage(node) {
      while (node) {
        if (node.tagName === 'IMG') {
          return true;
        }
        if (node.children.length !== 1 || node.textContent.trim() !== '') {
          return false;
        }
        node = node.children[0];
      }
      return false;
    },

    /**
     * Find all <noscript> that are located after <img> nodes, and which contain only one
     * <img> element. Replace the first image with the image from inside the <noscript> tag,
     * and remove the <noscript> tag. This improves the quality of the images we use on
     * some sites (e.g. Medium).
     *
     * @param Element
     **/
  });
})();
