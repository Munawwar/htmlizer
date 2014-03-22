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
(new Htmlizer('<template string>')).toString(dataObject);
```

Render template as DocumentFragment:
```
(new Htmlizer('<template string>')).toDocumentFragment(dataObject);
```


Template syntax
-----
Syntax is similar to KnockoutJS (in fact supports a subset of Knockout templates).

#### *text* binding:

```
Template: <span data-bind="text: mytext"></span>

Data: {mytext: 'test'}

Output: <span>test</span>
```

#### *attr* binding:  

```
Template: <span data-bind="text: mytext, attr: {class: cls}"></span>

Data: {mytext: 'test', cls: 'btn btn-default'}
  
Output: <span class="btn btn-default">test</span>
```

#### *if* binding:
```
Template:
<div data-bind="if: show">
  This message won't be shown.
</div>

Data: {show: false}

Output: <div></div>
```

#### Containerless *if* binding:
```
Template:
<div>
  <!-- if: count -->
    <div id="results"></div>
  <!-- /if -->
  <!-- ko if: !count -->
    No results to display.
  <!-- /ko -->
</div>

Data: {count: 0}

Output: <div>No results to display.</div>
```

Note: You can use either "if:" or "ko if:" to begin an *if* statement. And you may either use "/if" or "/ko" to end an *if* statement.

#### Containerless *foreach* binding:
```
Template:
<div>
  <!-- foreach: items -->
    <div data-bind="text: name"></div>
  <!-- /ko -->
</div>

Data:
{
    items: [{name: 'item 1'}, {name: 'item 2'}, {name: 'item 3'}]
}

Output:
<div>
  <div>item 1</div>
  <div>item 2</div>
  <div>item 3</div>
</div>
```
