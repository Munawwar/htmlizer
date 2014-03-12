Htmlizer
========

Generate HTML (fragments) with Templates that are valid HTML (fragments).


Dependencies:
- jQuery
- https://github.com/mbest/js-object-literal-parse
- On NodeJS, jsdom will also be required.

Usage
-----

Render template as HTML string:
```
(new Htmlizer('<tempalte string>')).toString(dataObject);
```

Render template as DocumentFragment:
```
(new Htmlizer('<tempalte string>')).toDocumentFragment(dataObject);
```


Template syntax
-----
Syntax is similar to KnockoutJS (in fact supports a subset of Knockout templates).

```
(new Htmlizer('<span data-bind="text: mytext"></span>')).toString({mytext: 'test'})

Output: <span>test</span>
```
  

```
(new Htmlizer('<span data-bind="text: mytext, attr: {class: cls}"></span>'))
  .toString({mytext: 'test', cls: 'btn btn-default'})
  
Output: <span class="btn btn-default">test</span>
```

```
(new Htmlizer('\
  <div>\
    <!-- if: count -->\
      <div id="results"></div>\
    <!-- /if -->\
    <!-- ko if: !count -->\
      No results to display.\
    <!-- /ko -->\
  </div>')).toString({count: 0});`

Output: <div>No results to display.</div>
```
