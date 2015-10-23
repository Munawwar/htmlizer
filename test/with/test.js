module.exports = function (Htmlizer, assert, util) {
    describe('run inline "with" binding test', function () {
        var html = util.fetch('test/with/with-inline-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                obj: {
                    val: 10
                }
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        var count = 0;
        util.traverse(df, df, function (node, isOpenTag) {
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
        var html = util.fetch('test/with/with-comment-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                obj: {
                    val: 10
                }
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        var count = 0;
        util.traverse(df, df, function (node, isOpenTag) {
            if (isOpenTag && node.nodeType === 1 && node.nodeName === 'SPAN' &&
                node.textContent === "10") {
                count += 1;
            }
        });
        it('it should have 4 SPANs with "10" as text content', function () {
            assert.equal(4, count);
        });
    });
};
