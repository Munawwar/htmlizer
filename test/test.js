/*global describe, it*/

var assert = require("assert"),
    fs = require('fs'),
    Htmlizer = require('../src/Htmlizer.js'),
    jsdom = require('jsdom').jsdom,
    jqueryFactory = require('../src/jquery.js');

describe('run inline "if" statement test', function () {
    var html = fetch('test/if-inline-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            btnText: 'Howdy!',
            cls: 'btn btn-default' //bootstrap 3 button css class
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('and it should have 2 HTMLElements', function () {
        assert.equal(2, countElements(df));
    });
});

describe('run container-less nested "if" statement test', function () {
    var html = fetch('test/if-comment-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            btnText: 'Howdy!',
            cls: 'btn btn-default' //bootstrap 3 button css class
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('and it should have 2 HTMLElements', function () {
        assert.equal(2, countElements(df));
    });
    it('and button element should have text in it', function () {
        assert.equal('Howdy!', findElementByClassName(df, 'btn').firstChild.nodeValue);
    });
});

describe('run inline "foreach" statement test', function () {
    var html = fetch('test/foreach-inline-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            items: ['item1', 'item2', 'item3']
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('and it should have 4 HTMLElements', function () {
        assert.equal(4, countElements(df));
    });
});

describe('run container-less "foreach" statement test', function () {
    var html = fetch('test/foreach-comment-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            items: [{
                name: 'item1',
                subItems: [{
                    name: 'subitem1'
                }, {
                    name: 'subitem2'
                }]
            }, {
                name: 'item2'
            }, {
                name: 'item3'
            }]
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('and it should have 6 HTMLElements', function () {
        assert.equal(6, countElements(df));
    });
});

describe('run html bind test', function () {
    var html = fetch('test/html-binding-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            message: '<b>This</b> is a <b>serious message</b>.'
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('and it should have 3 HTMLElements', function () {
        assert.equal(3, countElements(df));
    });
});


/*Utility functions*/
function fetch(pathToTextFile) {
    return fs.readFileSync(pathToTextFile, {encoding: 'utf8'});
}

function htmlToDocumentFragment(html) {
    var document = jsdom(),
        window = document.parentWindow,
        jquery = jqueryFactory(window),
        df = document.createDocumentFragment();
    jquery.parseHTML(html).forEach(function (node) {
        df.appendChild(node);
    }, this);
    return df;
}

/**
 * @param {DocumentFragment} df
 */
function countElements(df) {
    var count = 0;
    traverse(df, df, function (node, isOpenTag) {
        if (isOpenTag && node.nodeType === 1) {
            count += 1;
        }
    });
    return count;
}

/**
 * Find element by class
 * @param {DocumentFragment} df
 * @param {String} CSS class name
 */
function findElementByClassName(df, className) {
    return traverse(df, df, function (node, isOpenTag) {
        if (isOpenTag && node.nodeType === 1 && node.className.trim().split(' ').indexOf(className) > -1) {
            return 'return';
        }
    });
}

/**
 * Find element by class
 * @param {DocumentFragment} df
 * @param {String} id
 */
function findElementById(df, id) {
    return traverse(df, df, function (node, isOpenTag) {
        if (isOpenTag && node.nodeType === 1 && node.id === id) {
            return 'return';
        }
    });
}

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
