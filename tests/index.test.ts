import { transform } from '@babel/core';
import plugin from '../src/index';

const testPlugin = (code: string, options: object) => {
  const result = transform(code, {
    presets: ['@babel/preset-react'],
    plugins:[[plugin, options]],
    configFile: false,
  });
  
  return result!.code!;
}

describe('Babel Preprocessor Plugin', () => {
  test('via single-Line comment', () => {
    const result = testPlugin(`
      // #if IS_BROWSER
      console.log('This is browser');
      // #else
      console.log('It\\'s unknown');
      // #endif
    `, { symbols: { IS_BROWSER: true } });

    expect(result).toMatch(/This is browser/);
    expect(result).not.toMatch(/unknown/);
  });

  test('via multi-line comment', () => {
    const result = testPlugin(`
      /* #if IS_BROWSER */
      console.log('This is browser');
      /* #else */
      console.log('It\\'s unknown');
      /* #endif */
    `, { symbols: { IS_BROWSER: true } });

    expect(result).toMatch(/This is browser/);
    expect(result).not.toMatch(/unknown/);
  });

  test('via JSX comment', () => {
    const result = testPlugin(`
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
    `, { symbols: { IS_BROWSER: false }, directives: { debug: false } });

    expect(result).not.toMatch(/(fallback|should)/);   
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
      // #!if IS_BROWSER
      console.log('This is browser');
      // #!else
      console.log('It\\'s unknown');
      // #!endif
    `, { symbols: { IS_BROWSER: true } });

    expect(result).toMatch(/This is browser/);
    expect(result).not.toMatch(/unknown/);
  });

  test('with complex conditions', () => {
    const result = testPlugin(`
      // #if (IE > 8 && IE < 12) || UA.startsWith('Chrome')
      console.log('Support HTML5');
      // #else
      console.log('HTML5 is not supported');
      // #endif
    `, { symbols: { IE: 8, UA: 'Chrome' } });

    expect(result).toMatch(/HTML5/);
    expect(result).not.toMatch(/supported/);
  });

  test('without directives', () => {
    const result = testPlugin(`
      /* #if IS_BROWSER */
      console.log('This is browser');
      /* #endif */
      // #debug
      console.log('debug message')
      // #warning
      console.warning('warning message')
    `, { symbols: { IS_BROWSER: false }, directives: { debug: false, warning: true } });

    expect(result).not.toMatch(/BROWSER/);
    expect(result).not.toMatch(/#(debug|warning)/);
  });

  test('Allow nested conditions', () => {
    let result: string;
    const code = `
      import React from 'react';
      import { hydrate, render } from 'react-dom';
      import { BrowserRouter } from 'react-router-dom';
      import { loadableReady } from '@loadable/component';
      import Application from '@/components/application';

      // #if target === 'browser'
      const container = document.getElementById('app');
      const element = (
        <BrowserRouter>
          <Application />
        </BrowserRouter>
      );
      
      // #debug
      console.debug(container);

      // #if SSR
      loadableReady(() => {
        hydrate(element, container);
      });
      // #else
      render(element, container);
      // #endif
      
      // #elif target === 'node'
      export default Application;
      // #else
      console.error('Invalid target');
      // #endif
    `;

    result = testPlugin(code, { symbols: { target: 'browser', SSR: true }, directives: { debug: true } });

    expect(result).toMatch(/(\.debug|hydrate\()/);
    expect(result).not.toMatch(/(render\(|export default|\.error)/);
 
    result = testPlugin(code, { symbols: { target: 'browser', SSR: false }, directives: { debug: false } });
    
    expect(result).toMatch(/render\(/);
    expect(result).not.toMatch(/(\.debug|hydrate\(|export default|\.error)/);

    result = testPlugin(code, { symbols: { target: 'node', SSR: true }, directives: { debug: true } });
    
    expect(result).toMatch(/export default/);
    expect(result).not.toMatch(/(getElementById|hydrate\(|render\(|\.error)/);
 
    result = testPlugin(code, { symbols: { target: 'unknown', SSR: false } });

    expect(result).toMatch(/\.error/);
    expect(result).not.toMatch(/(getElementById|hydrate\(|render\(|export default)/);
  });
});
