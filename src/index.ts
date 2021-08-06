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

    const scanDirective = (start: number, parent: string | null, retained: boolean, previous: number) => {
      let i: number;
      for (i = start; i < comments.length; i++) {
        const { value, loc: { start: { line } } } = comments[i];
        const directive = parseDirective(value);
  
        if (directive === false) {
          continue;
        }

        const { key, code } = directive;
        
        // If code blocks are retained, we test sub code blocks.
        if (retained) {

          if (has(directives, key)) {
            if (!directives[key]) {
              ranges.push({ start: line, end: line + 1 });
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
          }

          // if - elseif、if - else、if - endif
          ranges.push({ start: previous, end: line });

        } else if (key === 'endif') {

          // Skip if block
          if (parent === null) {
            return i;
          }

          // if - endif、elseif - endif、else - endif
          ranges.push({ start: previous, end: line });
        }
      }

      return i;
    };

    scanDirective(0, 'if', true, 0);

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
