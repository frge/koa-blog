const T_FUNCTION = /(\w+)(\s*)\((.*)\)/;// foo(){}
const T_PROPERTY = /(.*)\s*=\s*(.*)\n/;// foo = 'some variable'
const T_CLASS_DEFINITION = /(.*)class\s+(\w+)?\s+(extends\s+(\w+))?/;// class MyClass extends Parent
const T_CONSTRUCTOR_FUNCTION = /constructor\((.*?)\)/;// constructor(){}

const attrPatterns = [
  /^\s+/, // whitespace
  /^[^\s]+/ // word
];

let vm;

function setvm(_vm) {
  if (!_vm.createContext) throw new TypeError('bad vm, need "vm.createContext"');
  if (!_vm.runInContext) throw new TypeError('bad vm, need "vm.runInContext"');
  vm = _vm;
}

/**
 * Tokenize a string into each of it's parts
 *
 * @param {String} src
 * @returns {Array}
 */
function tokenize(src) {
  let source = src;

  const tokens = [];
  const regexQueue = [];

  attrPatterns.forEach((re) => {
    regexQueue.push(function () {
      const result = re.exec(source);
      if (result) {
        tokens.push(result[0]);
        source = source.substring(result[0].length);
        return true;
      }
      return false;
    });
  });

  while (source) {
    regexQueue.some(element => element());
  }

  return tokens;
}

/**
 * Convert a string of annotation attributes into
 * a hash of actual javascript values
 *
 * @param {String} string
 * @param {Object} vm
 * @return {Object}
 */
function parseAttr(string, vm) {
  const tokens = tokenize(string);
  let fixedString = '';

  if (string.indexOf('\n') === -1) {
    fixedString = string;
  } else {
    // clean up comment asterisks and line breaks
    tokens.forEach(function (token) {
      if (token.trim() !== '*') {
        fixedString += token.replace('\n', '');
      }
    });
  }

  // split all commas
  const parts = fixedString.split(',');

  let isContinue = true;
  let i = parts.length - 1;

  const fixed = [];

  while (isContinue) {
    let part = parts[i];

    let isArray = false;
    let isObject = false;
    let isAnnotation = false;

    // check for annotation, array, or object close
    if (part.trim().substr(part.trim().length - 1) === ')' && !part.trim().match(/(.*)=@\(/)) {
      isAnnotation = true;
    } else if (part.trim()[part.trim().length - 1] === ']' && !part.trim().match(/(.*)=\[/)) {
      isArray = true;
    } else if (part.trim()[part.trim().length - 1] === '}' && !part.trim().match(/(.*)=\{/)) {
      isObject = true;
    }

    // if this is an annotation, array, or object, combine original string until
    // the start of the target type
    if (isArray || isObject || isAnnotation) {
      let temp = part;
      let found = false;

      // re-combine array into one piece
      while (!found) {
        if (--i < 0) {
          break;
        }

        part = parts[i];
        temp = part + ',' + temp;

        if ((isArray && part.trim().match(/(.*)=\[/)) ||
          (isObject && part.trim().match(/(.*)=\{/)) ||
          (isAnnotation && part.trim().match(/(.*)=@(.*)\(/))) {
          found = true
        }
      }

      fixed.unshift(temp)
    } else {
      fixed.unshift(part)
    }

    if (--i < 0) {
      isContinue = false;
    }
  }

  const args = {};
  i = 0;

  fixed.forEach(function (token) {
    let arg;
    let value;

    // check for single values (no key=value)
    if (i === 0 && token.trim().indexOf('=') === -1) {
      arg = 'value';
      value = token.trim();
    } else {
      // split token on first equals, while maintaining the rest of the string
      const split = token.split(/=/);
      arg = split.shift().replace(/"/g, '');
      value = split.join('=').trim();
    }

    // check for array of annotations
    // @todo - this probably won't work too well if there is whitespace
    // run code in context
    const sandbox = {};// globalContext;
    sandbox.__v__ = null;
    vm.createContext(sandbox);
    vm.runInContext('__v__ = ' + value, sandbox);
    args[arg.trim()] = sandbox.__v__;

    i++;
  }, this);

  return args;
}

function parseComment(comment) {
  const ss = new Scanner(comment);
  const annotations = [];

  while (!ss.eos()) {
    // check if there are anymore annotations to find
    if (ss.scanUntil(/@/) === null) {
      break;
    }

    let annotation = null;
    let parameters = null;

    // check if this is an annotation with parameters
    const annotationCheck = ss.checkUntil(/\(/);

    // went to a next line, so it doesn't have parameters
    if (annotationCheck === null || annotationCheck.match(/\n/)) {
      annotation = ss.scanUntil(/\n/);
      annotation = annotation.trim('\n');
    }
    // has parameters
    else {
      annotation = ss.scanUntil(/\(/);
      annotation = annotation.substring(0, annotation.length - 1);

      let done = false;

      parameters = '';

      while (!done) {
        const scan = ss.scanUntil(/\)/g);
        if (scan === null) {
          done = true;
        } else {
          parameters += scan;
          const open = parameters.match(/\(/) === null ? 1 : parameters.match(/\(/g).length + 1;
          const close = parameters.match(/\)/) === null ? 0 : parameters.match(/\)/g).length;
          if (open === close) done = true;
        }
      }

      parameters = parameters.substring(0, parameters.length - 1);
      parameters = parseAttr(parameters, vm);
    }

    annotations.push({
      annotation,
      parameters
    });
  }

  return annotations;
}

function parse(source) {
  // normalize line breaks to fix issues with CRLF
  source = source.replace(/\r/gm, '');

  const ss = new Scanner(source);
  const stack = [];

  let metadata = new Metadata();
  let foundConstructor = false;
  let className = null;

  const append = (create = true) => {
    if (!metadata.isValid) return;
    if (metadata.definition) stack.push(metadata);
    if (create) metadata = new Metadata();
  };

  while (!ss.eos()) {
    const cs = ss.scanUntil(/\/\*\*/);
    if (cs == null) break;
    const csp = ss.pointer() - 3;// 注释开始位置
    ss.scanUntil(/\*\/\n/);
    const cep = ss.pointer();// 注释结束位置
    const comment = source.substring(csp, cep);
    const nextLine = ss.scanUntil(/\n/);

    if (nextLine === null || nextLine.trim() === '') {
      continue;
    }

    const lineNumber = source.substring(0, csp).split('\n').length;

    // class
    let match = nextLine.match(T_CLASS_DEFINITION);
    if (match != null) {
      append(metadata);
      className = match[2];
      metadata.setDefinition(lineNumber, comment, className);
      continue;
    }

    // constructor
    if (!foundConstructor && (match = nextLine.match(T_CONSTRUCTOR_FUNCTION))) {
      const args = match[1] !== '' ? match[1].split(',').map(arg => arg.trim()) : null;
      metadata.setConstructor(lineNumber, comment, className, args);
    }

    // foo() {}
    if ((match = nextLine.match(T_FUNCTION)) != null) {
      const args = match[3] ? match[3].split(',').map(arg => arg.trim()) : null;
      metadata.setMethod(lineNumber, comment, className, match[1], args);
      continue;
    }

    if ((match = nextLine.match(T_PROPERTY)) != null) {
      const name = match[1].replace('this.', '').trim().split(':')[0];
      metadata.setProperty(lineNumber, comment, className, name, match[3]);
    }
  }

  append(false);

  return stack;
}

class Scanner {
  constructor(str) {
    this.str = str;
    this.pos = 0;
    this.match = null;
  }

  eos() {
    return this.pos === this.str.length;
  }

  pointer() {
    return this.pos;
  }

  scanUntil(pattern) {
    const chk = this.checkUntil(pattern);
    if (chk != null) this.pos += chk.length;
    return chk;
  }

  checkUntil(pattern) {
    const patternPos = this.str.substr(this.pos).search(pattern);

    if (patternPos < 0) {
      this.match = null;
      return null;
    }

    const matches = this.str.substr(this.pos + patternPos).match(pattern);
    this.match = this.str.substr(this.pos, patternPos) + matches[0];
    return this.match;
  }
}

class Metadata {
  constructor() {
    this.definition = null;
    this.constructor = null;
    this.methods = [];
    this.properties = [];
    this.isValid = false;
  }

  setDefinition(line, comment, name) {
    const annotation = parseComment(comment);
    this.definition = {line, comment, name, annotation};
    this.isValid = true;
  }

  setConstructor(line, comment, className, args) {
    const annotation = parseComment(comment);
    this.constructor = {line, comment, className, args, annotation};
    this.isValid = true;
  }

  setMethod(line, comment, className, name, args) {
    const annotation = parseComment(comment);
    this.methods.push({line, comment, className, name, args, annotation});
    this.isValid = true;
  }

  setProperty(line, comment, className, name, body) {
    const annotation = parseComment(comment);
    this.properties.push({line, comment, className, name, body, annotation});
    this.isValid = true;
  }
}

exports.parse = parse;
exports.setvm = setvm;
