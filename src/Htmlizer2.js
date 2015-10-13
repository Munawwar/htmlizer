/*global module, require, define, $$, $_*/
/*jslint evil: true*/

/**
 * Html Templating.
 * The MIT License (MIT)
 * Copyright (c) 2015 Munawwar
 */
(function (factory, functionGenerator, exprEvaluator) {
    if (typeof exports === 'object') {
        module.exports = factory(
            functionGenerator,
            exprEvaluator,
            require('./js-object-literal-parse.js'),
            require('htmlparser2'),
            require('cssom'),
            require('domhandler')
        );
    }
}(function (functionGenerator, exprEvaluator, parseObjectLiteral, htmlparser, cssom) {
    function unwrap(str) {
        var o = {};
        str.split(',').forEach(function (val) {
            o[val] = true;
        });
        return o;
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
     * @param {String|DomHandlerFragment} template
     * DomHandlerFragment refers to the output of domhandler module on parsing html.
     * @param {Object} cfg
     * @param {Document} cfg.document Only used in NodeJS to make the 'template' binding work. If template isn't a complete document,
     *  then provide a HTMLDocument that contains script tags that the 'template' binding can use.
     * @param {Object} cfg.noConflict Will ensure Htmlizer doesn't conflict with KnockoutJS. i.e data-htmlizer attribute will be used and
     * containerless statements beginning and ending with "ko" prefix will be ignored.
     */
    function Htmlizer(template, cfg) {
        this.cfg = cfg || {};
        Object.keys(this.cfg).forEach(function (k) {
            this[k] = this.cfg[k];
        }, this);
        if (typeof template === 'string') {
            this.origTplStr = template;
            this.frag = this.parseHTML(template);
        } else { //assuming DomHandlerFragment
            this.frag = template;
        }
        this.init();
    }

    Htmlizer.prototype = {
        init: function () {
            var stack = [], //Keep track of ifs and fors
                blocks = [],
                block;

            //Before evaluating, determine the nesting structure for containerless statements.
            traverse(this.frag, function (node) {
                if (node.type === 'comment') {
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

            //Start generating the toString() method of this instance.
            var funcBody = CODE(function (context, data) {
                if (!context) {
                    context = {
                        $parents: [],
                        $root: data,
                        $data: data,
                        $rawData: data
                    };
                }

                var output = '', val, className, conditionalStyles;
            });

            //Convert vdom into a resuable function
            traverse(this.frag, function (node) {
                var val, match, tempFrag, inner;
                if (node.type === 'text') {
                    funcBody += CODE(function (text, output) {
                        output += this.htmlEncode($$(text));
                    }, {text: node.data});
                } else if (node.type === 'tag') {

                    //Generate open tag (without attributes and >)
                    funcBody += CODE(function (output, tag) {
                        output += '<' + $$(tag);
                    }, {tag: node.name});

                    var bindOpts = node.attribs[this.noConflict ? 'data-htmlizer' : 'data-bind'];

                    if (bindOpts) {
                        delete node.attribs[this.noConflict ? 'data-htmlizer' : 'data-bind'];
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
                    //First convert all the attribute related bindings.
                    this.forEachObjectLiteral(bindOpts, function (binding, value) {

                        if (binding === 'css') {
                            var constantClasses = unwrap((node.attribs.class || '').trim().replace(/ /g, ','));
                            delete node.attribs.class;

                            if (value[0] === '{') {
                                var conditionalClasses = {};
                                this.forEachObjectLiteral(value.slice(1, -1), function (className, expr) {
                                    //If class is defined in class attribute and also as a binding, then
                                    //remove from constantClasses.
                                    if (constantClasses[className]) {
                                        delete constantClasses[className];
                                    }
                                    conditionalClasses[className] = expr;
                                });

                                constantClasses = Object.keys(constantClasses).join(' ');
                                funcBody += CODE(function (output, context, data) {
                                    output += ' class="' + $$(constantClasses);

                                    val = $_(conditionalClasses);
                                    Object.keys(val).forEach(function (className) {
                                        var expr = val[className];
                                        if (this.exprEvaluator(expr, context, data)) {
                                            output += ' ' + className;
                                        }
                                    }, this);

                                    output += '"';
                                }, {
                                    constantClasses: constantClasses,
                                    conditionalClasses: JSON.stringify(conditionalClasses)
                                });
                            } else {
                                constantClasses = Object.keys(constantClasses).join(' ');
                                funcBody += CODE(function (output, context, data, className) {
                                    output += ' class="' + $$(constantClasses);

                                    className = this.exprEvaluator($$(value), context, data);
                                    if (className) {
                                        output += ' ' + className;
                                    }

                                    output += '"';
                                }, {
                                    constantClasses: constantClasses,
                                    value: value
                                });
                            }
                        }

                        if (binding === 'style') {
                            var constantStyles = this.parseCSSDeclarations(node.attribs.style || ''),
                                conditionalStyles = {};
                            delete node.attribs.style;

                            this.forEachObjectLiteral(value.slice(1, -1), function (prop, value) {
                                prop = this.camelCaseToCSSProp(prop);
                                //If CSS property is defined in style attribute and also
                                //as a binding, then remove it from constantStyles.
                                if (constantStyles[prop]) {
                                    delete constantStyles[prop];
                                }
                                conditionalStyles[prop] = value;
                            }, this);

                            //Convert constantStyles to semi-color separated CSS declaration string.
                            var styles = '';
                            Object.keys(constantStyles).forEach(function (prop) {
                                styles += prop + ':' + constantStyles[prop].replace(/"/g, '\\"') + '; ';
                            });
                            constantStyles = styles;

                            funcBody += CODE(function (output, context, data) {
                                output += ' style="' + $$(constantStyles);

                                conditionalStyles = $_(conditionalStyles);
                                Object.keys(conditionalStyles).forEach(function (prop) {
                                    val = this.exprEvaluator(conditionalStyles[prop], context, data) || null;
                                    if (val || typeof val === 'string' || typeof val === 'number') {
                                        output += prop + ':' + val.replace(/"/g, '\\"') + '; ';
                                    }
                                }, this);

                                output += '"';
                            }, {
                                constantStyles: constantStyles,
                                conditionalStyles: JSON.stringify(conditionalStyles)
                            });
                        }

                        if (binding === 'attr') {
                            this.forEachObjectLiteral(value.slice(1, -1), function (attr, expr) {
                                if (node.attribs[attr]) {
                                    delete node.attribs[attr]; //The attribute will be overridden by binding anyway.
                                }
                                funcBody += CODE(function (output, context, data) {
                                    output += this.elementRenderer.attr.call(this, $$(attr), $$(expr), context, data);
                                }, {
                                    attr: this.htmlEncode(attr),
                                    expr: expr
                                });
                            }, this);

                            //Add the attributes that were part of element's markup.
                            Object.keys(node.attribs).forEach(function (attr) {
                                var value = node.attribs[attr];
                                funcBody += CODE(function (output) {
                                    output += ' ' + $$(attr) + '=' + $$(value);
                                }, {
                                    attr: this.htmlEncode(attr),
                                    value: this.generateAttribute(value)
                                });
                            }, this);
                        }

                        //Some of the following aren't treated as attributes by Knockout, but this is here to keep compatibility with Knockout.
                        /*
                        if (binding === 'disable' || binding === 'enable') {
                            val = exprEvaluator(value, context, data, node);
                            var disable = (binding === 'disable' ? val : !val);
                            if (disable) {
                                node.setAttribute('disabled', 'disabled');
                            } else {
                                node.removeAttribute('disabled');
                            }
                        }

                        if (binding === 'checked') {
                            val = exprEvaluator(value, context, data, node);
                            if (val) {
                                node.setAttribute('checked', 'checked');
                            } else {
                                node.removeAttribute('checked');
                            }
                        }

                        if (binding === 'value') {
                            val = exprEvaluator(value, context, data, node);
                            if (val === null || val === undefined) {
                                node.removeAttribute('value');
                            } else {
                                node.setAttribute('value', val);
                            }
                        }

                        if (binding === 'visible') {
                            val = exprEvaluator(value, context, data, node);
                            if (val) {
                                if (node.style.display === 'none') {
                                    node.style.removeProperty('display');
                                }
                            } else {
                                node.style.setProperty('display', 'none');
                            }
                        }
                        */
                    }, this);

                    if (voidTags[node.name]) {
                        //Close open tag
                        funcBody += CODE(function (output) {
                            output += '/>';
                        });
                    //For non-void tags.
                    } else {
                        //Close open tag
                        funcBody += CODE(function (output) {
                            output += '>';
                        });

                        //Now convert the descendant bindings
                        this.forEachObjectLiteral(bindOpts, function (binding, value) {
                            //Convert ifnot: (...) to if: !(...)
                            /*if (binding === 'ifnot') {
                                value = '!(' + value + ')';
                            }
                            */

                            //First evaluate if
                            if (binding === 'if') {
                                funcBody += CODE(function (expr, ifBody, context, data, output, val) {
                                    val = this.exprEvaluator($$(expr), context, data);
                                    if (val) {
                                        output += (function () {
                                            $_(ifBody);
                                        }.call(this));
                                    }
                                }, {
                                    expr: value,
                                    ifBody: funcToString((new Htmlizer(node.children)).toString)
                                });
                                ret = 'continue';
                            }

                            if (binding === 'foreach') {
                                funcBody += CODE(function (foreachBody, context, data, output) {
                                    output += this.handleForeachBinding($$(value), function (data, context) {
                                        $_(foreachBody);
                                    }, context, data);
                                }, {
                                    value: value,
                                    foreachBody: funcToString((new Htmlizer(node.children)).toString)
                                });
                                ret = 'continue';
                            }

                            /*
                            if (binding === 'with') {
                                val = exprEvaluator(value, context, data, node);

                                tempFrag = this.moveToNewFragment(this.slice(node.childNodes));
                                if (tempFrag.firstChild && val !== null && val !== undefined) {
                                    node.appendChild(this.executeInNewContext(tempFrag, context, val));
                                }
                            }
                            */

                            if (binding === 'text') {
                                funcBody += CODE(function (data, context, expr, output) {
                                    output += this.elementRenderer.text.call(this, $$(expr), data, context);
                                }, {expr: value});
                            }

                            /*
                            if (binding === 'html') {
                                $(node).empty();
                                val = exprEvaluator(value, context, data, node);
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
                                    data: exprEvaluator(inner.data, context, data, node),
                                    if: inner['if'] ? exprEvaluator(inner['if'], context, data, node) : true,
                                    foreach: exprEvaluator(inner.foreach, context, data, node),
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

                            if (this.noConflict && binding === 'data-bind') {
                                node.setAttribute('data-bind', value);
                            }*/
                        }, this);

                        //Generate closing tag
                        funcBody += CODE(function (output, tag) {
                            output += '</' + $$(tag) + '>';
                        }, {tag: node.name});
                    }

                    if (ret) {
                        return ret;
                    }
                } else if (node.type === 'directive') {
                    funcBody += CODE(function (doctype, output) {
                        output += '<' + $$(doctype) + '>';
                    }, {doctype: node.data});
                }
            }, this);

            //Complete the function body
            funcBody += CODE(function (output) {
                return output;
            });

            this.toString = functionGenerator('data', 'context', funcBody);
        },

        /**
         * Renders for bindings on elements.
         */
        elementRenderer: {
            /**
             * Assuming attr parameter is html encoded.
             */
            attr: function (attr, expr, context, data) {
                var val = this.exprEvaluator(expr, context, data);
                if (val || typeof val === 'string' || typeof val === 'number') {
                    return " " + attr + '=' + this.generateAttribute(val);
                } else {
                    //else if undefined, null, false then don't render attribute.
                    return '';
                }
            },

            text: function (expr, context, data) {
                var val = this.exprEvaluator(expr, context, data);
                if (val === null || val === undefined) {
                    val = '';
                }
                return this.htmlEncode(val);
            }
        },

        handleForeachBinding: function (expr, foreachBody, context, data) {
            var val;
            if (expr[0] === '{') {
                var inner = this.parseObjectLiteral(expr);
                val = {
                    items: this.exprEvaluator(inner.data, context, data),
                    as: inner.as.slice(1, -1) //strip string quote
                };
            } else {
                val = {items: this.exprEvaluator(expr, context, data)};
            }

            var output = '';
            if (val.items instanceof Array) {
                output += this.executeForEach(foreachBody, context, data, val.items, val.as);
            }
            return output;
        },

        /**
         * @private
         * @param {Function} foreachBody
         * @param {Object} context
         * @param {Object} data Data object
         * @param {Array} items The array to iterate through
         */
        executeForEach: function (foreachBody, context, data, items, as) {
            var output = '';
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
                output += foreachBody.call(this, item, newContext);
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

        parseHTML: function (tpl) {
            var ret;
            var parser = new htmlparser.Parser(new htmlparser.DomHandler(function (err, dom) {
                if (err) {
                    throw new Error(err);
                }
                ret = dom;
            }));
            parser.write(tpl);
            parser.done();
            return ret;
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
         * @param {String} styleProps Semi-colon separated style declarations
         */
        parseCSSDeclarations: function (styleProps) {
            var stylesObj = cssom.parse('whatever { ' + styleProps + '}').cssRules[0].style,
                styles = {};
            //Create a cleaner object
            for (var i = 0; i < stylesObj.length; i += 1) {
                var property = stylesObj[i];
                styles[property] = stylesObj[property];
            }
            return styles;
        },

        camelCaseToCSSProp: function (prop) {
            return prop.replace(/[A-Z]/g, function (m) {
                return '-' + m.toLowerCase();
            });
        },

        htmlEncode: function (str) {
            return str.replace(/>/g, "&gt;").replace(/</g, "&lt;");
        },

        generateAttribute: function (val) {
            val = this.htmlEncode(val).replace(/"/g, '&quot;');
            return JSON.stringify(val); //Escape \n\r etc with JSON.stringify
        },

        functionGenerator: functionGenerator,

        exprEvaluator: exprEvaluator
    };

    /*This function is only intended for debugging purposes at the moment*/
    function simplerVDom(o) {
        if (Array.isArray(o)) {
            return o.map(simplerVDom);
        } else {
            var n = {};
            Object.keys(o).forEach(function (k) {
                n[k] = o[k];
            }, this);
            delete n.parent;
            delete n.next;
            delete n.prev;
            if (o.children) {
                n.children = simplerVDom(o.children);
                if (n.children.length < 1) {
                    delete n.children;
                }
            }
            return n;
        }
    }

    /**
     * VDOM traversal.
     * WARNING: Never remove or add nodes to tree while traversing. Immutability is assumed.
     * Callback can return one of the following strings:
     *  'continue' to skip traversing curent node's child nodes
     *  'break' to skip traversing current node's next siblings
     *  'return' to stop traversal and return the last node traversed.
     */
    function traverse(o, callback, context, extra) {
        if (Array.isArray(o)) { //handle document fragment
            o = {
                type: 'fragment',
                children: o
            };
        }
        var ret = callback.call(context, o);
        if (!ret && o.children) {
            return o.children.some(function (item, index) {
                var ret2 = traverse(item, callback, context, {parent: o, index: index});
                if (ret2 === 'return') {
                    ret = o;
                }
                return (ret2 === 'break' || ret2 === 'return' || (typeof ret2 !== 'string' && ret2 !== undefined));
            });
        }
        return ret;
    }

    //Convert function body to string.
    function funcToString(func) {
        var str = func.toString();
        return str.slice(str.indexOf('{') + 1, str.lastIndexOf('}'));
    }

    /**
     * String formatting helpful for code generation.
     * @param {String} strOrFunc String with placeholders. If this param is a function it's body is converted to string and then placeholders are replaced.
     * @param {Object|...} arg If object then you can use {propertyName} as placeholder.
     * Else you can supply n number of args and use {argument index} as placholder
     *
     * There are two types of placeholder:
     * 1. $$(value) - This will be quoted if value is a string.
     * 2. $_(value) - value will be treated as an expression/code, so it will be added as-is.
     * @method format
     * @example
     *
     *     CODE('<div class=$$(0)>', 'box');
     *     CODE('<div class=$$(cls)>', {cls: 'box'});
     *     //output of both: <div class="box">
     *
     */
    function CODE(strOrFunc, arg) {
        var str = (typeof strOrFunc === 'function' ? funcToString(strOrFunc) : strOrFunc);
        if (arguments.length === 1) {
            return str;
        }
        if (typeof arg !== 'object') {
            arg = Array.prototype.slice.call(arguments, 1);
        }
        return str.replace(/(^|[^\\])\$(\$|_)\((\w+)\)/g, function (m, p, f, index) {
            var x = arg[index];
            if (f === '$' && typeof x === 'string') {
                x = JSON.stringify(x); //Escape \n\r, quotes etc with JSON.stringify
            }
            return (p || '') + (x !== undefined ? x : '');
        });
    }

    return Htmlizer;
}, function () {
    return Function.apply(null, arguments);
}, function () {
    //Templates could be attempting to reference undefined variables. Hence try catch is required.
    if (arguments.length >= 3) {
        try {
            return (new Function('$context', '$data', 'with($context){with($data){return ' + arguments[0] + '}}'))(arguments[1] || {}, arguments[2] || {});
        } catch (e) {}
    } else {
        throw new Error('Expression evaluator needs at least 3 arguments.');
    }
}));
