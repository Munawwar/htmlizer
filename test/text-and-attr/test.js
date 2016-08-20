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

    describe('test attr binding with newlines and tabs', function () {
        var html = util.fetch('test/text-and-attr/attr-newline-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({});
        it('output attribute should retain newlines and tabs', function () {
            assert.equal(outputHtml, '<path d="M125,149.4L54.4,78.8c-4-4-10.5-4-14.6,0c-4,4-4,10.5,0,14.6l77.9,77.9c4,4,10.5,4,14.6,0l77.9-77.9c2-2,3-\n\t4.7,3-7.3s-1-5.3-3-7.3c-4-4-10.5-4-14.6,0L125,149.4z"></path>\n');
        });
    });

    describe('run data-bind:text on style and script tags test', function () {
        var html = util.fetch('test/text-and-attr/style-script-text-binding-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString(),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have executed text binding on style and script tag, and removed the "data-bind" attribute', function () {
            assert.equal(outputHtml, "<script>foo;</script>\n" +
                "<style>.foo { display: inline-block; }</style>\n" +
                "<script>var foo = 'bar';</script>\n" +
                "<script><div></div></script>\n" +
                "<div>hello</div>\n");
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
