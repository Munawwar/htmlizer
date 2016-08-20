module.exports = function (Htmlizer, assert, util) {
    describe('run inline "if" statement test', function () {
        var html = util.fetch('test/if/if-inline-tpl.html'),
            tpl = new Htmlizer(html),
            outputHtml = tpl.toString({
                btnText: 'Howdy!',
                cls: 'btn btn-default' //bootstrap 3 button css class
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 2 HTMLElements', function () {
            assert.strictEqual(2, util.countElements(df));
        });
    });

    describe('run container-less nested "if" statement test', function () {
        var html = util.fetch('test/if/if-comment-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                btnText: 'Howdy!',
                cls: 'btn btn-default' //bootstrap 3 button css class
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 3 HTMLElements', function () {
            assert.strictEqual(3, util.countElements(df));
        });
        it('button element should have text in it', function () {
            assert.strictEqual('Howdy!', util.findElementByClassName(df, 'btn').firstChild.nodeValue);
        });
    });

    describe('run mixed "if" statement test', function () {
        var html = util.fetch('test/if/if-mixed-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                btnText: 'Howdy!',
                cls: 'btn btn-default' //bootstrap 3 button css class
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 1 HTMLElement', function () {
            assert.strictEqual(1, util.countElements(df));
        });
    });

    describe('run "ifnot" binding test', function () {
        var html = util.fetch('test/if/ifnot-tpl.html'),
            outputHtml = (new Htmlizer(html)).toString({
                btnText: 'Howdy!',
                cls: 'btn btn-default' //bootstrap 3 button css class
            }),
            df = util.htmlToDocumentFragment(outputHtml);
        it('it should have 1 HTMLElements', function () {
            assert.strictEqual(1, util.countElements(df));
        });
    });
};
