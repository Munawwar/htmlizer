/*global module, require, define*/
/*jslint evil: true*/

/**
 * Html Templating.
 * HTML must be balanced, else it won't be correctly converted to DOM.
 *
 * Use cases are mainly to render simple conditional attributes and nodes.
 * (Not exactly meant for 'for' loops etc, which I believe is better done with JS using DOM APIs).
 *
 *
 * Dependencies
 * 1. jQuery
 * 2. https://github.com/mbest/js-object-literal-parse
 *
 * Usage: (new Htmlizer('<tempalte string>')).apply(dataObject);
 *
 * Supports following syntaxes (with example):
 * Eg 1:
 * (new Htmlizer('<span data-bind="text: mytext"></span>')).apply({mytext: 'test'})
 * Output: <span>test</span>
 *
 * Eg 2:
 * (new Htmlizer('<span data-bind="text: mytext, attr: {class: cls}"></span>')).apply({mytext: 'test', cls: 'btn btn-default'})
 * Output: <span class="btn btn-default">test</span>
 *
 * Eg 3:
 * (new Htmlizer('\
 * <div>\
 *    <!-- if: count -->\
 *      <div id="results"></div>\
 *    <!-- end if -->\
 *    <!-- if !count -->\
 *      No results to display.\
 *    <!-- /if -->\
 * </div>')).apply({count: 0});
 * Output: <div>No results to display.</div>
 */
(function (root, factory, saferEval) {
    if (typeof exports === 'object') {
        module.exports = factory(
            require('./jquery'),
            require('./js-object-literal-parse.js'),
            saferEval
        );
    } else if (typeof define === 'function' && define.amd) {
        define(['jquery', './js-object-literal-parse'], factory, saferEval);
    } else {
        root.Htmlizer = factory(root.jQuery, root.parseObjectLiteral, saferEval);
    }
}(this, function ($, parseObjectLiteral, saferEval) {
    function unwrap(str) {
        var arr = str.split(','), val, o = {};
        while ((val = arr.pop())) {
            o[val] = true;
        }
        return o;
    }
    //HTML 4 and 5 void tags
    var voidTags = unwrap('area,base,basefont,br,col,command,embed,frame,hr,img,input,keygen,link,meta,param,source,track,wbr'),
        regexMap = {
            JSVar: "[$_A-Za-z][$_A-Za-z0-9]*"
        };
    regexMap.DotNotation = new RegExp('(' + regexMap.JSVar + '(?:\\.' + regexMap.JSVar + ')*)');

    //Valid statements. Currently only 'if' statement.
    var syntaxRegex = {
        "if": new RegExp("(?:(ko[ ]+if|if):(.+))")
    };

    /**
     * @param {String|DocumentFragment} template
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
        toDocumentFragment: function (data) {
            var frag = this.frag.cloneNode(true);

            var stack = [], //Keep track of ifs and fors
                toRemove = []; //use this to remove nodes within if statement that are false.
            traverse(frag, frag, function (node, isOpenTag) {
                if (isOpenTag) {
                    if (stack[0] && stack[0].key === 'if' && !stack[0].val) {
                        toRemove.push(node);
                        return 'continue';
                    }

                    var val;
                    if (node.nodeType === 1) { //element
                        var bindOpts = node.getAttribute('data-bind'), attributes;
                        if (bindOpts) {
                            bindOpts = parseObjectLiteral(bindOpts);
                            bindOpts.forEach(function (opt) {
                                if (opt[0] === 'text' && regexMap.DotNotation.test(opt[1])) {
                                    val = saferEval(opt[1], data);
                                    if (val !== undefined) {
                                        node.appendChild(document.createTextNode(val));
                                    }
                                }
                                if (opt[0] === 'attr') {
                                    attributes = parseObjectLiteral(opt[1].slice(1, -1));
                                    attributes.forEach(function (tuple) {
                                        if (regexMap.DotNotation.test(tuple[1])) {
                                            val = saferEval(tuple[1], data);
                                            if (val) {
                                                node.setAttribute(tuple[0], val);
                                            }
                                        }
                                    });
                                }
                            });
                            node.removeAttribute('data-bind');
                        }
                    }

                    //HTML comment node
                    if (node.nodeType === 8) {
                        //Process if statement
                        var stmt = node.data.trim(), match;
                        if ((/^((ko[ ]+if)|if):/).test(stmt) && (match = stmt.match(syntaxRegex['if']))) {
                            val = saferEval(match[2], data);
                            stack.unshift({
                                key: 'if',
                                val: val
                            });
                            toRemove.push(node);
                        } else if ((/^\/(ko|if)/).test(stmt)) {
                            stack.shift();
                            toRemove.push(node);
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
                        Array.prototype.slice.call(node.attributes).forEach(function (attr) {
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
                if (node.nodeType === 3) {
                    html += node.nodeValue;
                }
            }, this);
            return html;
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
    if (arguments.length < 3) {
        return (new Function('$data', 'with($data){return ' + arguments[0] + '}'))(arguments[1] || {});
    } else if (arguments.length < 4) {
        return (new Function('$context', '$data', 'with($context){with($data){return ' + arguments[0] + '}}'))(arguments[1] || {}, arguments[2] || {});
    }
}));
