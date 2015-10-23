module.exports = function (Htmlizer, assert, util) {
    describe('run text and attr binding test', function () {
        var html = util.fetch('test/text-and-attr/text-and-attr-binding-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                btnText: 'Click here',
                titleText: 'abc " def',
                cls: 'btn btn-default' //bootstrap 3 button css class
            }),
            df = util.htmlToDocumentFragment(outputHtml);
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

    describe('run text binding on top-level test', function () {
        it('should render the end tag when there is a text binding on the top level element', function () {
            assert.equal(new Htmlizer('<b data-bind="text: name">bogus</b>').toString({ name: 'foo' }), '<b>foo</b>');
        });
    });

    describe('run container-less text binding test', function () {
        var html = util.fetch('test/text-and-attr/text-comment-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                btnText: 'Click here'
            }),
            df = util.htmlToDocumentFragment(outputHtml);
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
};
