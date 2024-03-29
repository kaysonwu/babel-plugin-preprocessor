<h1 align="center">Preprocessor Directives</h1>
<div align="center">
An babel plugin for transform preprocessor directives 
<br /><br />

![npm](https://img.shields.io/npm/v/babel-plugin-preprocessor)
![Node](https://img.shields.io/node/v/babel-plugin-preprocessor)
![Downloads](https://img.shields.io/npm/dy/babel-plugin-preprocessor)
![License](https://img.shields.io/npm/l/babel-plugin-preprocessor)
[![Build Status](https://travis-ci.com/kaysonwu/babel-plugin-preprocessor.svg?branch=master)](https://travis-ci.com/kaysonwu/babel-plugin-preprocessor)
<br /><br />
English | [中文](README-zh_CN.md) 
</div>

- [Installation](#installation)
- [Options](#options)
- [Usage](#usage)
  - [Build-in Directives](#build-in-directives)
  - [Complex use case](#complex-use-case)
  - [Custom Directives](#custom-directives)
  - [Compatible webpack-preprocessor-loader](#compatible-webpack-preprocessor-loader)
  - [Typescript](#typescript)
  - [JSX](#jsx)

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

- `symbols`: For [built-in directives](#build-in-directives) parameters
- `directives`: For [custom directives](#custom-directives)

Set plugin options in babel configuration file:

```json
{
  "plugins": [
    ...
    ["preprocessor", {
      "symbols": { "IS_BROWSER": true },
      "directives": { "DEBUG": true }
    }]
  ]
}
```

## Usage

### Build-in Directives

Before using `#if` / `#else` / `#elseif` (alias: `#elif`) / `#endif` build-in Directives, you need to configure the [symbols](#options) option in the babel configuration file.

```js
// #if IS_BROWSER
console.log('This is browser');
// #else
console.log('It\\'s unknown');
// #endif
```
If `IS_BROWSER` is truthy, `console.log ('It\\'s unknown');` will be deleted and vice versa.

#### Complex use case

Use the [symbols](#options) parameter like variable：

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

By configuring the [directives](#options) option to implement custom directives：

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
// #!if IS_BROWSER
console.log('This is browser');
// #!else
console.log('It\\'s unknown');
// #!endifWW
```

If you use its `#!debug` directive, please configure [directives](#options) option, If you also use its `verbose` option, then you need to configure the [symbols](#options) option according to the usage.

### Typescript

To suppress the error, a tricky way is simply adding `// @ts-ignore` before all declarations:

```ts
// #if ENV = 'develop'
// @ts-ignore
const foo = 1;
// #else
// @ts-ignore
const foo = -1;
// #endif
```

### JSX

Since version `0.0.2`, JSX directives have been fully supported：

```jsx
import React from 'react';
import ErrorBoundary from './boundary';

export default () => {
  return (
    /* #if IS_BROWSER */
    <ErrorBoundary fallback={() => <div>Fallback</div>}>
    {/* #endif */}
      <div>
        {/* #debug */}
        <span>This line should be deleted</span>
        Do something
      </div>
    {/* #if IS_BROWSER */} 
    </ErrorBoundary>
    /* #endif */  
  );
}
```

If a JSX element has a close tag, the directive to close the tag can be omitted：

```jsx
import React from 'react';
import ErrorBoundary from './boundary';

export default () => {
  return (
    /* #if IS_BROWSER */
    <ErrorBoundary fallback={() => <div>Fallback</div>}>
    {/* #endif */}
      <div>
        {/* #debug */}
        <span>This line should be deleted</span>
        Do something
      </div>
    </ErrorBoundary>
  );
}
```

However, I suggest you keep it so that it is compatible with [webpack-preprocessor-loader](https://github.com/afterwind-io/preprocessor-loader)

Pay attention to the wrapping of elements when using JSX, otherwise there will be some unexpected results：

```jsx
import React from 'react';
import ErrorBoundary from './boundary';

export default () => {
  return (
    /* #if IS_BROWSER */
    <ErrorBoundary fallback={() => <div>Fallback</div>}>
    {/* #endif */}
      {/* #debug */}
      <span>This line should be deleted</span>
      Do something
    {/* #if IS_BROWSER */} 
    </ErrorBoundary>
    /* #endif */  
  );
}
```
If `IS_BROWSER` is false and `debug` is true, then `Do something` line will be discarded.
