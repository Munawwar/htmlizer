module.exports = function (Htmlizer, assert, util) {
    describe('run template binding test', function () {
        var html = util.fetch('test/template/template-inline-tpl.html'),
            tpl = util.fetch('test/template/person-template.html'),
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
        var html = util.fetch('test/template/template-comment-tpl.html'),
            tpl = util.fetch('test/template/person-template.html'),
            cfg = {
                templates: {"person-template": tpl}
            };
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
};
