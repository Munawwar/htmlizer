// Javascript object literal parser
// Splits an object literal string into a set of top-level key-value pairs
// (c) Michael Best (https://github.com/mbest)
// License: MIT (http://www.opensource.org/licenses/mit-license.php)
// Version 2.0.1
(function(root,factory){if(typeof exports==="object"){module.exports=factory()}else if(typeof define==="function"&&define.amd){define(factory)}else{root.parseObjectLiteral=factory()}})(this,function(undefined){var stringDouble='"(?:[^"\\\\]|\\\\.)*"',stringSingle="'(?:[^'\\\\]|\\\\.)*'",stringRegexp="/(?:[^/\\\\]|\\\\.)*/w*",specials=",\"'{}()/:[\\]",everyThingElse="[^\\s:,/][^"+specials+"]*[^\\s"+specials+"]",oneNotSpace="[^\\s]",token=RegExp(stringDouble+"|"+stringSingle+"|"+stringRegexp+"|"+everyThingElse+"|"+oneNotSpace,"g"),divisionLookBehind=/[\])A-Za-z0-9_$]$/;keywordRegexLookBehind=/(in|return|typeof)$/;function trim(string){return string==null?"":string.trim?string.trim():string.toString().replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")}return function(objectLiteralString){var str=trim(objectLiteralString);if(str.charCodeAt(0)===123)str=str.slice(1,-1);var result=[],toks=str.match(token),key,values,depth=0;if(toks){toks.push(",");for(var i=0,tok;tok=toks[i];++i){var c=tok.charCodeAt(0);if(c===44){if(depth<=0){if(key)result.push([key,values?values.join(""):undefined]);key=values=depth=0;continue}}else if(c===58){if(!values)continue}else if(c===47&&i&&tok.length>1){if(divisionLookBehind.test(toks[i-1])&&!keywordRegexLookBehind.test(toks[i-1])){str=str.substr(str.indexOf(tok)+1);toks=str.match(token);toks.push(",");i=-1;tok="/"}}else if(c===40||c===123||c===91){++depth}else if(c===41||c===125||c===93){--depth}else if(!key&&!values){key=c===34||c===39?tok.slice(1,-1):tok;continue}if(values)values.push(tok);else values=[tok]}}return result}});
