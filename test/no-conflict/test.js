module.exports = function (Htmlizer, assert, util) {
    describe('run no conflict test', function () {
        var html = util.fetch('test/no-conflict/noconflict-tpl.html'),
            outputHtml = (new Htmlizer(html, {noConflict: true})).toString({
                btnText: 'Howdy!',
                cls: 'btn btn-default' //bootstrap 3 button css class
            }),
            df = util.htmlToDocumentFragment(outputHtml);

        var countComments = 0, commentIsKOStmt = true, btnCount = 0, firstBtnHasNoDataHtmlizer = true, secondBtnHasDataBind = true;
        util.traverse(df, df, function (node, isOpenTag) {
            if (isOpenTag && node.nodeType === 8) {
                countComments += 1;
                if (!((/^(ko |\/ko$)/).test(node.data.trim()))) {
                    commentIsKOStmt = false;
                }
            }
            if (isOpenTag && node.nodeType === 1 && node.nodeName === "BUTTON") {
                btnCount += 1;
                if (btnCount === 1 && node.getAttribute('data-htmlizer')) {
                    firstBtnHasNoDataHtmlizer = false;
                }
                if (btnCount === 2 && !node.getAttribute('data-bind')) {
                    secondBtnHasDataBind = false;
                }
            }
        });

        it('it should have 2 comment statements', function () {
            assert.equal(true, countComments === 2);
        });
        it('both having "ko" prefix', function () {
            assert.equal(true, commentIsKOStmt);
        });
        it('it should have 2 buttons', function () {
            assert.equal(2, btnCount);
        });
        it('of which first button shouldn\'t have data-htmlizer attribute', function () {
            assert.equal(true, firstBtnHasNoDataHtmlizer);
        });
        it('and second button should have data-bind attribute', function () {
            assert.equal(true, secondBtnHasDataBind);
        });
    });

    describe('run no conflict data-bind binding test', function () {
        var html = util.fetch('test/no-conflict/noconflict-databind-tpl.html'),
            outputHtml = (new Htmlizer(html, {noConflict: true})).toString({
                cls: 'btn'
            }),
            df = util.htmlToDocumentFragment(outputHtml);

        it('it should have a class = "btn"', function () {
            assert.equal('btn', df.firstChild.getAttribute('class'));
        });
        it('it should have a data-bind attribute = {text:btnText}', function () {
            assert.equal('{text:btnText}', df.firstChild.getAttribute('data-bind'));
        });
    });
    describe('run no conflict sub-template test', function () {
        var html = util.fetch('test/no-conflict/noconflict-subtemplate-tpl.html'),
            outputHtml = (new Htmlizer(html, {noConflict: true})).toString({
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
            assert.equal(6, util.countElements(df));
        });
    });
};
