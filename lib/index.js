"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
var _vm = require("vm");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
function evalDirective(code, symbols) {
  try {
    const context = _objectSpread({}, symbols);
    return (0, _vm.runInNewContext)(`(function(){ return (${code}); })()`, context);
  } catch (_unused) {
    /* ignore error */
  }
  return false;
}
function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}
function _default() {
  function parseDirective(value) {
    const directive = value.trim();
    if (!directive.startsWith('#')) return false;

    // For compatibility with webpack-preprocessor-loader.
    // Support #!if、#if、#!IF、#IF
    const code = directive.split(/\s+/);
    const key = code.shift().replace(/^#!?/g, '').toLowerCase();
    return {
      key,
      code: code.join(' ')
    };
  }
  function getFalsyRanges(comments, options) {
    const {
      directives = {},
      symbols = {}
    } = options;
    const ranges = [];
    const tokens = [];
    comments.forEach(comment => {
      const {
        value,
        loc
      } = comment;
      const directive = parseDirective(value);
      if (directive === false) {
        return;
      }
      const {
        key,
        code
      } = directive;
      const {
        line
      } = loc.start;
      const previousIndex = tokens.length - 1;
      const previous = tokens[previousIndex] || {
        key: '',
        passed: true,
        level: 0
      };
      switch (key) {
        case 'if':
          tokens.push({
            key,
            line,
            passed: previous.passed ? evalDirective(code, symbols) : null,
            level: previous.level + 1
          });
          break;
        case 'elif':
        case 'elseif':
          // if-elif、if-elseif
          if (['if', 'elif', 'elseif'].includes(previous.key)) {
            if (previous.passed) {
              tokens.push({
                key,
                line,
                passed: false,
                level: previous.level
              });
            } else if (previous.passed === false) {
              ranges.push({
                start: previous.line,
                end: line
              });
              tokens[previousIndex] = {
                key,
                line,
                passed: evalDirective(code, symbols),
                level: previous.level
              };
            }
          }
          break;
        case 'else':
          // if-else、if-elif-else、if-elseif-else
          if (['if', 'elif', 'elseif'].includes(previous.key)) {
            if (previous.passed) {
              tokens[previousIndex] = {
                key,
                line,
                passed: false,
                level: previous.level
              };
            } else if (previous.passed === false) {
              ranges.push({
                start: previous.line,
                end: line
              });
              tokens[previousIndex] = {
                key,
                line,
                passed: !tokens.some(token => token.passed && token.level === previous.level),
                level: previous.level
              };
            }
          }
          break;
        case 'endif':
          if (['if', 'elif', 'elseif', 'else'].includes(previous.key)) {
            if (previous.passed === false) {
              ranges.push({
                start: previous.line,
                end: line
              });
            }
            tokens.pop();
          }
          break;
        default:
          if (previous.passed && has(directives, key) && !directives[key]) {
            ranges.push({
              start: line,
              end: line + 1
            });
          }
          break;
      }
    });
    return ranges;
  }
  function isFalsyPath(path, ranges) {
    // JSX some node are null
    const {
      loc
    } = path.node || {};
    return loc && ranges.some(r => loc.start.line >= r.start && loc.end.line <= r.end);
  }
  function isFalsyJSXPath(path, ranges) {
    return isFalsyPath(path.get('openingElement'), ranges) || isFalsyPath(path.get('closingElement'), ranges);
  }
  function handleJsxDirective(path, ranges) {
    if (!isFalsyJSXPath(path, ranges)) {
      return;
    }
    const child = path.get('children').find(child => child.isJSXElement() && !isFalsyPath(child, ranges));
    if (child) {
      path.replaceWith(child);
    } else {
      path.remove();
    }
  }
  function transform(path, options) {
    const ranges = getFalsyRanges(path.parent.comments, options);
    path.traverse({
      enter(path) {
        if (path.isJSXElement()) {
          return handleJsxDirective(path, ranges);
        }
        if (isFalsyPath(path, ranges)) {
          path.remove();
        }
      }
    });
  }
  function isDirective(comment, options) {
    const {
      key
    } = parseDirective(comment.node.value) || {};
    const {
      directives = {}
    } = options;
    return key && (['if', 'elif', 'elseif', 'else', 'endif'].includes(key) || has(directives, key));
  }
  function cleanDirectives(path, options) {
    const keys = ['leadingComments', 'innerComments', 'trailingComments'];
    path.traverse({
      enter(path) {
        keys.forEach(key => {
          const comments = path.get(key);
          if (Array.isArray(comments)) {
            comments.forEach(comment => isDirective(comment, options) && comment.remove());
          }
        });
      }
    });
  }
  return {
    name: 'preprocessor',
    visitor: {
      Program: {
        enter(path, state) {
          transform(path, state.opts);
        },
        exit(path, state) {
          cleanDirectives(path, state.opts);
        }
      }
    }
  };
}