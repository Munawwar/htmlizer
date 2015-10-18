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
            traverse(this.frag, this.frag, function (node, isOpenTag) {
                if (!isOpenTag) {
                    return;
                }
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
                            if (node.parent !== block.start.parent) {
                                //KO 3.0 throws an error but still continues?
                                throw new Error('Cannot find closing comment tag to match: ' + block.start.data.trim());
                            }
                        } else {
                            console.warn('Extra end containerless tag found.');
                        }
                    }
                }
            }, this);
            if (stack.length) {
                throw new Error('Cannot find closing comment tag to match: ' + stack[0].start.data.trim()) + '"';
            }

            //Start generating the toString() method of this instance.
            var funcBody = CODE(function (data, context) {
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
            var ignoreTill = null;
            traverse(this.frag, this.frag, function (node, isOpenTag) {
                //Ignore till node.
                if (ignoreTill) {
                    if (ignoreTill === node) {
                        ignoreTill = null;
                    }
                    return;
                }

                if (!isOpenTag) {
                    if (node.type === 'tag') {
                        //Generate closing tag
                        funcBody += CODE(function (output, tag) {
                            output += '</' + $$(tag) + '>';
                        }, {tag: node.name});
                    }
                    return;
                }

                var val, match, tempFrag, inner;
                if (node.type === 'text') {
                    //TODO: Write test for text htmlEncode
                    funcBody += CODE(function (text, output) {
                        output += this.htmlEncode($$(text));
                    }, {text: node.data});
                } else if (node.type === 'tag') {
                    //Generate open tag (without attributes and >)
                    funcBody += CODE(function (output, tag) {
                        output += '<' + $$(tag);
                    }, {tag: node.name});

                    var bindOpts = node.attribs[this.noConflict ? 'data-htmlizer' : 'data-bind'];
                    delete node.attribs[this.noConflict ? 'data-htmlizer' : 'data-bind'];

                    if (bindOpts) {
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

                    var bindings = this.parseObjectLiteral(bindOpts),
                        conditionalAttributes = {}, // attribute that require conditional render
                        ret;

                    //First separate attributes that require conditional render from the ones that are constant.
                    //Also resolve conflicting attribute bindings (e.g. css binding and an attr.class binding).
                    Object.keys(bindings).forEach(function (binding) {
                        var value = bindings[binding];

                        if (binding === 'css') {
                            var constantClasses = unwrap((node.attribs.class || '').trim().replace(/ /g, ','));

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

                                node.attribs.class = Object.keys(constantClasses).join(' ');
                                conditionalAttributes.class = {
                                    binding: 'css',
                                    value: conditionalClasses
                                };
                            } else {
                                node.attribs.class = Object.keys(constantClasses).join(' ');
                                conditionalAttributes.class = {
                                    binding: 'css',
                                    value: value
                                };
                            }
                        }

                        if (binding === 'style') {
                            var constantStyles = this.parseCSSDeclarations(node.attribs.style || ''),
                                conditionalStyles = {};

                            this.forEachObjectLiteral(value.slice(1, -1), function (prop, value) {
                                prop = this.camelCaseToCSSProp(prop);
                                //If CSS property is defined in style attribute of markup and also
                                //as a binding, then remove it from constantStyles.
                                if (constantStyles[prop]) {
                                    delete constantStyles[prop];
                                }
                                conditionalStyles[prop] = value;
                            }, this);

                            //Convert constantStyles to semi-colon separated CSS declaration string.
                            var styles = '';
                            Object.keys(constantStyles).forEach(function (prop) {
                                styles += prop + ':' + constantStyles[prop].replace(/"/g, '\\"') + '; ';
                            });
                            //Overwrite node.attribs.style. This contains all styles that don't need conditional render.
                            node.attribs.style = styles;

                            conditionalAttributes.style = {
                                binding: binding,
                                value: conditionalStyles
                            };
                        }

                        if (binding === 'attr') {
                            this.forEachObjectLiteral(value.slice(1, -1), function (attr, expr) {
                                if (node.attribs[attr]) {
                                    delete node.attribs[attr]; //The attribute will be overridden by binding anyway.
                                }
                                conditionalAttributes[attr] = {
                                    binding: binding,
                                    expr: expr
                                };
                            }, this);
                        }

                        //Some of the following aren't treated as attributes by Knockout, but this is here to keep compatibility with Knockout.

                        if (binding === 'disable' || binding === 'enable') {
                            delete node.attribs.disabled;
                            conditionalAttributes.disabled = {
                                binding: binding,
                                expr: value
                            };
                        }

                        if (binding === 'checked') {
                            delete node.attribs.checked;
                            conditionalAttributes.checked = {
                                binding: binding,
                                expr: value
                            };
                        }

                        if (binding === 'value') {
                            delete node.attribs.value;
                            conditionalAttributes.checked = {
                                binding: binding,
                                expr: value
                            };
                        }

                        /*
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

                        if (this.noConflict && binding === 'data-bind') {
                            node.attribs['data-bind'] = value;
                        }
                    }, this);

                    //Generate attributes
                    Object.keys(node.attribs).concat(Object.keys(conditionalAttributes)).forEach(function (attr) {
                        if (typeof node.attribs[attr] === 'string') {
                            var value = this.generateAttribute(node.attribs[attr]);
                            if (conditionalAttributes[attr]) {
                                value = value.slice(0, -1); //Remove quote
                            }

                            //Add the attributes that were part of element's markup.
                            funcBody += CODE(function (output) {
                                output += ' ' + $$(attr) + '=' + $$(value);
                            }, {
                                attr: this.htmlEncode(attr),
                                value: value
                            });
                        }

                        //Generate conditional attributes
                        var bindingInfo = conditionalAttributes[attr];
                        if (bindingInfo) {
                            var binding = bindingInfo.binding;
                            if (binding === 'css') {
                                var conditionalClasses = bindingInfo.value;
                                if (typeof conditionalClasses === 'object') {
                                    funcBody += CODE(function (data, context, output) {
                                        val = $_(conditionalClasses);
                                        Object.keys(val).forEach(function (className) {
                                            var expr = val[className];
                                            if (this.exprEvaluator(expr, context, data)) {
                                                output += ' ' + className;
                                            }
                                        }, this);

                                        output += '"';
                                    }, {
                                        conditionalClasses: JSON.stringify(conditionalClasses)
                                    });
                                } else {
                                    funcBody += CODE(function (constantClasses, data, context, output, className) {
                                        className = this.exprEvaluator($$(value), context, data);

                                        //Check if className already exists
                                        if (className && (' ' + $$(constantClasses) + ' ').indexOf(' ' + className + ' ') < 0) {
                                            output += ' ' + className;
                                        }

                                        output += '"';
                                    }, {
                                        constantClasses: node.attribs[attr],
                                        value: bindingInfo.value
                                    });
                                }
                            } else if (binding === 'style') {
                                funcBody += CODE(function (conditionalStyles, data, context, output) {
                                    conditionalStyles = $_(conditionalStyles);
                                    Object.keys(conditionalStyles).forEach(function (prop) {
                                        val = this.exprEvaluator(conditionalStyles[prop], context, data) || null;
                                        if (val || typeof val === 'string' || typeof val === 'number') {
                                            output += prop + ':' + val.replace(/"/g, '\\"') + '; ';
                                        }
                                    }, this);

                                    output += '"';
                                }, {
                                    conditionalStyles: JSON.stringify(bindingInfo.value)
                                });
                            } else if (binding === 'disable' || binding === 'enable') {
                                funcBody += CODE(function (expr, data, context, output, val) {
                                    output += this.inlineBindings.disable.call(this, $$(binding), $$(expr), context, data);
                                }, {
                                    binding: binding,
                                    expr: bindingInfo.expr
                                });
                            } else if (binding === 'checked') {
                                funcBody += CODE(function (expr, data, context, output, val) {
                                    output += this.inlineBindings.checked.call(this, $$(expr), context, data);
                                }, {expr: bindingInfo.expr});
                            } else if (binding === 'value') {
                                funcBody += CODE(function (expr, data, context, output, val) {
                                    output += this.inlineBindings.value.call(this, $$(expr), context, data);
                                }, {expr: bindingInfo.expr});
                            } else if (binding === 'attr') {
                                funcBody += CODE(function (data, context, output, expr) {
                                    output += this.inlineBindings.attr.call(this, $$(attr), $$(expr), context, data);
                                }, {
                                    attr: this.htmlEncode(attr),
                                    expr: bindingInfo.expr
                                });
                            }
                        }
                    }, this);

                    //Close open tag
                    funcBody += CODE(function (close, output) {
                        output += $$(close);
                    }, {
                        close: voidTags[node.name] ? ' />' : '>'
                    });


                    //For non-void tags.
                    if (!voidTags[node.name]) {
                        //Now convert the descendant bindings
                        this.forEachObjectLiteral(bindOpts, function (binding, value) {
                            //Convert ifnot: (...) to if: !(...)
                            if (binding === 'ifnot') {
                                value = '!(' + value + ')';
                                binding = 'if';
                            }

                            //First evaluate if
                            if (binding === 'if') {
                                funcBody += CODE(function (expr, ifBody, data, context, output, val) {
                                    output += this.inlineBindings["if"].call(this, $$(expr), function () {
                                        $_(ifBody);
                                    }, data, context);
                                }, {
                                    expr: value,
                                    ifBody: funcToString((new Htmlizer(node.children, this.cfg)).toString)
                                });
                                ret = 'continue';
                            }

                            if (binding === 'foreach') {
                                funcBody += CODE(function (foreachBody, data, context, output) {
                                    output += this.inlineBindings.foreach.call(this, $$(value), function (data, context) {
                                        $_(foreachBody);
                                    }, context, data);
                                }, {
                                    value: value,
                                    foreachBody: funcToString((new Htmlizer(node.children, this.cfg)).toString)
                                });
                                ret = 'continue';
                            }

                            if (binding === 'with') {
                                funcBody += CODE(function (expr, withBody, data, context, output) {
                                    output += this.inlineBindings.with.call(this, $$(expr), function (data, context) {
                                        $_(withBody);
                                    }, context, data);
                                }, {
                                    expr: value,
                                    withBody: funcToString((new Htmlizer(node.children, this.cfg)).toString)
                                });
                                ret = 'continue';
                            }

                            if (binding === 'text') {
                                funcBody += CODE(function (expr, data, context, output) {
                                    output += this.inlineBindings.text.call(this, $$(expr), context, data);
                                }, {expr: value});
                                ret = 'continue';
                            }

                            if (binding === 'html') {
                                funcBody += CODE(function (expr, data, context, output) {
                                    output += this.inlineBindings.html.call(this, $$(expr), context, data);
                                }, {expr: value});
                                ret = 'continue';
                            }

                            if (binding === 'template') {
                                val = this.parseObjectLiteral(value);
                                val.name = val.name.slice(1, -1);
                                var tpl = (this.cfg.templates || {})[val.name];
                                if (!tpl) {
                                    throw new Error("Template named '" + val.name + "' does not exist.");
                                }

                                funcBody += CODE(function (data, tpl, context, output) {
                                    output += this.inlineBindings.template.call(this, $_(value), function (data, context) {
                                        $_(tpl);
                                    }, context, data);
                                }, {
                                    tpl: funcToString((new Htmlizer(tpl, this.cfg)).toString),
                                    value: JSON.stringify(val)
                                });
                                ret = 'continue';
                            }
                        }, this);
                    }

                    if (ret) {
                        return ret;
                    }
                } else if (node.type === 'comment') {
                    var stmt = node.data.trim(), blockNodes;

                    //Ignore all containerless statements beginning with "ko" if noConflict = true.
                    if (this.noConflict && (/^(ko |\/ko$)/).test(stmt)) {
                        funcBody += CODE(function (output, comment) {
                            output += '<!-- ' + $$(comment) + ' -->';
                        }, {comment: node.data});
                        return;
                    }

                    //Convert ifnot: (...) to if: !(...)
                    if ((match = stmt.match(syntaxRegex.ifnot))) {
                        stmt = match[1].replace('ifnot', 'if') + ': !(' + match[2] + ')';
                    }

                    //Process if statement
                    if ((match = stmt.match(syntaxRegex['if']))) {
                        block = this.findBlockFromStartNode(blocks, node);
                        blockNodes = this.getImmediateNodes(this.frag, block.start, block.end);

                        funcBody += CODE(function (expr, ifBody, data, context, output, val) {
                            output += this.inlineBindings["if"].call(this, $$(expr), function () {
                                $_(ifBody);
                            }, data, context);
                        }, {
                            expr: match[2],
                            ifBody: funcToString((new Htmlizer(blockNodes, this.cfg)).toString)
                        });

                        ignoreTill = block.end;
                    } else if ((match = stmt.match(syntaxRegex.foreach))) {
                        //Create a new htmlizer instance, render it and insert berfore this node.
                        block = this.findBlockFromStartNode(blocks, node);
                        blockNodes = this.getImmediateNodes(this.frag, block.start, block.end);

                        funcBody += CODE(function (value, foreachBody, data, context, output) {
                            output += this.inlineBindings.foreach.call(this, $$(value), function (data, context) {
                                $_(foreachBody);
                            }, context, data);
                        }, {
                            value: match[2].trim(),
                            foreachBody: funcToString((new Htmlizer(blockNodes, this.cfg)).toString)
                        });

                        ignoreTill = block.end;
                    } else if ((match = stmt.match(syntaxRegex['with']))) {
                        block = this.findBlockFromStartNode(blocks, node);
                        blockNodes = this.getImmediateNodes(this.frag, block.start, block.end);

                        funcBody += CODE(function (expr, withBody, data, context, val, output) {
                            output += this.inlineBindings.with.call(this, $$(expr), function (data, context) {
                                $_(withBody);
                            }, context, data);
                        }, {
                            expr: match[2],
                            withBody: funcToString((new Htmlizer(blockNodes, this.cfg)).toString)
                        });

                        ignoreTill = block.end;
                    } else if ((match = stmt.match(syntaxRegex.text))) {
                        block = this.findBlockFromStartNode(blocks, node);

                        funcBody += CODE(function (expr, data, context, output) {
                            output += this.inlineBindings.text.call(this, $$(expr), context, data);
                        }, {expr: match[2]});

                        ignoreTill = block.end;
                    } else if ((match = stmt.match(syntaxRegex.html))) {
                        block = this.findBlockFromStartNode(blocks, node);

                        funcBody += CODE(function (expr, data, context, val, output) {
                            output += this.inlineBindings.html.call(this, $$(expr), context, data);
                        }, {expr: match[2]});

                        ignoreTill = block.end;
                    }
                } else if (node.type === 'script' || node.type === 'style') {
                    //TODO: Write test for text script and style tags
                    //No need to escape text inside script or style tag.
                    var html = this.vdomToHtml([node]);
                    funcBody += CODE(function (doctype, output) {
                        output += $$(html);
                    }, {html: html});
                    return 'continue';
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
         * This method is generated on the fly, from the init method.
         */
        toString: function (data, context) {
            /*Method body is generated on the fly*/
        },

        /**
         * Renders for bindings on elements.
         */
        inlineBindings: {
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
                return this.htmlEncode(val + '');
            },

            html: function (expr, context, data) {
                var val = this.exprEvaluator(expr, context, data);
                if (val !== undefined && val !== null && val !== '') {
                    //Parse html
                    var dom = this.parseHTML(val + '');
                    return this.vdomToHtml(dom);
                }
                return '';
            },

            "with": function (expr, withBody, context, data) {
                var val = this.exprEvaluator(expr, context, data);
                if (val !== null && val !== undefined) {
                    return withBody.call(this, val, this.getNewContext(context, val));
                }
                return '';
            },

            "if": function (expr, ifBody, context, data) {
                var val = this.exprEvaluator(expr, context, data);
                if (val) {
                    return ifBody.call(this);
                }
                return '';
            },

            foreach: function (expr, foreachBody, context, data) {
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

            template: function (value, tpl, context, data) {
                var val = {
                    data: this.exprEvaluator(value.data, context, data),
                    if: value['if'] ? this.exprEvaluator(value['if'], context, data) : true,
                    foreach: this.exprEvaluator(value.foreach, context, data),
                    as: (value.as || '').slice(1, -1) //strip string quote
                };

                var output = '';
                if (val['if']) {
                    if (val.data || !(val.foreach instanceof Array)) {
                        output = tpl.call(this, val.data || data, this.getNewContext(context, val.data || data));
                    } else {
                        output = this.executeForEach(tpl, context, data, val.foreach, val.as);
                    }
                }
                return output;
            },

            disable: function (binding, expr, context, data) {
                var val = this.exprEvaluator(expr, context, data),
                    enable = (binding === 'enable' ? val : !val);
                if (!enable) {
                    return ' disabled="disabled"';
                }
                return '';
            },

            checked: function (expr, context, data) {
                var val = this.exprEvaluator(expr, context, data);
                if (val) {
                    return ' checked="checked"';
                }
                return '';
            },

            value: function (expr, context, data) {
                var val = this.exprEvaluator(expr, context, data);
                if (val === null || val === undefined) {
                    return '';
                } else {
                    return ' value=' + this.generateAttribute(val);
                }
            }
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
         * Converts vdom from domhandler to HTML.
         */
        vdomToHtml: function (dom) {
            var html = '';
            dom.forEach(function (node) {
                if (node.type === 'tag') {
                    var tag = node.name;
                    html += '<' + tag;
                    Object.keys(node.attribs).forEach(function (attr) {
                        html += ' ' + attr + '=' + this.generateAttribute(node.attribs[attr]);
                    }, this);
                    html += (voidTags[tag] ? '/>' : '>');
                    if (!voidTags[tag]) {
                        html += this.vdomToHtml(node.children);
                        html += '</' + tag + '>';
                    }
                } else if (node.type === 'text') {
                    var text = node.data || '';
                    html += this.htmlEncode(text); //escape <,> and &.
                } else if (node.type === 'comment') {
                    html += '<!-- ' + node.data.trim() + ' -->';
                } else if (node.type === 'script' || node.type === 'style') {
                    //No need to escape text inside script or style tag.
                    html += '<' + node.name;
                    Object.keys(node.attribs).forEach(function (attr) {
                        html += ' ' + attr + '=' + this.generateAttribute(node.attribs[attr]);
                    }, this);
                    html += '>' + ((node.children[0] || {}).data || '') + '</' + node.name + '>';
                } else if (node.type === 'directive') {
                    html += '<' + node.data + '>';
                }
            }, this);
            return html;
        },

        /**
         * @private
         */
        findBlockFromStartNode: function (blocks, node) {
            return blocks.filter(function (block) {
                return block.start === node;
            })[0] || null;
        },

        /**
         * @private
         * Find all immediate nodes between two given nodes and return fragement.
         */
        getImmediateNodes: function (frag, startNode, endNode) {
            var children = startNode.parent ?  startNode.parent.children : frag,
                startPos = children.indexOf(startNode),
                endPos = children.indexOf(endNode);
            return this.makeNewFragment(children.slice(startPos + 1, endPos));
        },

        /**
         * Makes a shallow copy of nodes, and puts them into an array.
         *
         * This is to detach nodes from their parent. Nodes are considered immutable, hence copy is needed.
         * i.e. Doing node.parent = null, during a traversal could cause traversal logic to behave unexpectedly.
         * Hence a shallow copy is made without parent instead.
         */
        makeNewFragment: function (nodes) {
            var copy = nodes.map(function (node, index) {
                var clone = {};
                //Shallow clone
                Object.keys(node).forEach(function (prop) {
                    if (prop !== 'next' && prop !== 'prev' && prop !== 'parent') {
                        clone[prop] = node[prop];
                    }
                });
                return clone;
            });
            copy.forEach(function (cur, i) {
                cur.prev = copy[i - 1];
                cur.next = copy[i + 1];
            });
            return copy;
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

    /**
     * VDOM traversal.
     * Given a VDOM node, this method finds the next tag/node that would appear in the dom.
     * WARNING: Do not remove or add nodes while traversing, because it could cause the traversal logic to go crazy.
     *
     * @param node Could be a any node (element node or text node)
     * @param ancestor Node An ancestorial element that can be used to limit the search.
     * The search algorithm, while traversing the ancestorial heirarcy, will not go past/above this element.
     *
     * @param {function} callback A callback called on each element traversed.
     *
     * callback gets following parameters:
     * node: Current node being traversed.
     * isOpenTag: boolean. On true, node would be the next open tag/node that one would find when going
     * linearly downwards through the DOM. Filtering with isOpenTag=true, one would get exactly what native TreeWalker does.
     * Similarly isOpenTag=false when a close tag is encountered when traversing the DOM.
     *
     * callback can return one of the following values (with their meanings):
     * 'return': Halts and returns node.
     * 'continue': Skips further traversal of current node (i.e won't traverse it's child nodes).
     * 'break': Skips all sibling elements of current node and goes to it's parent node.
     *
     * relation: The relation compared to the previously traversed node.
     * @param {Object} [scope] Value of 'this' keyword within callback
     * @private
     */
    function traverse(node, ancestor, callback, scope) {
        if (Array.isArray(node)) { //handle document fragment
            var arr = node;
            node = {
                type: 'fragment',
                children: arr
            };
            if (arr === ancestor) {
                ancestor = node;
            }
        }

        //if node = ancestor, we still can traverse it's child nodes
        if (!node) {
            return null;
        }
        var isOpenTag = true, ret = null;
        do {
            if (isOpenTag && node.children && node.children[0] && !ret) {
                node = node.children[0];
                //isOpenTag = true;
                ret = callback.call(scope, node, true, 'firstChild');
            } else if (node.next && node !== ancestor && ret !== 'break') {
                if (isOpenTag) {
                    callback.call(scope, node, false, 'current');
                }
                node = node.next;
                isOpenTag = true;
                ret = callback.call(scope, node, true, 'nextSibling');
            } else if (node.parent && node !== ancestor) {
                if (isOpenTag) {
                    callback.call(scope, node, false, 'current');
                }
                //Traverse up the dom till you find an element with nextSibling
                node = node.parent;
                isOpenTag = false;
                ret = callback.call(scope, node, false, 'parentNode');
            } else {
                node = null;
            }
        } while (node && ret !== 'return');
        return node || null;
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
