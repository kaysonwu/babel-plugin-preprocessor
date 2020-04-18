import { transform } from '@babel/core';
import plugin from '../src/index';

const testPlugin = (code: string, options: object) => {
  const result = transform(code, {
    presets: ['@babel/preset-react'],
    plugins:[[plugin, options]],
    configFile: false,
  });

  return result!.code;
}

describe('Babel Preprocessor Plugin', () => {
  test('via single-Line comment', () => {
    const result = testPlugin(`
      // #if BROWSER
      console.log('This is browser');
      // #else
      console.log('It\\'s unknown');
      // #endif
    `, { symbols: { BROWSER: true } });

    expect(result).not.toMatch(/unknown/);
  });

  test('via multi-line comment', () => {
    const result = testPlugin(`
      /* #if BROWSER */
      console.log('This is browser');
      /* #else */
      console.log('It\\'s unknown');
      /* #endif */
    `, { symbols: { BROWSER: true } });

    expect(result).not.toMatch(/unknown/);
  });

  test('via JSX comment', () => {
    const result = testPlugin(`
      import React from 'react';

      export default () => {
        return (
          <div>
            {/* #if BROWSER */}
            <a>This is browser</a>
            {/* #else */}
            <a>It's unknown</a>
            {/* #endif */}
          </div>
        );
      }
    `, { symbols: { BROWSER: true } });

    expect(result).not.toMatch(/unknown/);   
  });

  test('use custom directives', () => {
    const result = testPlugin(`
      // #debug
      console.log('debug message')
      // #warning
      console.warn('warning message')
    `, { directives: { debug: false, warning: true } });

    expect(result).not.toMatch(/console\.log/);   
    expect(result).toMatch(/console\.warn/);   
  });

  test('custom directives do not affect the next line', () => {
    const result = testPlugin(`
      // #debug
      console.log('debug message')
      doSome();
    `, { directives: { debug: false } });

    expect(result).toMatch(/doSome/);   
  });

  test('should be webpack-preprocessor-loader compatible', () => {
    const result = testPlugin(`
      // #!if BROWSER
      console.log('This is browser');
      // #!else
      console.log('It\\'s unknown');
      // #!endif
    `, { symbols: { BROWSER: true } });

    expect(result).not.toMatch(/unknown/);
  });

  test('without directives', () => {
    const result = testPlugin(`
      /* #if BROWSER */
      console.log('This is browser');
      /* #endif */
      // #debug
      console.log('debug message')
      // #warning
      console.warning('warning message')
    `, { symbols: { BROWSER: false }, directives: { debug: false, warning: true } });

    expect(result).not.toMatch(/BROWSER/);
    expect(result).not.toMatch(/#(debug|warning)/);
  });
});
