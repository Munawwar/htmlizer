module.exports = function (Htmlizer, assert, util) {
    describe('run html bind test', function () {
        var html = util.fetch('test/html/html-binding-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                message: '<b>This</b> is a <b>serious message</b>.'
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 3 HTMLElements', function () {
            assert.equal(3, util.countElements(df));
        });
    });
    describe('run container-less html binding test', function () {
        var html = util.fetch('test/html/html-inline-binding-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                message: '<b>This</b> is a <b>serious message</b>.'
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 2 HTMLElements', function () {
            assert.equal(2, util.countElements(df));
        });
    });
};
