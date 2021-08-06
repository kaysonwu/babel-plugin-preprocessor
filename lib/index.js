"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _vm = require("vm");

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const IF = ['if', 'elif', 'elseif'];

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
  return object && Object.prototype.hasOwnProperty.call(object, key);
}

function _default() {
  function parseDirective(value) {
    const directive = value.trim();
    if (!directive.startsWith('#')) return false; // For compatibility with webpack-preprocessor-loader.
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
      directives,
      symbols
    } = options;
    const ranges = [];

    const scanDirective = (start, parent, retained, previous) => {
      let i;

      for (i = start; i < comments.length; i++) {
        const {
          value,
          loc: {
            start: {
              line
            }
          }
        } = comments[i];
        const directive = parseDirective(value);

        if (directive === false) {
          continue;
        }

        const {
          key,
          code
        } = directive; // If code blocks are retained, we test sub code blocks.

        if (retained) {
          if (has(directives, key)) {
            if (!directives[key]) {
              ranges.push({
                start: line,
                end: line + 1
              });
            }
          } else if (parent === 'if' && key !== 'endif') {
            // Skip: elseif、else
            i = scanDirective(i + 1, key, key === 'if' ? evalDirective(code, symbols) : false, line);
          }
        } else if (key === 'if') {
          i = scanDirective(i + 1, null, false, 0);
        } else if (parent === 'if') {
          if (key === 'elif' || key === 'elseif') {
            i = scanDirective(i + 1, 'if', evalDirective(code, symbols), line);
          } else if (key === 'else' || key === 'endif') {
            // Reset status.
            retained = true;
          } else {
            continue;
          } // if - elseif、if - else、if - endif


          ranges.push({
            start: previous,
            end: line
          });
        } else if (key === 'endif') {
          // Skip if block
          if (parent === null) {
            return i;
          } // if - endif、elseif - endif、else - endif


          ranges.push({
            start: previous,
            end: line
          });
        }
      }

      return i;
    };

    scanDirective(0, 'if', true, 0);
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
    if (!isFalsyJSXPath(path, ranges)) return;
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
    let {
      key
    } = parseDirective(comment.node.value) || {};
    return key && (IF.concat('else', 'endif').includes(key) || has(options.directives, key));
  }

  function cleanDirectives(path, options) {
    const keys = ['leadingComments', 'innerComments', 'trailingComments'];
    path.traverse({
      enter(path) {
        for (let key of keys) {
          let comments = path.get(key);

          if (comments && comments.length > 0) {
            for (let comment of comments) {
              if (isDirective(comment, options)) {
                comment.remove();
              }
            }
          }
        }
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