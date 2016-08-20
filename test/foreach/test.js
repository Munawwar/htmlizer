module.exports = function (Htmlizer, assert, util) {
    describe('run inline "foreach" binding test', function () {
        var html = util.fetch('test/foreach/foreach-inline-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                items: ['item1', 'item2', 'item3']
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 4 HTMLElements', function () {
            assert.strictEqual(4, util.countElements(df));
        });
    });

    describe('run container-less "foreach" binding test', function () {
        var html = util.fetch('test/foreach/foreach-comment-tpl.html'),
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
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 6 HTMLElements', function () {
            assert.strictEqual(6, util.countElements(df));
        });
    });

    describe('run container-less foreach markup check', function () {
        it('should not render end tags for each ancestor', function () {
            var html = util.fetch('test/foreach/foreach-containerless.html'),
                outputHtml = new Htmlizer(html).toString({
                    customValues: [
                        { name: 'foo' },
                        { name: 'bar' }
                    ]
                });
            assert.strictEqual(
                outputHtml,
                '<!DOCTYPE html>\n' +
                '<html>\n' +
                '    <head></head>\n' +
                '    <body>\n' +
                '        <p><b>foo</b></p><p><b>bar</b></p>\n' +
                '    </body>\n' +
                '</html>\n'
            );
        });
    });

    describe('run foreach $index context test', function () {
        var html = util.fetch('test/foreach/foreach-index-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                items: ['item1', 'item2', 'item3']
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 7 HTMLElements', function () {
            assert.strictEqual(7, util.countElements(df));
        });
    });
};
