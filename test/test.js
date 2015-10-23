/*global describe, it*/

var assert = require("assert"),
    Htmlizer = require('../src/Htmlizer.js'),
    util = require('./util/util.js');

describe('with void elements', function () {
    var html = '<hr><div>foo</div><br>',
        outputHtml = (new Htmlizer(html)).toString();
    it('it should serialize without an end tag and the self-closing slash marker', function () {
        assert.equal(outputHtml, html);
    });
});

require('./text-and-attr/test.js')(Htmlizer, assert, util);

require('./html/test.js')(Htmlizer, assert, util);

require('./if/test.js')(Htmlizer, assert, util);

require('./foreach/test.js')(Htmlizer, assert, util);

require('./css-and-style/test.js')(Htmlizer, assert, util);

require('./with/test.js')(Htmlizer, assert, util);

describe('run binding context test', function () {
    var html = util.fetch('test/binding-context-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({
            items: [{
                name: 'item1',
                subItems: [{
                    name: 'subitem1'
                }]
            }]
        }),
        df = util.htmlToDocumentFragment(outputHtml);

    var count = 0;
    util.traverse(df, df, function (node, isOpenTag) {
        if (isOpenTag && node.nodeType === 1 && node.nodeName === 'SPAN') {
            count += 1;
            if (count >= 1 && count <= 2) {
                it('span ' + count + ' text should be "item1"', function () {
                    assert.equal('item1', node.textContent);
                });
            }
            if (count === 3) {
                it('span 4 text should be "0"', function () {
                    assert.equal('0', node.textContent);
                });
            }
            if (count >= 4 && count <= 5) {
                it('span ' + count + ' text should be "subitem1"', function () {
                    assert.equal('subitem1', node.textContent);
                });
            }
            if (count === 6) {
                it('span 6 text should be "true"', function () {
                    assert.equal('true', node.textContent);
                });
            }
        }
    });
});



describe('run disable,enablemchecked and value binding test', function () {
    var html = util.fetch('test/misc-attr-binding-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({}),
        df = util.htmlToDocumentFragment(outputHtml);
    it('first child should have disabled="disabled"', function () {
        assert.equal('disabled', df.children[0].getAttribute('disabled'));
    });
    it('second child should also have disabled="disabled"', function () {
        assert.equal('disabled', df.children[1].getAttribute('disabled'));
    });
    it('third child should have checked="checked"', function () {
        assert.equal('checked', df.children[2].getAttribute('checked'));
    });
    it('fourth child should also have value="Hi"', function () {
        assert.equal('Hi', df.children[3].getAttribute('value'));
    });
    it('fifth child should also have display none', function () {
        assert.equal('none', df.children[4].style.display);
    });
});

require('./no-conflict/test.js')(Htmlizer, assert, util);

describe('run template binding test', function () {
    var html = util.fetch('test/template-tpl.html'),
        tpl = util.fetch('test/files/person-template.html'),
        cfg = {
            templates: {"person-template": tpl}
        };
    var outputHtml = (new Htmlizer(html, cfg)).toString({
            buyer: {
                name: 'Franklin',
                credits: 250
            }
        }),
        df = util.htmlToDocumentFragment(outputHtml);
    it('div should have h3 tag', function () {
        assert.equal('H3', df.firstChild.children[0].tagName);
    });
    it('h3 should have text as "Franklin"', function () {
        assert.equal('Franklin', df.firstChild.children[0].firstChild.nodeValue);
    });
    it('foreach test: second div should have h3 with text as "Franklin"', function () {
        assert.equal('H3', df.children[1].children[0].tagName);
        assert.equal('Franklin', df.children[1].children[0].firstChild.nodeValue);
    });
});
