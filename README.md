# Babel preprocessor directives

[![Version][version-badge]][npm]
[![Node][node-badge]][node]
![Downloads][download-badge]
[![License][license-badge]][license]
[![Build Status][travis-badge]][travis]

Used to transform preprocessor directives

English | [中文](#README_zh_CN.md) 

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
