var fs = require('fs'),
    jsdom = require('jsdom').jsdom,
    document = jsdom(),
    window = document.parentWindow,
    jquery = require('./jquery.js')(window);

var util = {
    fetch: function (pathToTextFile) {
        return fs.readFileSync(pathToTextFile, {encoding: 'utf8'});
    },

    htmlToDocumentFragment: function (html) {
        var df = document.createDocumentFragment();
        jquery.parseHTML(html).forEach(function (node) {
            df.appendChild(node);
        }, this);
        return df;
    },

    /**
     * @param {DocumentFragment} df
     */
    countElements: function (df) {
        var count = 0;
        util.traverse(df, df, function (node, isOpenTag) {
            if (isOpenTag && node.nodeType === 1) {
                count += 1;
            }
        });
        return count;
    },

    /**
     * Find element by class
     * @param {DocumentFragment} df
     * @param {String} CSS class name
     */
    findElementByClassName: function (df, className) {
        return util.traverse(df, df, function (node, isOpenTag) {
            if (isOpenTag && node.nodeType === 1 && node.className.trim().split(' ').indexOf(className) > -1) {
                return 'return';
            }
        });
    },

    /**
     * Find element by class
     * @param {DocumentFragment} df
     * @param {String} id
     */
    findElementById: function (df, id) {
        return util.traverse(df, df, function (node, isOpenTag) {
            if (isOpenTag && node.nodeType === 1 && node.id === id) {
                return 'return';
            }
        });
    },

    traverse: function (node, ancestor, callback, scope) {
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
};

module.exports = util;
