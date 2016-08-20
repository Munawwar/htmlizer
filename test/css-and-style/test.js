module.exports = function (Htmlizer, assert, util) {
    describe('run css and style binding test', function () {
        var html = util.fetch('test/css-and-style/css-and-style-binding-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                isWarning: true,
                bold: false
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have class="warning"', function () {
            assert.strictEqual('warning', df.firstChild.className.trim());
        });
        it('it should have style="font-weight: normal"', function () {
            assert.strictEqual('normal', df.firstChild.style.fontWeight);
        });
    });

    describe('run css dynamic class binding test', function () {
        var html = util.fetch('test/css-and-style/css-dynamic-class-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                className: 'dynamicClass'
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have class="dynamicClass"', function () {
            assert.strictEqual('dynamicClass', df.firstChild.className.trim());
        });
    });
};
