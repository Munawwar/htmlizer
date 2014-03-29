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
            require('./jquery')(window),
            require('./js-object-literal-parse.js'),
            saferEval,
            window
        );
    } else if (typeof define === 'function' && define.amd) {
        define(['jquery', './js-object-literal-parse'], factory, saferEval);
    } else {
        root.Htmlizer = factory(root.jQuery, root.parseObjectLiteral, saferEval);
    }
}(this, function ($, parseObjectLiteral, saferEval, window) {
    //browser and jsdom compatibility
    window = window || this;
    var document = window.document;

    function unwrap(str) {
        var arr = str.split(','), val, o = {};
        while ((val = arr.pop())) {
            o[val] = true;
        }
        return o;
    }

    function replaceJsCssPropWithCssProp(m) {
        return '-' + m.toLowerCase();
    }

    //HTML 4 and 5 void tags
    var voidTags = unwrap('area,base,basefont,br,col,command,embed,frame,hr,img,input,keygen,link,meta,param,source,track,wbr'),
        regexString = {
            JSVar: "[$_A-Za-z][$_A-Za-z0-9]*"
        };
    regexString.DotNotation = '(' + regexString.JSVar + '(?:\\.' + regexString.JSVar + ')*)';

    var regexMap = {
        DotNotation: new RegExp(regexString.DotNotation)
    };

    //Valid statements.
    var syntaxRegex = {
        "if": new RegExp("(?:(ko[ ]+if|if):(.+))"),
        "ifnot": new RegExp("(?:(ko[ ]+ifnot|ifnot):(.+))"),
        foreach: new RegExp("(?:(ko[ ]+foreach|foreach):(.+))")
    };

    /**
     * @param {String|DocumentFragment} template If string, then it is better if the HTML is balanced, else it probably won't be correctly converted to DOM.
     */
    function Htmlizer(template) {
        if (typeof template === 'string') {
            this.frag = document.createDocumentFragment();
            $.parseHTML(template).forEach(function (node) {
                this.frag.appendChild(node);
            }, this);
        } else { //assuming DocumentFragment
            this.frag = template;
        }
    }

    Htmlizer.prototype = {
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
                block = [],
                foreachOpen = false,
                blockNestingCount = 0,
                toRemove = []; //use this to remove nodes within if statement that are false.
            traverse(frag, frag, function (node, isOpenTag) {
                if (isOpenTag) {
                    if (stack[0] && stack[0].key === 'if' && !stack[0].val) {
                        toRemove.push(node);
                        return 'continue';
                    }
                    if (foreachOpen) {
                        block.push(node);
                    }

                    var val, match, tempFrag, inner;
                    if (node.nodeType === 1 && !foreachOpen) { //element
                        var bindOpts = node.getAttribute('data-bind'), attributes;
                        if (bindOpts) {
                            node.removeAttribute('data-bind');
                            var bindings = this.parseObjectLiteral(bindOpts),
                                descendantBindings = (bindings['if'] ? 1 : 0) + (bindings.ifnot ? 1 : 0) + (bindings.foreach ? 1 : 0) +
                                    (bindings.text ? 1 : 0) + (bindings.html ? 1 : 0);

                            if (descendantBindings > 1) {
                                throw new Error('Multiple bindings (if,ifnot,foreach,text and/or html) are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.');
                            }

                            //Convert ifnot: (...) to if: !(...)
                            if (bindings.ifnot) {
                                bindings['if'] = '!(' + bindings.ifnot + ')';
                            }

                            //First evaluate if
                            if (bindings['if']) {
                                val = saferEval(bindings['if'], context, data, node);
                                if (!val) {
                                    toRemove = toRemove.concat(this.slice(node.childNodes));
                                    return 'continue';
                                }
                                return;
                            }

                            if (bindings.foreach) {
                                inner = bindings.foreach;
                                if (inner[0] === '{') {
                                    inner = this.parseObjectLiteral(inner);
                                    val = {
                                        items: saferEval(inner.data, context, data, node),
                                        as: inner.as.slice(1, -1) //strip string quote
                                    };
                                } else {
                                    val = {items: saferEval(inner, context, data, node)};
                                }
                                tempFrag = document.createDocumentFragment();
                                this.slice(node.childNodes).forEach(function (n) {
                                    n.parentNode.removeChild(n);
                                    tempFrag.appendChild(n);
                                });
                                if (tempFrag.firstChild && val.items instanceof Array) {
                                    tempFrag = this.executeForEach(tempFrag, context, data, val.items, val.as);
                                    node.appendChild(tempFrag);
                                }
                                return;
                            }

                            if (bindings.text && regexMap.DotNotation.test(bindings.text)) {
                                val = saferEval(bindings.text, context, data, node);
                                if (val !== undefined) {
                                    node.appendChild(document.createTextNode(val));
                                }
                            }

                            if (bindings.html) {
                                $(node).empty();
                                val = saferEval(bindings.html, context, data, node);
                                if (val) {
                                    tempFrag = document.createDocumentFragment();
                                    $.parseHTML(val).forEach(function (node) {
                                        tempFrag.appendChild(node);
                                    }, this);
                                    node.appendChild(tempFrag);
                                }
                                return;
                            }

                            if (bindings.attr) {
                                attributes = parseObjectLiteral(bindings.attr.slice(1, -1));
                                attributes.forEach(function (tuple) {
                                    if (regexMap.DotNotation.test(tuple[1])) {
                                        val = saferEval(tuple[1], context, data, node);
                                        if (val) {
                                            node.setAttribute(tuple[0], val);
                                        }
                                    }
                                });
                            }

                            if (bindings.css) {
                                var cssProps = parseObjectLiteral(bindings.css.slice(1, -1));
                                cssProps.forEach(function (tuple) {
                                    val = saferEval(tuple[1], context, data, node);
                                    if (val) {
                                        $(node).addClass(tuple[0]);
                                    }
                                });
                            }

                            if (bindings.style) {
                                var styleProps = parseObjectLiteral(bindings.style.slice(1, -1));
                                styleProps.forEach(function (tuple) {
                                    val = saferEval(tuple[1], context, data, node) || null;
                                    node.style.setProperty(tuple[0].replace(/[A-Z]/g, replaceJsCssPropWithCssProp), val);
                                });
                            }
                        }
                    } else if (node.nodeType === 1 && foreachOpen) {
                        return 'continue';
                    }

                    //HTML comment node
                    if (node.nodeType === 8) {
                        var stmt = node.data.trim();

                        //Convert ifnot: (...) to if: !(...)
                        if ((/^((ko[ ]+ifnot)|ifnot):/).test(stmt) && (match = stmt.match(syntaxRegex.ifnot))) {
                            stmt = match[1] + ': !(' + match[2] + ')';
                        }
                        //Convert /ifnot to /if
                        if ((match = stmt.match(/^\/(ifnot)/))) {
                            stmt = '/if';
                        }

                        //Process if statement
                        if ((/^((ko[ ]+if)|if):/).test(stmt) && (match = stmt.match(syntaxRegex['if']))) {
                            if (!foreachOpen) {
                                val = saferEval(match[2], context, data, node);
                                stack.unshift({
                                    key: 'if',
                                    val: val
                                });
                                toRemove.push(node);
                            } else {
                                //no need to evaluate this if foreachOpen, because it is added to
                                //'blocks' and will be evaluated later
                                blockNestingCount += 1;
                            }
                        } else if ((/^((ko[ ]+foreach)|foreach):/).test(stmt) && (match = stmt.match(syntaxRegex.foreach))) {
                            if (!foreachOpen) {
                                foreachOpen = true;
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
                                stack.unshift({
                                    key: 'foreach',
                                    val: val
                                });
                                toRemove.push(node);
                            } else {
                                blockNestingCount += 1;
                            }
                        } else if ((match = stmt.match(/^\/(ko|if|foreach)/))) {
                            //TODO: Check for unbalanced ifs/fors
                            if ((/^\/(ko|foreach)/).test(stmt) && stack[0] &&
                                stack[0].key === 'foreach' && blockNestingCount === 0) {
                                foreachOpen = false;

                                tempFrag = document.createDocumentFragment();
                                block.pop(); //remove end tag from block
                                block.forEach(function (n) {
                                    n.parentNode.removeChild(n);
                                    tempFrag.appendChild(n);
                                });
                                block = [];

                                if (tempFrag.firstChild && stack[0].val.items instanceof Array) {
                                    val = stack[0].val;
                                    tempFrag = this.executeForEach(tempFrag, context, data, val.items, val.as);
                                    node.parentNode.insertBefore(tempFrag, node);
                                }
                            }

                            if (!foreachOpen) {
                                stack.shift();
                                toRemove.push(node);
                            } else {
                                blockNestingCount -= 1;
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
                            html += ' ' + attr.name + '="' + attr.value + '"';
                        });
                        html += '>';
                    } else {
                        if (voidTags[tag]) {
                            html += '/>';
                        } else {
                            html += '</' + tag + '>';
                        }
                    }
                }
                if (isOpenTag && node.nodeType === 3) {
                    //escape <,> and &.
                    html += (node.nodeValue || '').replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;");
                }
            }, this);
            return html;
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
                template = new Htmlizer(fragment);
            items.forEach(function (item, index) {
                var newContext = {
                    $root: context.$root,
                    $parent: data,
                    $parentContext: context,
                    $parents: ([data]).concat(context.$parents),
                    $data: item,
                    $rawData: item,
                    //foreach specific
                    $index: index
                };

                //Copy 'as' references from parent. This is done recursively, so it will have all the 'as' references from ancestors.
                if (context._as) {
                    newContext._as = context._as.slice();
                    newContext._as.forEach(function (tuple) {
                        newContext[tuple[0]] = tuple[1];
                    });
                }
                if (as) {
                    newContext[as] = item;
                    //Add to _as so that sub templates can access them.
                    newContext._as = newContext._as || [];
                    newContext._as.push([as, item]);
                }

                //..finally execute
                output.appendChild(template.toDocumentFragment(item, newContext));
            });
            return output;
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
