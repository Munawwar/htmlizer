module.exports = function (Htmlizer, assert, util) {
    describe('run inline "foreach" and "attr" statement test', function () {
        var html = util.fetch('test/foreach-and-attr/foreach-and-attr-binding-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                items: ['item1', 'item2', 'item3']
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 7 HTMLElements', function () {
            assert.equal(7, util.countElements(df));
        });
    });
};
