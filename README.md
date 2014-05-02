Htmlizer
========

Generate HTML (fragments) with Templates that are valid HTML (fragments).


Dependencies:
- jQuery
- https://github.com/mbest/js-object-literal-parse
- On NodeJS, jsdom will also be required.

Why?
-----
Most templating languages doesn't ensure that the templates are valid HTML. Templates needs to be parsable for build tools like assetgraph-builder to able to 1. find assets and relations 2. Translate text with their data-i18n syntax.

For example consider this Mustache template: `<div {{attributes}}></div>`.
This looks sane, but is unfortunately not parsable by most HTML parsers.

Here is another example: `<div style="{{style}}"></div>`. Even though this is parsable, the text inside the style attribute is not valid style attribute syntax and some parsers (I think jsdom) may throw an error.

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

#### *foreach* binding:
```
Template:
<div data-bind="foreach: items">
    <div data-bind="text: $data"></div>
</div>

Data: 
{
  items: ['item 1', 'item 2', 'item 3']
}

Output:
<div>
  <div>item 1</div>
  <div>item 2</div>
  <div>item 3</div>
</div>
```

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

#### *html* binding:
```
Template:
<div data-bind="html: message"></div>

Data: {message: '<b>This</b> is a <b>serious message</b>'}

Output: <div><b>This</b> is a <b>serious message</b></div>
```
