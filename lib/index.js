"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _vm = require("vm");

const IF = ['if', 'elif', 'elseif'];
const VAR_NAME = /^[a-zA-Z_$][a-zA-Z0-9_$]+$/;

function evalDirective(test, symbols) {
  if (symbols) {
    try {
      const code = test.map(e => VAR_NAME.test(e) ? symbols[e] : e).join(' ');
      return (0, _vm.runInNewContext)(`(function(){ return ${code}; })()`);
    } catch (_unused) {
      /* ignore error */
    }
  }

  return false;
}

function has(object, key) {
  return object && Object.prototype.hasOwnProperty.call(object, key);
}

function _default() {
  function parseDirective(value) {
    const directive = value.trim();
    if (!directive.startsWith('#')) return false;
    const test = directive.split(/\s+/); // For compatibility with webpack-preprocessor-loader.
    // Support #!if、#if、#!IF、#IF

    const key = test.shift().replace(/^#!?/g, '').toLowerCase();
    return {
      key,
      test
    };
  }

  function getFalsyRanges(comments, options) {
    const {
      directives,
      symbols
    } = options;
    const ranges = [];
    let prev = false;

    for (let comment of comments) {
      let {
        value,
        loc: {
          start: {
            line: start
          }
        }
      } = comment;
      let directive = parseDirective(value);
      if (!directive) continue;
      let {
        key,
        test
      } = directive;

      if (has(directives, key)) {
        if (!directives[key]) {
          ranges.push({
            start,
            end: start + 1
          });
        }
      } else if (IF.includes(key)) {
        prev = evalDirective(test, symbols) ? false : start;
      } else if (key === 'else' || key === 'endif') {
        if (prev) {
          ranges.push({
            start: prev,
            end: start
          });
          prev = false;
        } else if (key === 'else') {
          prev = start;
        }
      } else {
        continue;
      }
    }

    return ranges;
  }

  function isFalsyPath(path, ranges) {
    const {
      loc
    } = path.node;
    return loc && ranges.some(r => loc.start.line >= r.start && loc.end.line <= r.end);
  }

  function transform(path, options) {
    const ranges = getFalsyRanges(path.parent.comments, options);
    path.traverse({
      enter(path) {
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