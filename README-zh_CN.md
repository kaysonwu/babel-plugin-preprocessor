<h1 align="center">Preprocessor Directives</h1>
<div align="center">
一个 <a href="https://github.com/babel/babel" target="_blank">Babel</a> 插件，用于转换预处理器指令 <br />

![npm](https://img.shields.io/npm/v/babel-plugin-preprocessor)
![Node](https://img.shields.io/node/v/babel-plugin-preprocessor)
![Downloads](https://img.shields.io/npm/dy/babel-plugin-preprocessor)
![License](https://img.shields.io/npm/l/babel-plugin-preprocessor)
[![Build Status](https://travis-ci.com/kaysonwu/babel-plugin-preprocessor.svg?branch=master)](https://travis-ci.com/kaysonwu/babel-plugin-preprocessor)

</div>


[English](#README.md) | 中文

## 安装

```
yarn add -D babel-plugin-preprocessor
```

or

```
npm install -D babel-plugin-preprocessor
```

## 选项

```ts
interface PluginOptions {
  symbols: Record<string, any>;
  directives: Record<string, boolean>;
}
```

- `symbols`: 用于 [内置指令](#内置指令)
- `directives`: 用于 [自定义指令](#自定义指令)

在 `babel` 配置文件中设置插件选项:

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

## 使用

### 内置指令

使用 `#if` / `#else` / `#elseif` (alias: `#elif`) / `#endif` 等内置指令前, 你需要先配置 [symbols](#Options) 选项

```js
// #if BROWSER
console.log('This is browser');
// #else
console.log('It\\'s unknown');
// #endif
```
如果 `BROWSER` 是真的, `console.log ('It\\'s unknown');` 将被删除，反之亦然

#### 复杂用例

像变量一样去使用 [symbols](#Options) 的参数：

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

### 自定义指令

通过配置 [directives](#Options) 选项实现自定义指令：

```js
// #debug
console.log('debug message');
```
如果 `debug` 是假的, `console.log` 将被删除掉  

**Note** 自定义指令只影响其下一行，这意味着:

```js
// #debug
console.log('debug message'); // 这一行将被删除
const a = ''; // 这一行将被保留
```

### 兼容 [webpack-preprocessor-loader](https://github.com/afterwind-io/preprocessor-loader)

这个插件的灵感来源于 [webpack-preprocessor-loader](https://github.com/afterwind-io/preprocessor-loader), 因此, 你可以放心的使用它的内置指令:

```js
// #!if BROWSER
console.log('This is browser');
// #!else
console.log('It\\'s unknown');
// #!endifWW
```

如果你使用了它的 `#!debug` 指令, 请配置 [directives](#Options) 选项，如果你还使用了它的 `verbose` 选项, 你需要根据使用情况配置 [symbols](#Options) 选项。
