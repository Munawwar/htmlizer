module.exports = function (Htmlizer, assert, util) {
    describe('run inline "if" statement test', function () {
        var html = util.fetch('test/svg/arg-containing-newline-tpl.html'),
            tpl = new Htmlizer(html),
            outputHtml = tpl.toString();
        it('should maintain actual newline, tab characters in attribute values', function () {
            assert.equal(outputHtml, '<path d="M125,149.4L54.4,78.8c-4-4-10.5-4-14.6,0c-4,4-4,10.5,0,14.6l77.9,77.9c4,4,10.5,4,14.6,0l77.9-77.9c2-2,3-\n\t4.7,3-7.3s-1-5.3-3-7.3c-4-4-10.5-4-14.6,0L125,149.4z"></path>');
        });
    });
};
