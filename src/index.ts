import { runInNewContext } from 'vm';
import { PluginObj } from '@babel/core';
import { NodePath } from '@babel/traverse';
import { Program, File, Comment, JSXElement } from '@babel/types';

interface PluginOptions {
  symbols: Record<string, any>;
  directives: Record<string, boolean>;
}

interface Range {
  start: number;
  end: number;
}

const IF = ['if', 'elif', 'elseif'];

function evalDirective(code: string, symbols: Record<string, any>) {
  try {
    const context = { ...symbols };
    return runInNewContext(`(function(){ return (${code}); })()`, context);
  } catch { /* ignore error */ }
  
  return false;
}

function has(object: any, key: string | number | symbol) {
  return object && Object.prototype.hasOwnProperty.call(object, key);
}

export default function() {

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
    const { directives, symbols } = options;
    const ranges: Range[] = [];
    let prev: number | false = false;

    for (let comment of comments) {
      let { value, loc: { start: { line: start } } } = comment;
      let directive = parseDirective(value);

      if (!directive) continue;

      let { key, code } = directive;

      if (has(directives, key)) {
        if (!directives[key]) {
          ranges.push({ start, end: start + 1 });
        }
      } else if (IF.includes(key)) {
        prev = evalDirective(code, symbols) ? false : start;
      } else if (key === 'else' || key === 'endif') {
        if (prev) {
          ranges.push({ start: prev, end: start });
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

  function isFalsyPath(path: NodePath, ranges: Range[]) {
    // JSX some node are null
    const { loc } = path.node || {};
    return loc && ranges.some(r => (loc.start.line >= r.start && loc.end.line <= r.end));
  }

  function isFalsyJSXPath(path: NodePath<JSXElement>, ranges: Range[]) {
    return isFalsyPath(path.get('openingElement') as NodePath, ranges)
      || isFalsyPath(path.get('closingElement') as NodePath, ranges);
  }

  function handleJsxDirective(path: NodePath<JSXElement>, ranges: Range[]) {
    if (!isFalsyJSXPath(path, ranges)) return;

    const child = path.get('children').find(
      child => child.isJSXElement() && !isFalsyPath(child as any, ranges)
    ) as NodePath;

    if (child) {
      path.replaceWith(child);
    } else {
      path.remove();
    }
  }

  function transform(path: NodePath<Program>, options: any) {
    const ranges = getFalsyRanges((path.parent as File).comments, options);
    path.traverse({
      enter(path) {
        if (path.isJSXElement()) {
          return handleJsxDirective(path as any, ranges);
        } 

        if (isFalsyPath(path, ranges)) {
          path.remove();
        }
      },
    });
  }

  function isDirective(comment: NodePath<Comment>, options: PluginOptions) {
    let { key } = parseDirective(comment.node.value) || {};
    return key && (
      IF.concat('else', 'endif').includes(key) || has(options.directives, key)
    );
  }

  function cleanDirectives(path: NodePath<Program>, options: any) {
    const keys = ['leadingComments', 'innerComments', 'trailingComments'];
    path.traverse({
      enter(path) {
        for (let key of keys) {
          let comments = path.get(key) as NodePath[];
   
          if (comments && comments.length > 0) {
            for (let comment of comments) {
              if (isDirective(comment as NodePath<any>, options)) {
                comment.remove();
              } 
            } 
          }
        }
      },
    });
  }

  return {
    name: 'preprocessor',
    visitor: {
      Program: {
        enter(path, state: any) {
          transform(path, state.opts);
        },
        exit(path, state: any) {
          cleanDirectives(path, state.opts);
        },
      },
    },
  } as PluginObj;
}
