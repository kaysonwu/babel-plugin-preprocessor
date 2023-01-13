import { runInNewContext } from 'vm';
import { PluginObj } from '@babel/core';
import { NodePath } from '@babel/traverse';
import { Program, File, Comment, JSXElement } from '@babel/types';

interface PluginOptions {
  /** 符号表 */
  symbols?: Record<string, any>;
  /** 自定义指令 */
  directives?: Record<string, boolean>;
}

interface Range {
  start: number;
  end: number;
}

interface Directive {
  /** 指令关键字 */
  key: string;
  /** 所在行号 */
  line: number;
  /** 是否通过 */
  passed: boolean | null;
  /** 指令层级 */
  level: number;
}

function evalDirective(code: string, symbols: Record<string, any>) {
  try {
    const context = { ...symbols };
    return runInNewContext(`(function(){ return (${code}); })()`, context);
  } catch {
    /* ignore error */
  }

  return false;
}

function has(object: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export default function () {
  function parseDirective(value: string) {
    const directive = value.trim();

    if (!directive.startsWith('#')) return false;

    // For compatibility with webpack-preprocessor-loader.
    // Support #!if、#if、#!IF、#IF
    const code = directive.split(/\s+/);
    const key = code.shift()!.replace(/^#!?/g, '').toLowerCase();

    return { key, code: code.join(' ') };
  }

  function getFalsyRanges(comments: Comment[], options: PluginOptions) {
    const { directives = {}, symbols = {} } = options;
    const ranges: Range[] = [];
    const tokens: Directive[] = [];

    comments.forEach((comment) => {
      const { value, loc } = comment;
      const directive = parseDirective(value);

      if (directive === false) {
        return;
      }

      const { key, code } = directive;
      const { line } = loc!.start;

      const previousIndex = tokens.length - 1;
      const previous = tokens[previousIndex] || { key: '', passed: true, level: 0 };

      switch (key) {
        case 'if':
          tokens.push({
            key,
            line,
            passed: previous.passed ? evalDirective(code, symbols) : null,
            level: previous.level + 1,
          });
          break;
        case 'elif':
        case 'elseif':
          // if-elif、if-elseif
          if (['if', 'elif', 'elseif'].includes(previous.key)) {
            if (previous.passed) {
              tokens.push({ key, line, passed: false, level: previous.level });
            } else if (previous.passed === false) {
              ranges.push({ start: previous.line, end: line });
              tokens[previousIndex] = {
                key,
                line,
                passed: evalDirective(code, symbols),
                level: previous.level,
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
                level: previous.level,
              };
            } else if (previous.passed === false) {
              ranges.push({ start: previous.line, end: line });
              tokens[previousIndex] = {
                key,
                line,
                passed: !tokens.some(token => token.passed && token.level === previous.level),
                level: previous.level,
              };
            }
          }
          break;
        case 'endif':
          if (['if', 'elif', 'elseif', 'else'].includes(previous.key)) {
            if (previous.passed === false) {
              ranges.push({ start: previous.line, end: line });
            }
            tokens.pop();
          }
          break;
        default:
          if (previous.passed && has(directives, key) && !directives[key]) {
            ranges.push({ start: line, end: line + 1 });
          }
          break;
      }
    });
  
    return ranges;
  }

  function isFalsyPath(path: NodePath, ranges: Range[]) {
    // JSX some node are null
    const { loc } = path.node || {};
    return (
      loc &&
      ranges.some((r) => loc.start.line >= r.start && loc.end.line <= r.end)
    );
  }

  function isFalsyJSXPath(path: NodePath<JSXElement>, ranges: Range[]) {
    return (
      isFalsyPath(path.get('openingElement') as NodePath, ranges) ||
      isFalsyPath(path.get('closingElement') as NodePath, ranges)
    );
  }

  function handleJsxDirective(path: NodePath<JSXElement>, ranges: Range[]) {
    if (!isFalsyJSXPath(path, ranges)) {
      return;
    }

    const child = (path.get('children') as NodePath[]).find(
      (child) => child.isJSXElement() && !isFalsyPath(child as any, ranges)
    );

    if (child) {
      path.replaceWith(child);
    } else {
      path.remove();
    }
  }

  function transform(path: NodePath<Program>, options: PluginOptions) {
    const ranges = getFalsyRanges((path.parent as File).comments!, options);
    path.traverse({
      enter(path) {
        if (path.isJSXElement()) {
          return handleJsxDirective(path as NodePath<JSXElement>, ranges);
        }

        if (isFalsyPath(path, ranges)) {
          path.remove();
        }
      },
    });
  }

  function isDirective(comment: NodePath<Comment>, options: PluginOptions) {
    const { key } = parseDirective(comment.node.value) || {};
    const { directives = {} } = options;

    return (
      key &&
      (['if', 'elif', 'elseif', 'else', 'endif'].includes(key) ||
        has(directives, key))
    );
  }

  function cleanDirectives(path: NodePath<Program>, options: PluginOptions) {
    const keys = ['leadingComments', 'innerComments', 'trailingComments'];
    path.traverse({
      enter(path) {
        keys.forEach((key) => {
          const comments = path.get(key);

          if (Array.isArray(comments)) {
            (comments as unknown as NodePath<Comment>[]).forEach(
              (comment) => isDirective(comment, options) && comment.remove()
            );
          }
        });
      },
    });
  }

  return {
    name: 'preprocessor',
    visitor: {
      Program: {
        enter(path: NodePath<Program>, state) {
          transform(path, state.opts);
        },
        exit(path: NodePath<Program>, state) {
          cleanDirectives(path, state.opts);
        },
      },
    },
  } as PluginObj;
}
