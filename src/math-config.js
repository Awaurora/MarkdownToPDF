window.MathJax = {
  startup: {typeset: false},
  loader: {load: []},
  options: {enableMenu: false},
  tex: {
    packages: ['base', 'ams', 'newcommand', 'configmacros', 'color'],
    maxBuffer: 100000,
    maxMacros: 1000,
    macros: {N:'\\mathbb{N}', Z:'\\mathbb{Z}', Q:'\\mathbb{Q}', R:'\\mathbb{R}', C:'\\mathbb{C}', larr:'\\leftarrow', rarr:'\\rightarrow'}
  },
  svg: {fontCache: 'none', scale: 1, mtextInheritFont: true}
};
