/*global module, require, define*/
/*jslint evil: true*/

/**
 * Html Templating.
 * The MIT License (MIT)
 * Copyright (c) 2014 Munawwar
 */
(function (root, factory, saferEval) {
    if (typeof exports === 'object') {
        var jsdom = require('jsdom').jsdom,
            window = jsdom('').parentWindow;
        module.exports = factory(
            saferEval,
            require('./jquery')(window),
            require('./js-object-literal-parse.js'),
            window
        );
    } else if (typeof define === 'function' && define.amd) {
        define(['jquery', './js-object-literal-parse'], factory.bind(this, saferEval));
    } else {
        root.Htmlizer = factory(saferEval, root.jQuery, root.parseObjectLiteral);
    }
}(this, function (saferEval, $, parseObjectLiteral, window) {
    //browser and jsdom compatibility
    window = window || this;
    var document = window.document;

    function unwrap(str) {
        var o = {};
        str.split(',').forEach(function (val) {
            o[val] = true;
        });
        return o;
    }

    function replaceJsCssPropWithCssProp(m) {
        return '-' + m.toLowerCase();
    }

    //HTML 4 and 5 void tags
    var voidTags = unwrap('area,base,basefont,br,col,command,embed,frame,hr,img,input,keygen,link,meta,param,source,track,wbr');

    //Valid statements.
    var syntaxRegex = {
        "if": new RegExp("((?:ko|hz)[ ]+if):(.+)"),
        "ifnot": new RegExp("((?:ko|hz)[ ]+ifnot):(.+)"),
        "foreach": new RegExp("((?:ko|hz)[ ]+foreach):(.+)"),
        "with": new RegExp("((?:ko|hz)[ ]+with):(.+)"),
        "text": new RegExp("((?:ko|hz)[ ]+text):(.+)"),
        "html": new RegExp("((?:ko|hz)[ ]+html):(.+)")
    };

    var conflictingBindings = unwrap('if,ifnot,foreach,text,html');

    /**
     * @param {String|DocumentFragment} template If string, then it is better if the HTML is balanced, else it probably won't be correctly converted to DOM.
     * @param {Object} cfg
     * @param {Document} cfg.document Only used in NodeJS to make the 'template' binding work. If template isn't a complete document,
     *  then provide a HTMLDocument that contains script tags that the 'template' binding can use.
     * @param {Object} cfg.noConflict Will ensure Htmlizer doesn't conflict with KnockoutJS. i.e data-htmlizer attribute will be used and
     * containerless statements beginning and ending with "ko" prefix will be ignored.
     */
    function Htmlizer(template, cfg) {
        this.cfg = cfg;
        $.extend(this, cfg);
        if (typeof template === 'string') {
            this.origTplStr = template;
            this.frag = this.moveToNewFragment(this.parseHTML(template));
        } else { //assuming DocumentFragment
            this.frag = template;
        }
    }

    Htmlizer.prototype = {
        document: null,
        /**
         * @param {Object} data
         */
        toDocumentFragment: function (data, context) {
            var frag = this.frag.cloneNode(true);
            if (!context) {
                context = {
                    $parents: [],
                    $root: data,
                    $data: data,
                    $rawData: data
                };
            }

            var stack = [], //Keep track of ifs and fors
                blocks = [],
                block;

            //Before evaluating, determine the nesting structure for containerless statements.
            traverse(frag, frag, function (node, isOpenTag) {
                if (isOpenTag && node.nodeType === 8) {
                    var stmt = node.data.trim(), match;

                    //Ignore all containerless statements beginning with "ko" if noConflict = true.
                    if (this.noConflict && (/^(ko |\/ko$)/).test(stmt)) {
                        return;
                    }

                    //Convert ifnot: (...) to if: !(...)
                    if ((match = stmt.match(syntaxRegex.ifnot))) {
                        stmt = match[1].replace('ifnot', 'if') + ': !(' + match[2] + ')';
                    }

                    //Process if statement
                    if ((match = stmt.match(syntaxRegex['if']))) {
                        stack.unshift({
                            key: 'if',
                            start: node
                        });
                    } else if ((match = stmt.match(syntaxRegex.foreach))) {
                        stack.unshift({
                            key: 'foreach',
                            start: node
                        });
                    } else if ((match = stmt.match(syntaxRegex['with']))) {
                        stack.unshift({
                            key: 'with',
                            start: node
                        });
                    } else if ((match = stmt.match(syntaxRegex.text))) {
                        stack.unshift({
                            key: 'text',
                            start: node
                        });
                    } else if ((match = stmt.match(syntaxRegex.html))) {
                        stack.unshift({
                            key: 'html',
                            start: node
                        });
                    } else if ((match = stmt.match(/^\/(ko|hz)$/))) {
                        block = stack.shift();
                        if (block) {
                            block.end = node;
                            blocks.push(block);
                        } else {
                            console.warn('Extra end tag found.');
                        }
                    }
                }
            }, this);
            if (stack.length) {
                throw new Error('Missing end tag for ' + stack[0].start.data.trim());
            }

            //Evaluate
            var toRemove = [], //use this to remove nodes within if statement that are false.
                blockNodes;
            traverse(frag, frag, function (node, isOpenTag) {
                if (isOpenTag) {
                    var val, match, tempFrag, inner;
                    if (node.nodeType === 1) { //element
                        var bindOpts = node.getAttribute(this.noConflict ? 'data-htmlizer' : 'data-bind');

                        if (bindOpts) {
                            node.removeAttribute(this.noConflict ? 'data-htmlizer' : 'data-bind');
                            var conflict = [];
                            this.forEachObjectLiteral(bindOpts, function (binding) {
                                if (binding in conflictingBindings) {
                                    conflict.push(binding);
                                }
                            });
                            if (conflict.length > 1) {
                                throw new Error('Multiple bindings (' + conflict[0] + ' and ' + conflict[1] + ') are trying to control descendant bindings of the same element.' +
                                    'You cannot use these bindings together on the same element.');
                            }
                        }

                        var ret;
                        this.forEachObjectLiteral(bindOpts, function (binding, value) {
                            //Convert ifnot: (...) to if: !(...)
                            if (binding === 'ifnot') {
                                value = '!(' + value + ')';
                            }

                            //First evaluate if
                            if (binding === 'if') {
                                val = saferEval(value, context, data, node);
                                if (!val) {
                                    toRemove = toRemove.concat(this.slice(node.childNodes));
                                    ret = 'continue';
                                    return true;
                                }
                            }

                            if (binding === 'foreach') {
                                if (value[0] === '{') {
                                    inner = this.parseObjectLiteral(value);
                                    val = {
                                        items: saferEval(inner.data, context, data, node),
                                        as: inner.as.slice(1, -1) //strip string quote
                                    };
                                } else {
                                    val = {items: saferEval(value, context, data, node)};
                                }
                                tempFrag = this.moveToNewFragment(this.slice(node.childNodes));
                                if (tempFrag.firstChild && val.items instanceof Array) {
                                    tempFrag = this.executeForEach(tempFrag, context, data, val.items, val.as);
                                    node.appendChild(tempFrag);
                                }
                            }

                            if (binding === 'with') {
                                val = saferEval(value, context, data, node);

                                tempFrag = this.moveToNewFragment(this.slice(node.childNodes));
                                if (tempFrag.firstChild && val !== null && val !== undefined) {
                                    node.appendChild(this.executeInNewContext(tempFrag, context, val));
                                }
                            }

                            if (binding === 'text') {
                                val = saferEval(value, context, data, node);
                                node.innerHTML = ''; //KO nukes the inner content.
                                if (val === null || val === undefined) {
                                    val = '';
                                }
                                node.appendChild(document.createTextNode(val));
                            }

                            if (binding === 'html') {
                                $(node).empty();
                                val = saferEval(value, context, data, node);
                                if (val !== undefined && val !== null && val !== '') {
                                    var nodes = this.parseHTML(val + '');
                                    if (nodes) {
                                        tempFrag = this.moveToNewFragment(nodes);
                                        node.appendChild(tempFrag);
                                    }
                                }
                            }

                            if (binding === 'template') {
                                $(node).empty();
                                inner = this.parseObjectLiteral(value);
                                val = {
                                    name: inner.name.slice(1, -1),
                                    data: saferEval(inner.data, context, data, node),
                                    if: inner['if'] ? saferEval(inner['if'], context, data, node) : true,
                                    foreach: saferEval(inner.foreach, context, data, node),
                                    as: (inner.as || '').slice(1, -1) //strip string quote
                                };

                                var doc = this.document || document,
                                    tpl = doc.querySelector('script[id="' + val.name + '"]');
                                if (!tpl) {
                                    throw new Error("Template named '" + val.name + "' does not exist.");
                                }
                                tpl = this.moveToNewFragment(this.parseHTML(tpl.textContent));

                                if (val['if'] && tpl.firstChild) {
                                    if (val.data || !(val.foreach instanceof Array)) {
                                        tempFrag = this.executeInNewContext(tpl, context, val.data || data);
                                    } else {
                                        tempFrag = this.executeForEach(tpl, context, data, val.foreach, val.as);
                                    }
                                    node.appendChild(tempFrag);
                                }
                            }

                            if (binding === 'attr') {
                                this.forEachObjectLiteral(value.slice(1, -1), function (attr, value) {
                                    val = saferEval(value, context, data, node);
                                    if (val || typeof val === 'string' || typeof val === 'number') {
                                        node.setAttribute(attr, val);
                                    } else { //undefined, null, false
                                        node.removeAttribute(attr);
                                    }
                                });
                            }

                            if (binding === 'css') {
                                if (value[0] === '{') {
                                   this.forEachObjectLiteral(value.slice(1, -1), function (className, expr) {

                                       val = saferEval(expr, context, data, node);
                                       if (val) {
                                           $(node).addClass(className);
                                       } else {
                                           $(node).removeClass(className);
                                       }
                                   });
                               } else {
                                   var className = saferEval(value, context, data, node);
                                   if (className) {
                                       $(node).addClass(className);
                                   }
                               }
                            }

                            if (binding === 'style') {
                                this.forEachObjectLiteral(value.slice(1, -1), function (prop, value) {
                                    val = saferEval(value, context, data, node) || null;
                                    if (val || typeof val === 'string' || typeof val === 'number') {
                                        node.style.setProperty(prop.replace(/[A-Z]/g, replaceJsCssPropWithCssProp), val);
                                    } else { //undefined, null, false
                                        node.style.removeProperty(prop.replace(/[A-Z]/g, replaceJsCssPropWithCssProp));
                                    }
                                });
                            }

                            //Some of the following aren't treated as attributes by Knockout, but this is here to keep compatibility with Knockout.

                            if (binding === 'disable' || binding === 'enable') {
                                val = saferEval(value, context, data, node);
                                var disable = (binding === 'disable' ? val : !val);
                                if (disable) {
                                    node.setAttribute('disabled', 'disabled');
                                } else {
                                    node.removeAttribute('disabled');
                                }
                            }

                            if (binding === 'checked') {
                                val = saferEval(value, context, data, node);
                                if (val) {
                                    node.setAttribute('checked', 'checked');
                                } else {
                                    node.removeAttribute('checked');
                                }
                            }

                            if (binding === 'value') {
                                val = saferEval(value, context, data, node);
                                if (val === null || val === undefined) {
                                    node.removeAttribute('value');
                                } else {
                                    node.setAttribute('value', val);
                                }
                            }

                            if (binding === 'visible') {
                                val = saferEval(value, context, data, node);
                                if (val) {
                                    if (node.style.display === 'none') {
                                        node.style.removeProperty('display');
                                    }
                                } else {
                                    node.style.setProperty('display', 'none');
                                }
                            }

                            if (this.noConflict && binding === 'data-bind') {
                                node.setAttribute('data-bind', value);
                            }
                        }, this);
                        if (ret) {
                            return ret;
                        }
                    }

                    //HTML comment node
                    if (node.nodeType === 8) {
                        var stmt = node.data.trim();

                        //Ignore all containerless statements beginning with "ko" if noConflict = true.
                        if (this.noConflict && (/^(ko |\/ko$)/).test(stmt)) {
                            return;
                        }

                        //Convert ifnot: (...) to if: !(...)
                        if ((match = stmt.match(syntaxRegex.ifnot))) {
                            stmt = match[1].replace('ifnot', 'if') + ': !(' + match[2] + ')';
                        }

                        //Process if statement
                        if ((match = stmt.match(syntaxRegex['if']))) {
                            val = saferEval(match[2], context, data, node);

                            block = this.findBlockFromStartNode(blocks, node);
                            toRemove.push(node);
                            toRemove.push(block.end);

                            if (!val) {
                                blockNodes = this.getImmediateNodes(frag, block.start, block.end);
                                tempFrag = this.moveToNewFragment(blockNodes); //move to new DocumentFragment and discard
                            }
                        } else if ((match = stmt.match(syntaxRegex.foreach))) {
                            inner = match[2].trim();
                            if (inner[0] === '{') {
                                inner = this.parseObjectLiteral(inner);
                                val = {
                                    items: saferEval(inner.data, context, data, node),
                                    as: inner.as.slice(1, -1) //strip string quote
                                };
                            } else {
                                val = {items: saferEval(inner, context, data, node)};
                            }

                            //Create a new htmlizer instance, render it and insert berfore this node.
                            block = this.findBlockFromStartNode(blocks, node);
                            blockNodes = this.getImmediateNodes(frag, block.start, block.end);
                            tempFrag = this.moveToNewFragment(blockNodes);

                            toRemove.push(node);
                            toRemove.push(block.end);

                            if (tempFrag.firstChild && val.items instanceof Array) {
                                tempFrag = this.executeForEach(tempFrag, context, data, val.items, val.as);
                                node.parentNode.insertBefore(tempFrag, node);
                            }
                        } else if ((match = stmt.match(syntaxRegex['with']))) {
                            val = saferEval(match[2], context, data, node);

                            block = this.findBlockFromStartNode(blocks, node);
                            blockNodes = this.getImmediateNodes(frag, block.start, block.end);
                            tempFrag = this.moveToNewFragment(blockNodes);

                            toRemove.push(node);
                            toRemove.push(block.end);

                            if (tempFrag.firstChild && val !== null && val !== undefined) {
                                node.parentNode.insertBefore(this.executeInNewContext(tempFrag, context, val), node);
                            }
                        } else if ((match = stmt.match(syntaxRegex.text))) {
                            val = saferEval(match[2], context, data, node);

                            block = this.findBlockFromStartNode(blocks, node);
                            blockNodes = this.getImmediateNodes(frag, block.start, block.end);
                            tempFrag = this.moveToNewFragment(blockNodes); //move to new DocumentFragment and discard

                            toRemove.push(node);
                            toRemove.push(block.end);

                            if (val !== null && val !== undefined) {
                                node.parentNode.insertBefore(document.createTextNode(val), node);
                            }
                        } else if ((match = stmt.match(syntaxRegex.html))) {
                            val = saferEval(match[2], context, data, node);

                            block = this.findBlockFromStartNode(blocks, node);
                            blockNodes = this.getImmediateNodes(frag, block.start, block.end);
                            tempFrag = this.moveToNewFragment(blockNodes); //move to new DocumentFragment and discard

                            toRemove.push(node);
                            toRemove.push(block.end);

                            if (val !== null && val !== undefined) {
                                node.parentNode.insertBefore(this.moveToNewFragment(this.parseHTML(val)), node);
                            }
                        }
                    }
                }
            }, this);

            //If statements could mark some elements to be removed.
            if (toRemove.length) {
                toRemove.forEach(function (node) {
                    node.parentNode.removeChild(node);
                });
            }

            return frag;
        },

        toString: function (data) {
            var frag = this.toDocumentFragment(data), html = '';
            traverse(frag, frag, function (node, isOpenTag) {
                if (node.nodeType === 1) {
                    var tag = node.nodeName.toLowerCase();
                    if (isOpenTag) {
                        html += '<' + tag;
                        this.slice(node.attributes).forEach(function (attr) {
                            html += ' ' + attr.name + '="' + attr.value.replace(/"/g, '&quot;') + '"';
                        });
                        html += (voidTags[tag] ? '/>' : '>');
                    } else if (!voidTags[tag]) {
                        html += '</' + tag + '>';
                    }
                }
                if (isOpenTag && node.nodeType === 3) {
                    var text = node.nodeValue || '';
                    //escape <,> and &. Except text node inside script or style tag.
                    if (!(/^(?:script|style)$/i).test(node.parentNode.nodeName)) {
                        text = text.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;");
                    }
                    html += text;
                }
                if (isOpenTag && node.nodeType === 8) {
                    html += '<!-- ' + node.data.trim() + ' -->';
                }
            }, this);
            return html;
        },

        /**
         * @private
         * @param {DocumentFragment} fragment Document fragment that contains the template to use
         * @param {Object} context
         * @param {Object} data Data object
         */
        executeInNewContext: function (fragment, context, data) {
            var template = new Htmlizer(fragment, this.cfg),
                newContext = this.getNewContext(context, data);
            return template.toDocumentFragment(data, newContext);
        },

        /**
         * @private
         * @param {DocumentFragment} fragment Document fragment that contains the body of the foreach statement
         * @param {Object} context
         * @param {Object} data Data object
         * @param {Array} items The array to iterate through
         */
        executeForEach: function (fragment, context, data, items, as) {
            var output = document.createDocumentFragment(),
                template = new Htmlizer(fragment, this.cfg);
            items.forEach(function (item, index) {
                var newContext = this.getNewContext(context, data);
                //foreach special properties
                newContext.$data = newContext.$rawData = item;
                newContext.$index = index;

                if (as) {
                    newContext[as] = item;
                    //Add to _as so that sub templates can access them.
                    newContext._as = newContext._as || [];
                    newContext._as.push([as, item]);
                }

                //..finally execute
                output.appendChild(template.toDocumentFragment(item, newContext));
            }, this);
            return output;
        },

        /**
         * @private
         */
        getNewContext: function (parentContext, data) {
            var newContext = {
                $root: parentContext.$root,
                $parent: parentContext.$data,
                $parentContext: parentContext,
                $parents: ([data]).concat(parentContext.$parents),
                $data: data,
                $rawData: data
            };

            //Copy 'as' references from parent. This is done recursively, so it will have all the 'as' references from ancestors.
            if (parentContext._as) {
                newContext._as = parentContext._as.slice();
                newContext._as.forEach(function (tuple) {
                    newContext[tuple[0]] = tuple[1];
                });
            }
            return newContext;
        },

        /**
         * Parse html string using jQuery.parseHTML and also make sure script tags aren't removed.
         * @param {String} html
         * @private
         */
        parseHTML: function (html) {
            return $.parseHTML(html, document, true);
        },

        /**
         * @private
         * @param {Array[Node]} nodes
         */
        moveToNewFragment: function (nodes) {
            var frag = document.createDocumentFragment();
            nodes.forEach(function (n) {
                frag.appendChild(n);
            });
            return frag;
        },

        /**
         * @private
         */
        slice: function (arrlike, index) {
            return Array.prototype.slice.call(arrlike, index);
        },

        /**
         * @private
         */
        parseObjectLiteral: function (objectLiteral) {
            var obj = {},
                tuples = parseObjectLiteral(objectLiteral);
            tuples.forEach(function (tuple) {
                obj[tuple[0]] = tuple[1];
            });
            return obj;
        },

        /**
         * Will stop iterating if callback returns true.
         * @private
         */
        forEachObjectLiteral: function (objectLiteral, callback, scope) {
            if (objectLiteral) {
                parseObjectLiteral(objectLiteral).some(function (tuple) {
                    return (callback.call(scope, tuple[0], tuple[1]) === true);
                });
            }
        },

        /**
         * @private
         * Get all immediate nodes between two given nodes.
         */
        getImmediateNodes: function (frag, startNode, endNode) {
            var nodes = [];
            traverse(startNode, frag, function (node, isOpenTag) {
                if (isOpenTag) {
                    if (node === endNode) {
                        return 'halt';
                    }
                    nodes.push(node);
                    return 'continue';
                }
            });
            return nodes;
        },

        /**
         * @private
         */
        findBlockFromStartNode: function (blocks, node) {
            return blocks.filter(function (block) {
                return block.start === node;
            })[0] || null;
        }
    };

    /**
     * Given a DOM node, this method finds the next tag/node that would appear in the dom.
     * WARNING: Do not remove or add nodes while traversing, because it could cause the traversal logic to go crazy.
     * @param node Could be a any node (element node or text node)
     * @param ancestor Node An ancestorial element that can be used to limit the search.
     * The search algorithm, while traversing the ancestorial heirarcy, will not go past/above this element.
     * @param {function} callback A callback called on each element traversed.
     *
     * callback gets following parameters:
     * node: Current node being traversed.
     * isOpenTag: boolean. On true, node would be the next open tag/node that one would find when going
     * linearly downwards through the DOM. Filtering with isOpenTag=true, one would get exactly what native TreeWalker does.
     * Similarly isOpenTag=false when a close tag is encountered when traversing the DOM. AFAIK TreeWalker doesn't give this info.
     *
     * callback can return one of the following values (with their meanings):
     * 'halt': Stops immediately and returns null.
     * 'return': Halts and returns node.
     * 'continue': Skips further traversal of current node (i.e won't traverse it's child nodes).
     * 'break': Skips all sibling elements of current node and goes to it's parent node.
     *
     * relation: The relation compared to the previously traversed node.
     * @param {Object} [scope] Value of 'this' keyword within callback
     * @private
     */
    function traverse(node, ancestor, callback, scope) {
        //if node = ancestor, we still can traverse it's child nodes
        if (!node) {
            return null;
        }
        var isOpenTag = true, ret = null;
        do {
            if (ret === 'halt') {
                return null;
            }
            if (isOpenTag && node.firstChild && !ret) {
                node = node.firstChild;
                //isOpenTag = true;
                ret = callback.call(scope, node, true, 'firstChild');
            } else if (node.nextSibling && node !== ancestor && ret !== 'break') {
                if (isOpenTag) {
                    callback.call(scope, node, false, 'current');
                }
                node = node.nextSibling;
                isOpenTag = true;
                ret = callback.call(scope, node, true, 'nextSibling');
            } else if (node.parentNode && node !== ancestor) {
                if (isOpenTag) {
                    callback.call(scope, node, false, 'current');
                }
                //Traverse up the dom till you find an element with nextSibling
                node = node.parentNode;
                isOpenTag = false;
                ret = callback.call(scope, node, false, 'parentNode');
            } else {
                node = null;
            }
        } while (node && ret !== 'return');
        return node || null;
    }

    return Htmlizer;
}, function () {
    //Templates could be attempting to reference undefined variables. Hence try catch is required.
    if (arguments.length === 4) {
        try {
            return (new Function('$context', '$data', '$element', 'with($context){with($data){return ' + arguments[0] + '}}'))(arguments[1] || {}, arguments[2] || {}, arguments[3]);
        } catch (e) {}
    } else {
        throw new Error('Expression evaluator needs at least 4 arguments.');
    }
}));
