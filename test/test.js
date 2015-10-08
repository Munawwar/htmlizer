/*global describe, it*/

var assert = require("assert"),
    fs = require('fs'),
    Htmlizer = require('../src/Htmlizer2.js'),
    jsdom = require('jsdom').jsdom,
    document = jsdom(),
    window = document.parentWindow,
    jquery = require('../src/jquery.js')(window);

describe('run text and attr binding test', function () {
    var html = fetch('test/text-and-attr-binding-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            btnText: 'Click here',
            titleText: 'abc " def',
            cls: 'btn btn-default' //bootstrap 3 button css class
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have text = "Click here"', function () {
        assert.equal('Click here', df.firstChild.textContent.trim());
    });
    it('it should also have class = "btn btn-default"', function () {
        assert.equal('btn btn-default', df.firstChild.className.trim());
    });
    it('it should also have title = "abc &quot; def"', function () {
        assert.equal('abc " def', df.firstChild.getAttribute('title'));
    });
});

/*
describe('run container-less text binding test', function () {
    var html = fetch('test/text-comment-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            btnText: 'Click here'
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('first button element should only have one child', function () {
        assert.equal(1, df.firstChild.childNodes.length);
    });
    it('and it should be a text node with text = "Click here"', function () {
        assert.equal('Click here', df.firstChild.textContent.trim());
    });
    var lastButton = df.lastChild.previousSibling;
    it('second button element should only have one child', function () {
        assert.equal(1, lastButton.childNodes.length);
    });
    it('and it should be a text node with text = "Click here"', function () {
        assert.equal('Click here', lastButton.textContent.trim());
    });
});

describe('run html bind test', function () {
    var html = fetch('test/html-binding-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            message: '<b>This</b> is a <b>serious message</b>.'
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have 3 HTMLElements', function () {
        assert.equal(3, countElements(df));
    });
});
describe('run container-less html binding test', function () {
    var html = fetch('test/html-inline-binding-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            message: '<b>This</b> is a <b>serious message</b>.'
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have 2 HTMLElements', function () {
        assert.equal(2, countElements(df));
    });
});
*/

describe('run inline "if" statement test', function () {
    var html = fetch('test/if-inline-tpl.html'),
        tpl = new Htmlizer(html),
        outputHtml = tpl.toString({
            btnText: 'Howdy!',
            cls: 'btn btn-default' //bootstrap 3 button css class
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have 2 HTMLElements', function () {
        assert.equal(2, countElements(df));
    });
});

/*
describe('run container-less nested "if" statement test', function () {
    var html = fetch('test/if-comment-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            btnText: 'Howdy!',
            cls: 'btn btn-default' //bootstrap 3 button css class
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have 3 HTMLElements', function () {
        assert.equal(3, countElements(df));
    });
    it('button element should have text in it', function () {
        assert.equal('Howdy!', findElementByClassName(df, 'btn').firstChild.nodeValue);
    });
});

describe('run mixed "if" statement test', function () {
    var html = fetch('test/if-mixed-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            btnText: 'Howdy!',
            cls: 'btn btn-default' //bootstrap 3 button css class
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have 1 HTMLElement', function () {
        assert.equal(1, countElements(df));
    });
});

describe('run inline "foreach" statement test', function () {
    var html = fetch('test/foreach-inline-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            items: ['item1', 'item2', 'item3']
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have 4 HTMLElements', function () {
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
    it('it should have 6 HTMLElements', function () {
        assert.equal(6, countElements(df));
    });
});
*/

describe('run css and style binding test', function () {
    var html = fetch('test/css-and-style-binding-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            isWarning: true,
            bold: false
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have class="warning"', function () {
        assert.equal('warning', df.firstChild.className.trim());
    });
    it('it should have style="font-weight: normal"', function () {
        assert.equal('normal', df.firstChild.style.fontWeight);
    });
});

describe('run css dynamic class binding test', function () {
    var html = fetch('test/css-dynamic-class-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            className: 'dynamicClass'
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have class="dynamicClass"', function () {
        assert.equal('dynamicClass', df.firstChild.className.trim());
    });
});

/*
describe('run binding context test', function () {
    var html = fetch('test/binding-context-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            items: [{
                name: 'item1',
                subItems: [{
                    name: 'subitem1'
                }]
            }]
        }),
        df = htmlToDocumentFragment(outputHtml);

    var count = 0;
    traverse(df, df, function (node, isOpenTag) {
        if (isOpenTag && node.nodeType === 1 && node.nodeName === 'SPAN') {
            count += 1;
            if (count === 1) {
                it('span 1 text should be "SPAN"', function () {
                    assert.equal('SPAN', node.textContent);
                });
            }
            if (count >= 2 && count <= 3) {
                it('span ' + count + ' text should be "item1"', function () {
                    assert.equal('item1', node.textContent);
                });
            }
            if (count === 4) {
                it('span 4 text should be "0"', function () {
                    assert.equal('0', node.textContent);
                });
            }
            if (count >= 5 && count <= 6) {
                it('span ' + count + ' text should be "subitem1"', function () {
                    assert.equal('subitem1', node.textContent);
                });
            }
            if (count === 7) {
                it('span 6 text should be "true"', function () {
                    assert.equal('true', node.textContent);
                });
            }
        }
    });
});

describe('run "ifnot" binding test', function () {
    var html = fetch('test/ifnot-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            btnText: 'Howdy!',
            cls: 'btn btn-default' //bootstrap 3 button css class
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('it should have 1 HTMLElements', function () {
        assert.equal(1, countElements(df));
    });
});

describe('run inline "with" binding test', function () {
    var html = fetch('test/with-inline-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            obj: {
                val: 10
            }
        }),
        df = htmlToDocumentFragment(outputHtml);
    var count = 0;
    traverse(df, df, function (node, isOpenTag) {
        if (isOpenTag && node.nodeType === 1 && node.nodeName === 'SPAN' &&
            node.textContent === "10") {
            count += 1;
        }
    });
    it('it should have 4 SPANs with "10" as text content', function () {
        assert.equal(4, count);
    });
});

describe('run container-less "with" binding test', function () {
    var html = fetch('test/with-comment-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            obj: {
                val: 10
            }
        }),
        df = htmlToDocumentFragment(outputHtml);
    var count = 0;
    traverse(df, df, function (node, isOpenTag) {
        if (isOpenTag && node.nodeType === 1 && node.nodeName === 'SPAN' &&
            node.textContent === "10") {
            count += 1;
        }
    });
    it('it should have 4 SPANs with "10" as text content', function () {
        assert.equal(4, count);
    });
});

describe('run no conflict test', function () {
    var html = fetch('test/noconflict-tpl.html'),
        outputHtml = (new Htmlizer(html, {noConflict: true})).toString({
            btnText: 'Howdy!',
            cls: 'btn btn-default' //bootstrap 3 button css class
        }),
        df = htmlToDocumentFragment(outputHtml);

    var countComments = 0, commentIsKOStmt = true, btnCount = 0, firstBtnHasNoDataHtmlizer = true, secondBtnHasDataBind = true;
    traverse(df, df, function (node, isOpenTag) {
        if (isOpenTag && node.nodeType === 8) {
            countComments += 1;
            if (!((/^(ko |\/ko$)/).test(node.data.trim()))) {
                commentIsKOStmt = false;
            }
        }
        if (isOpenTag && node.nodeType === 1 && node.nodeName === "BUTTON") {
            btnCount += 1;
            if (btnCount === 1 && node.getAttribute('data-htmlizer')) {
                firstBtnHasNoDataHtmlizer = false;
            }
            if (btnCount === 2 && !node.getAttribute('data-bind')) {
                secondBtnHasDataBind = false;
            }
        }
    });

    it('it should have 2 comment statements', function () {
        assert.equal(true, countComments === 2);
    });
    it('both having "ko" prefix', function () {
        assert.equal(true, commentIsKOStmt);
    });
    it('it should have 2 buttons', function () {
        assert.equal(2, btnCount);
    });
    it('of which first button shouldn\'t have data-htmlizer attribute', function () {
        assert.equal(true, firstBtnHasNoDataHtmlizer);
    });
    it('and second button should have data-bind attribute', function () {
        assert.equal(true, secondBtnHasDataBind);
    });
});

describe('run no conflict data-bind binding test', function () {
    var html = fetch('test/noconflict-databind-tpl.html'),
        outputHtml = (new Htmlizer(html, {noConflict: true})).toString({
            cls: 'btn'
        }),
        df = htmlToDocumentFragment(outputHtml);

    it('it should have a class = "btn"', function () {
        assert.equal('btn', df.firstChild.getAttribute('class'));
    });
    it('it should have a data-bind attribute = {text:btnText}', function () {
        assert.equal('{text:btnText}', df.firstChild.getAttribute('data-bind'));
    });
});

describe('run no conflict sub-template test', function () {
    var html = fetch('test/noconflict-subtemplate-tpl.html'),
        outputHtml = (new Htmlizer(html, {noConflict: true})).toString({
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
    it('it should have 6 HTMLElements', function () {
        assert.equal(6, countElements(df));
    });
});

describe('run template binding test', function () {
    var html = fetch('test/template.html'),
        doc = jsdom(fetch('test/files/docroot.html'));
    var outputHtml = (new Htmlizer(html, {document: doc})).toString({
            buyer: {
                name: 'Franklin',
                credits: 250
            }
        }),
        df = htmlToDocumentFragment(outputHtml);
    it('div should have h3 tag', function () {
        assert.equal('H3', df.firstChild.childNodes[1].tagName);
    });
    it('h3 should have text as "Franklin"', function () {
        assert.equal('Franklin', df.firstChild.childNodes[1].firstChild.nodeValue);
    });
    it('foreach test: second div should have h3 with text as "Franklin"', function () {
        assert.equal('H3', df.childNodes[2].childNodes[1].tagName);
        assert.equal('Franklin', df.childNodes[2].childNodes[1].firstChild.nodeValue);
    });
});
*/

/*Utility functions*/
function fetch(pathToTextFile) {
    return fs.readFileSync(pathToTextFile, {encoding: 'utf8'});
}

function htmlToDocumentFragment(html) {
    var df = document.createDocumentFragment();
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
