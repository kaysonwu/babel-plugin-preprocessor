<h1 align="center">Preprocessor Directives</h1>
<div align="center">
An babel plugin for transform preprocessor directives 
<br />
<br />

![npm](https://img.shields.io/npm/v/babel-plugin-preprocessor)
![Node](https://img.shields.io/node/v/babel-plugin-preprocessor)
![Downloads](https://img.shields.io/npm/dy/babel-plugin-preprocessor)
![License](https://img.shields.io/npm/l/babel-plugin-preprocessor)
[![Build Status](https://travis-ci.com/kaysonwu/babel-plugin-preprocessor.svg?branch=master)](https://travis-ci.com/kaysonwu/babel-plugin-preprocessor)

</div>

English | [中文](README_zh_CN.md) 

## Installation

```
yarn add -D babel-plugin-preprocessor
```

or

```
npm install -D babel-plugin-preprocessor
```

## Options

```ts
interface PluginOptions {
  symbols: Record<string, any>;
  directives: Record<string, boolean>;
}
```

- `symbols`: For [built-in directives](#Build-in-Directives) parameters
- `directives`: For [custom directives](#Custom-Directives)

Set plugin options in babel configuration file:

```json
{
  "plugins": [
    ...
    ["preprocessor", {
      "symbols": { "BROWSER": true },
      "directives": { "DEBUG": true }
    }]
  ]
}
```

## Usage

### Build-in Directives

Before using `#if` / `#else` / `#elseif` (alias: `#elif`) / `#endif` build-in Directives, you need to configure the [symbols](#Options) option in the babel configuration file.

```js
// #if BROWSER
console.log('This is browser');
// #else
console.log('It\\'s unknown');
// #endif
```
If `BROWSER` is truthy, `console.log ('It\\'s unknown');` will be deleted and vice versa.

#### Complex use case

Use the [symbols](#Options) parameter like variable：

```json
{
  "plugins": [
    ["preprocessor", { "symbols": { "IE": 8, "UA": "Chrome" } }]
  ]
}
```

```js
// #if (IE > 8 && IE < 12) || UA.startsWith('Chrome')
console.log('Support HTML5');
// #else
console.log('HTML5 is not supported'); // This line will be deleted
// #endif
```

### Custom Directives

By configuring the [directives](#Options) option to implement custom directives：

```js
// #debug
console.log('debug message');
```
If `debug` is falsy, `console.log` will be deleted.  

**Note** that the custom directive only affects its next line, which means:

```js
// #debug
console.log('debug message'); // This line will be omitted
const a = ''; // This line will be retained
```

### Compatible [webpack-preprocessor-loader](https://github.com/afterwind-io/preprocessor-loader)

This plugin is inspired by [webpack-preprocessor-loader](https://github.com/afterwind-io/preprocessor-loader), Therefore, you can safely use its built-in directives:

```js
// #!if BROWSER
console.log('This is browser');
// #!else
console.log('It\\'s unknown');
// #!endifWW
```

If you use its `#!debug` directive, please configure [directives](#Options) option, If you also use its `verbose` option, then you need to configure the [symbols](#Options) option according to the usage.
