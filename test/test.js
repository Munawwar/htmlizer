/*global describe, it*/

var assert = require("assert"),
    Htmlizer = require('../src/Htmlizer.js'),
    util = require('./util/util.js');

describe('with void elements', function () {
    var html = '<hr><div>foo</div><br>',
        outputHtml = (new Htmlizer(html)).toString();
    it('it should serialize without an end tag and the self-closing slash marker', function () {
        assert.strictEqual(outputHtml, html);
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
                    assert.strictEqual('item1', node.textContent);
                });
            }
            if (count === 3) {
                it('span 4 text should be "0"', function () {
                    assert.strictEqual('0', node.textContent);
                });
            }
            if (count >= 4 && count <= 5) {
                it('span ' + count + ' text should be "subitem1"', function () {
                    assert.strictEqual('subitem1', node.textContent);
                });
            }
            if (count === 6) {
                it('span 6 text should be "true"', function () {
                    assert.strictEqual('true', node.textContent);
                });
            }
        }
    });
});

describe('run disable,enable,checked and value binding test', function () {
    var html = util.fetch('test/misc-attr-binding-tpl.html'),
        outputHtml = (new Htmlizer(html)).toString({}),
        df = util.htmlToDocumentFragment(outputHtml);
    it('first child should have disabled="disabled"', function () {
        assert.strictEqual('disabled', df.children[0].getAttribute('disabled'));
    });
    it('second child should also have disabled="disabled"', function () {
        assert.strictEqual('disabled', df.children[1].getAttribute('disabled'));
    });
    it('third child should have checked="checked"', function () {
        assert.strictEqual('checked', df.children[2].getAttribute('checked'));
    });
    it('fourth child should also have value="Hi"', function () {
        assert.strictEqual('Hi', df.children[3].getAttribute('value'));
    });
    it('fifth child should also have display none', function () {
        assert.strictEqual('none', df.children[4].style.display);
    });
});

require('./no-conflict/test.js')(Htmlizer, assert, util);

describe('run keepKOBindings test', function () {
    var tpl = '<span data-bind="text: \'hi\', custom: \'binding\'"></span><!-- ko text: "hi" --><!-- /ko -->',
        outputHtml = (new Htmlizer(tpl, {keepKOBindings:true})).toString({});
    it('should keep data-bind attribute, ko comments and also render known bindings', function () {
        assert.strictEqual('<span data-bind="text: \'hi\', custom: \'binding\'">hi</span><!--  ko text: "hi"  -->hi<!--  /ko  -->', outputHtml);
    });
});

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
        assert.strictEqual('H3', df.firstChild.children[0].tagName);
    });
    it('h3 should have text as "Franklin"', function () {
        assert.strictEqual('Franklin', df.firstChild.children[0].firstChild.nodeValue);
    });
    it('foreach test: second div should have h3 with text as "Franklin"', function () {
        assert.strictEqual('H3', df.children[1].children[0].tagName);
        assert.strictEqual('Franklin', df.children[1].children[0].firstChild.nodeValue);
    });
});

describe('run containerless template binding test', function () {
    var html = '<!-- ko template: { name: "person-template", data: buyer } --><!-- /ko -->' +
		'<!-- ko template: { name: "person-template", foreach: [buyer] } --><!-- /ko -->';

    var tpl = util.fetch('test/files/person-template.html');
    var cfg = { templates: {"person-template": tpl} };
    var outputHtml = (new Htmlizer(html, cfg)).toString({
            buyer: {
                name: 'Franklin',
                credits: 250
            }
        });

    var df = util.htmlToDocumentFragment(outputHtml);

    it('div should have two h3 tag', function () {
        assert.strictEqual(2, df.querySelectorAll('h3').length);
    });
    it('first h3 should have text as "Franklin"', function () {
        assert.strictEqual('Franklin', df.querySelectorAll('h3')[0].innerHTML);
    });
    it('foreach test: second h3 with text as "Franklin"', function () {
        assert.strictEqual('Franklin', df.querySelectorAll('h3')[1].innerHTML);
    });
});
