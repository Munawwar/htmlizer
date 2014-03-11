Htmlizer
========

Generate HTML (fragments) with Templates that are valid HTML (fragments).


Dependencies:
- jQuery
- https://github.com/mbest/js-object-literal-parse
- On NodeJS, jsdom will also be required.

Usage
=====

```
(new Htmlizer('<tempalte string>')).apply(dataObject);
```


Supports following syntaxes (with example):
```
(new Htmlizer('<span data-bind="text: mytext"></span>')).apply({mytext: 'test'})

Output: <span>test</span>
```
  

```
(new Htmlizer('<span data-bind="text: mytext, attr: {class: cls}"></span>'))
  .apply({mytext: 'test', cls: 'btn btn-default'})
  
Output: <span class="btn btn-default">test</span>
```

```
(new Htmlizer('\
  <div>\
    <!-- if: count -->\
      <div id="results"></div>\
    <!-- end if -->\
    <!-- if !count -->\
      No results to display.\
    <!-- /if -->\
  </div>')).apply({count: 0});`

Output: <div>No results to display.</div>
```
