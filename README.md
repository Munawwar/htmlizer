Htmlizer
========

Generate HTML (fragments) with Templates that are valid HTML (fragments).


Dependencies:
- jQuery
- https://github.com/mbest/js-object-literal-parse
- On NodeJS, jsdom will also be required.

Why?
-----
Most templating languages doesn't ensure that the templates are valid HTML. Templates needs to be parsable for build tools like assetgraph-builder to able to 1. find assets (like images) for optimization 2. Translate text with their [data-i18n](https://github.com/assetgraph/assetgraph-builder#html-i18n-syntax) syntax.

For example consider this Mustache template: `<div {{attributes}}></div>`.
This looks sane, but is unfortunately not parsable by most HTML parsers.

Here is another example: `<div style="{{style}}"></div>`. Even though this is parsable, the text inside the style attribute is not valid CSS syntax and some parsers may throw an error.

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
  <!-- ko if: count -->
    <div id="results"></div>
  <!-- /ko -->
  <!-- hz if: !count -->
    No results to display.
  <!-- /hz -->
</div>

Data: {count: 0}

Output: <div>No results to display.</div>
```

Note: You can use either "ko if:" or "hz if:" to begin an *if* statement. And you may either use "/ko" or "/hz" to end an *if* statement.

#### Containerless *text* binding:
```
Template:
<div>
  <!-- ko text: msg --><!-- /ko -->
</div>

Data: {msg: 'Hello'}

Output: <div>Hello</div>
```

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
  <!-- ko foreach: items -->
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

#### *css* binding:
```
Template:
<div data-bind="css: {warning: isWarning}"></div>

Data: {isWarning: true}

Output: <div class="warning"></div>
```

#### *style* binding:
```
Template:
<div data-bind="style: {fontWeight: bold ? 'bold' : 'normal'}"></div>

Data: {bold: false}

Output: <div style="font-weight: normal;"></div>
```

#### *with* binding:
```
Template:
<div data-bind="with: obj">
    <span data-bind="text: val"></span>
</div>

Data: {obj: {val: 10}}

Output:
<div>
    <span>10</span>
</div>
```

#### Containerless *with* binding:
```
Template:
<!-- ko with: obj -->
    <span data-bind="text: val"></span>
<!-- /ko -->

Data: {obj: {val: 10}}

Output: <span>10</span>
```

#### *template* binding:
Works mostly like KO 3.0 - [documentation](http://knockoutjs.com/documentation/template-binding.html).
Supports the following properties: name, data, if, foreach and as.

```
Template:
<div data-bind="template: { name: 'person-template', data: buyer }"></div>
<div data-bind="template: { name: 'person-template', foreach: [buyer] }"></div>

index.html:
<html>
    <head>
        <script type="text/html" id="person-template">
            <h3 data-bind="text: name"></h3>
            <p>Credits: <span data-bind="text: credits"></span></p>
        </script>
    </head>
</html>

Data:
{
    buyer: {
        name: 'Franklin',
        credits: 250
    }
}

Output:
<div>
    <h3><Franklin/h3>
    <p>Credits: <span>250</span></p>
</div>
<div>
    <h3><Franklin/h3>
    <p>Credits: <span>250</span></p>
</div>
```

To make template work on NodeJS, one must first place all sub-templates in a separate HTMLDocument and
pass it as parameter to the template being executed.

```
  var html = require('fs').readFileSync('index.html'); //load the file with the sub-templates.
      doc = require('jsdom')(html), //returns HTMLDocument
      output = (new Htmlizer('<template string>', {document: doc})).toDocumentFragment(dataObject);
```

#### Binding Contexts

Supports all the binding contexts documented for KO 3.0 [here](http://knockoutjs.com/documentation/binding-context.html).

```
Template:
<div data-bind="foreach: {data: items, as: 'obj'}">
    <!-- ko foreach: subItems -->
        <span data-bind="text: $element.nodeName"></span>
        <span data-bind="text: obj.name"></span>
        <span data-bind="text: $parent.name"></span>
        <span data-bind="text: $index"></span>
        <span data-bind="text: $data.name"></span>
        <span data-bind="text: name"></span>
        <span data-bind="text: $root === $parents[$parents.length - 1]"></span>
    <!-- /ko -->
</div>

Data:
{
    items: [{
        name: 'item1',
        subItems: [{
            name: 'subitem1'
        }]
    }]
}

Output:
<div>

        <span>SPAN</span>
        <span>item1</span>
        <span>item1</span>
        <span>0</span>
        <span>subitem1</span>
        <span>subitem1</span>
        <span>true</span>

</div>
```

Avoiding conflict with KO
-----
To avoid conflict with KnockoutJS, set noConflict config to true:
```
var template = new Htmlizer('<template string>', {noConflict: true});
```
By default noConflict is assumed false. With noConflict = true, there are two main differences:

- Bindings must be placed within data-htmlizer attribute.
- Containerless statements with "ko" prefix will be ignored. Use "hz" prefix if you want Htmlizer to process it.
