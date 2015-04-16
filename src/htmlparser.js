/*
 * HTML5 Parser
 *
 * Designed for HTML5 documents
 *
 * Original Code from HTML5 Parser By Sam Blowes (https://github.com/blowsie/Pure-JavaScript-HTML5-Parser)
 * Original code by John Resig (ejohn.org)
 * http://ejohn.org/blog/pure-javascript-html-parser/
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * // To get a DocumentFragment. If doctype is defined then it returns a Document.
 * HTMLtoDOM(htmlString);
 */
(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		define(factory.bind(this));
	} else if (typeof exports === 'object') { //nodejs
		module.exports = factory; //Need to pass jsdom window to initialize
	} else {
		root.HTMLtoDOM = factory();
	}
}(this, function (window) {
	//browser and jsdom compatibility
	window = window || this;
	var document = window.document;

	var HTMLParser = (function () {
		// Regular Expressions for parsing tags and attributes
		var startTag = /^<([-\w:]+)((?:\s+[^\s\/>"'=]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
			endTag = /^<\/([-\w:]+)[^>]*>/,
			cdataTag = /^<!\[CDATA\[([\s\S]*?)\]\]>/i,
			attr = /^\s+([^\s\/>"'=]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/;

			// Empty Elements - HTML 5
		var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,link,meta,param,embed,command,keygen,source,track,wbr"),

			// Block Elements - HTML 5
			block = makeMap("address,article,applet,aside,audio,blockquote,button,canvas,center,dd,del,dir,div,dl,dt,fieldset,figcaption,figure,footer,form,frameset,h1,h2,h3,h4,h5,h6,header,hgroup,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,output,p,pre,section,script,table,tbody,td,tfoot,th,thead,tr,ul,video"),

			// Inline Elements - HTML 5
			inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var"),

			// Elements that you can, intentionally, leave open
			// (and which close themselves)
			closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr"),

			// Attributes that have their values filled in disabled="disabled"
			fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected"),

			// Special Elements (can contain anything)
			special = {
				script: /^([\s\S]*?)<\/script[^>]*>/i,
				style: /^([\s\S]*?)<\/style[^>]*>/i
			};

		return function Parser(html, handler) {
			//remove trailing spaces
			html = html.trim();

			var index, chars, match, stack = [], last = html, lastTag;

			var specialReplacer = function (all, text) {
				if (handler.chars)
					handler.chars(text);
				return "";
			};

			while (html) {
				chars = true;

					//Handle script and style tags
				if (special[lastTag]) {
					html = html.replace(special[lastTag], specialReplacer);

					parseEndTag("", lastTag);

					// end tag
				} else if (html.substring(0, 2) === "</") {
					match = html.match(endTag);

					if (match) {
						html = html.substring(match[0].length);
						parseEndTag.apply(this, match);
						chars = false;
					}

					// Comment
				} else if (html.substring(0, 4) === "<!--") {
					index = html.indexOf("-->");

					if (index >= 0) {
						if (handler.comment)
							handler.comment(html.substring(4, index));
						html = html.substring(index + 3);
						chars = false;
					}

					//CDATA
				} else if (html.substring(0, 9).toUpperCase() === '<![CDATA[') {
					match = html.match(cdataTag);

					if (match) {
						if (handler.cdata)
							handler.cdata(match[1]);
						html = html.substring(match[0].length);
						chars = false;
					}

					// doctype
				} else if (html.substring(0, 9).toUpperCase() === '<!DOCTYPE') {
					index = html.indexOf(">");

					if (index >= 0) {
						if (handler.doctype)
							handler.doctype(html.substring(0, index));
						html = html.substring(index + 1);
						chars = false;
					}
					// start tag
				} else if (html[0] === "<") {
					match = html.match(startTag);

					if (match) {
						html = html.substring(match[0].length);
						parseStartTag.apply(this, match);
						chars = false;
					} else { //ignore the angle bracket
						html = html.substring(1);
						if (handler.chars) {
							handler.chars('<');
						}
						chars = false;
					}
				}

				if (chars) {
					index = html.indexOf("<");

					var text = index < 0 ? html : html.substring(0, index);
					html = index < 0 ? "" : html.substring(index);

					if (handler.chars) {
						handler.chars(text);
					}
				}

				if (html === last)
					throw "Parse Error: " + html;
				last = html;
			}

			// Clean up any remaining tags
			parseEndTag();

			function parseStartTag(tag, tagName, rest, unary) {
				var casePreservedTagName = tagName;
				tagName = tagName.toLowerCase();

				if (block[tagName]) {
					while (lastTag && inline[lastTag]) {
						parseEndTag("", lastTag);
					}
				}

				if (closeSelf[tagName] && lastTag === tagName) {
					parseEndTag("", tagName);
				}

				unary = empty[tagName] || !!unary;

				if (!unary) {
					stack.push(tagName);
					lastTag = tagName;
				}

				if (handler.start) {
					var attrs = [], match, name, value;

					while ((match = rest.match(attr))) {
						rest = rest.substr(match[0].length);

						name = match[1];
						value = match[2] || match[3] || match[4] || (fillAttrs[name] ? name : "");

						attrs.push({
							name: name,
							value: value,
							escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
						});
					}

					if (handler.start)
						handler.start(casePreservedTagName, attrs, unary);
				}
			}

			function parseEndTag(tag, tagName) {
				var pos;
				// If no tag name is provided, clean shop
				if (!tagName)
					pos = 0;

					// Find the closest opened tag of the same type
				else
					for (pos = stack.length - 1; pos >= 0; pos -= 1)
						if (stack[pos] === tagName)
							break;

				if (pos >= 0) {
					// Close all the open elements, up the stack
					for (var i = stack.length - 1; i >= pos; i -= 1)
						if (handler.end)
							handler.end(stack[i]);

					// Remove the open elements from the stack
					stack.length = pos;
					lastTag = stack[pos - 1];
				}
			}
		};

	}());

	var HTMLtoDOM = function (html) {
		var doc = document,
			newDoc = doc.createDocumentFragment(),
			// There can be only one of these elements
			one = makeMap("html,head,body,title"),
			// Enforce a structure for the document
			structure = {
				link: "head",
				base: "head"
			},
			elems = [newDoc],
			curParentNode = newDoc;

		HTMLParser(html, {
			start: function (tagName, attrs, unary) {
				var elem = doc.createElement(tagName);
				if (tagName in one) {
					if (one[tagName] !== true) {
						return;
					}
					one[tagName] = elem; //remember important tags
				}

				for (var attr = 0; attr < attrs.length; attr += 1)
					elem.setAttribute(attrs[attr].name, attrs[attr].value);

				if (structure[tagName] && typeof one[structure[tagName]] !== "boolean")
					one[structure[tagName]].appendChild(elem);

				else if (curParentNode && curParentNode.appendChild)
					curParentNode.appendChild(elem);

				if (!unary) {
					elems.push(elem);
					curParentNode = elem;
				}
			},
			end: function () {
				elems.length -= 1;

				// Init the new parentNode
				curParentNode = elems[elems.length - 1];
			},
			chars: function (text) {
				if (newDoc.nodeType === 11 || curParentNode !== newDoc) { //webkit throws error when trying to add text directly to a document.
					curParentNode.appendChild(doc.createTextNode(text));
				}
			},
			comment: function (text) {
				// create comment node
				curParentNode.appendChild(doc.createComment(text));
			},
			doctype: function () {
				if (!newDoc.firstChild) {
					newDoc = doc = document.implementation.createDocument("", "", null); //create empty document

					elems = [newDoc];
					curParentNode = newDoc;

					//Since we support only HTML5 we create HTML5 doctype. This won't work on IE8-.
					newDoc.insertBefore(newDoc.implementation.createDocumentType('html', '', ''), newDoc.firstChild);
				}
			}
		});

		newDoc.normalize();
		return newDoc;
	};

	function makeMap(str) {
		var obj = {}, items = str.split(",");
		for (var i = 0; i < items.length; i += 1)
			obj[items[i]] = true;
		return obj;
	}

	HTMLtoDOM.Parser = HTMLParser;
	return HTMLtoDOM;
}));
