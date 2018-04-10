const fs = require('fs');
const path = require('path');
const util = require('util');
const glob = require('glob');

/**
 * Shallow copy two objects into a new object
 *
 * Objects are merged from left to right. Thus, properties in objects further
 * to the right are preferred over those on the left.
 *
 * @param {object} obj1
 * @param {object} obj2
 * @returns {object}
 * @api private
 */

function merge(obj1, obj2) {
  let i;
  const c = {};
  let keys = Object.keys(obj2);

  for (i = 0; i !== keys.length; i++) {
    c[keys[i]] = obj2[keys[i]];
  }

  keys = Object.keys(obj1);

  for (i = 0; i !== keys.length; i++) {
    if (!c.hasOwnProperty(keys[i])) {
      c[keys[i]] = obj1[keys[i]];
    }
  }

  return c;
}


/* Capture the layout name; thanks express-hbs */
const rLayoutPattern = /{{!<\s+([A-Za-z0-9\._\-\/]+)\s*}}/;
const rPartialPattern = /{{>\s+([A-Za-z0-9\._\-\/]+)\s*}}/g;

/**
 * file reader returning a thunk
 * @param filename {String} Name of file to read
 */

function read(filename) {
  return new Promise(function (resolve, reject) {
    fs.readFile(filename, {encoding: 'utf8'}, function (err, data) {
      if (err) throw err;
      resolve(data);
    });
  });
}

/**
 * @class MissingTemplateError
 * @param {String} message The error message
 * @param {Object} extra   The value of the template, relating to the error.
 */
function MissingTemplateError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.extra = extra;
}

util.inherits(MissingTemplateError, Error);

/**
 * @class BadOptionsError
 * @param {String} message The error message
 * @param {Object} extra   Misc infomration.
 */
function BadOptionsError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.extra = extra;
}

util.inherits(BadOptionsError, Error);

class Hbs {
  /**
   * expose method to create additional instances of `Hbs`
   */

  static create() {
    return new Hbs();
  }

  /**
   * Create new instance of `Hbs`
   *
   * @api public
   */

  constructor() {
    this.handlebars = require('handlebars').create();
    this.Utils = this.handlebars.Utils;
    this.SafeString = this.handlebars.SafeString;
  }


  /**
   * Configure the instance.
   *
   * @api private
   */

  configure(options) {
    if (!options.viewPath) {
      throw new BadOptionsError('The option `viewPath` must be specified.');
    }

    // Attach options
    options = options || {};
    this.viewPath = options.viewPath || '';
    this.handlebars = options.handlebars || this.handlebars;
    this.templateOptions = options.templateOptions || {};
    this.extname = options.extname || '.hbs';
    this.partialsPath = options.partialsPath || '';
    this.contentHelperName = options.contentHelperName || 'contentFor';
    this.blockHelperName = options.blockHelperName || 'block';
    this.defaultLayout = options.defaultLayout || '';
    this.layoutsPath = options.layoutsPath || '';
    this.locals = options.locals || {};
    this.disableCache = options.disableCache != null ? options.disableCache : true;

    // Cache templates and layouts
    this.cache = {};

    this.blocks = {};

    // block helper
    this.registerHelper(this.blockHelperName, (name, options) => {
      // instead of returning this.block(name), render the default content if no
      // block is given
      val = this.block(name);
      if (val === '' && typeof options.fn === 'function') {
        val = options.fn(this);
      }

      return val;
    });

    // contentFor helper
    this.registerHelper(this.contentHelperName, (name, options) => {
      return this.content(name, options, this);
    });

    return this;
  }

  /**
   * Middleware for koa
   *
   * @api public
   */

  middleware(options) {
    this.configure(options);

    const hbs = this;

    if (hbs.partialsPath !== '') {
      hbs.registerPartials();
    }

    return async function (ctx, next) {
      ctx.render = async function (tpl, locals) {

        let theme = '';
        if (ctx.state.theme) {
          theme = ctx.state.theme + '/';
        }

        let tplPath = hbs.getTemplatePath(theme + tpl);
        let template, rawTemplate, layoutTemplate;
        let partials = [];

        if (!tplPath) {
          throw new MissingTemplateError('The template specified does not exist.', tplPath);
        }

        // allow absolute paths to be used
        if (path.isAbsolute(tpl)) {
          tplPath = tpl + hbs.extname;
        }

        locals = merge(ctx.state || {}, locals || {});
        locals = merge(hbs.locals, locals);

        // Load the template
        rawTemplate = await read(tplPath);
        hbs.cache[tpl] = {
          template: hbs.handlebars.compile(rawTemplate)
        };

        // register template partials from template
        if (hbs.partialsPath !== '' && hbs.disableCache) {
          let partial;
          while ((partial = rPartialPattern.exec(rawTemplate)) != null) {
            partials.push(partial[1] + hbs.extname);
          }
          await hbs.registerPartials(partials);
          partials = [];
        }

        // Load layout if specified
        if (typeof locals.layout !== 'undefined' || rLayoutPattern.test(rawTemplate)) {
          let layout = locals.layout;

          if (typeof layout === 'undefined') {
            layout = rLayoutPattern.exec(rawTemplate)[1];
          }

          if (layout !== false) {
            let rawLayout = await hbs.loadLayoutFile(layout);
            // register template partials from layout
            if (hbs.partialsPath !== '' && hbs.disableCache) {
              let partial;
              while ((partial = rPartialPattern.exec(rawLayout)) != null) {
                partials.push(partial[1] + hbs.extname);
              }
              await hbs.registerPartials(partials);
              partials = [];
            }

            hbs.cache[tpl].layoutTemplate = hbs.handlebars.compile(rawLayout);
          } else {
            hbs.cache[tpl].layoutTemplate = hbs.handlebars.compile('{{{body}}}');
          }
        }

        template = hbs.cache[tpl].template;
        layoutTemplate = hbs.cache[tpl].layoutTemplate;
        if (!layoutTemplate) {
          layoutTemplate = await hbs.getLayoutTemplate();
        }

        // Add the current koa context to templateOptions.data to provide access
        // to the request within helpers.
        if (!hbs.templateOptions.data) {
          hbs.templateOptions.data = {};
        }

        hbs.templateOptions.data = merge(hbs.templateOptions.data, {koa: this});

        // Run the compiled templates
        locals.body = template(locals, hbs.templateOptions);
        ctx.body = layoutTemplate(locals, hbs.templateOptions);
      };

      await next();
    }
  }

  /**
   * Get layout path
   */

  getLayoutPath(layout) {
    if (this.layoutsPath) {
      return path.join(this.layoutsPath, layout + this.extname);
    }

    return path.join(this.viewPath, layout + this.extname);
  }

  /**
   * Lazy load default layout in cache.
   */
  async getLayoutTemplate() {
    return await this.getLayout();
  }

  /**
   * Get a default layout. If none is provided, make a noop
   */

  async getLayout(layout) {
    // Create a default layout to always use
    if (!layout && !this.defaultLayout) {
      return this.handlebars.compile('{{{body}}}');
    }

    // Compile the default layout if one not passed
    if (!layout) {
      layout = this.defaultLayout;
    }

    let layoutTemplate;
    try {
      const rawLayout = await this.loadLayoutFile(layout);
      layoutTemplate = this.handlebars.compile(rawLayout);
    } catch (err) {
      console.error(err.stack);
    }

    return layoutTemplate;
  }

  /**
   * Load a layout file
   */

  async loadLayoutFile(layout) {
    const file = this.getLayoutPath(layout);
    return await read(file);
  }

  /**
   * Register helper to internal handlebars instance
   */

  registerHelper() {
    this.handlebars.registerHelper.apply(this.handlebars, arguments);
  }

  /**
   * Register partial with internal handlebars instance
   */

  registerPartial() {
    this.handlebars.registerPartial.apply(this.handlebars, arguments);
  }

  /**
   * Register directory of partials
   */

  async registerPartials(partials = []) {
    const readdir = root => {
      return new Promise(function (resolve, reject) {
        glob('**/*' + this.extname, {cwd: root}, (err, files) => {
          if (err) throw err;
          resolve(files);
        });
      });
    };

    try {
      const partialsPath = this.partialsPath;
      let resultList = [];

      if (partials.length) {
        resultList = partials;
      } else {
        resultList = await readdir(partialsPath);
      }

      if (!resultList.length) {
        return;
      }

      const files = [];
      const names = [];

      // Generate list of files and template names
      resultList.forEach(result => {
        files.push(path.join(partialsPath, result));
        names.push(result.slice(0, -1 * this.extname.length));
      });

      // Read all the partial from disk
      // var partials = await files.map(read);
      const partials = [];
      for (const key in files) {
        const partial = await read(files[key]);
        partials.push(partial);
      }

      for (let i = 0; i !== partials.length; i++) {
        this.registerPartial(names[i], partials[i]);
      }
    } catch (e) {
      console.error('Error caught while registering partials');
      console.error(e);
    }
  }

  getTemplatePathgetTemplatePath(tpl) {
    const cache = (this.pathCache || (this.pathCache = {}));

    if (cache[tpl]) {
      return cache[tpl];
    }

    const tplPath = path.join(this.viewPath, tpl + this.extname);

    try {
      fs.statSync(tplPath);
      cache[tpl] = tplPath;
      return tplPath;
    } catch (e) {
      throw e;
    }
  }

  /**
   * The contentFor helper delegates to here to populate block content
   */

  content(name, options, context) {
    // fetch block
    const block = this.blocks[name] || (this.blocks[name] = []);
    // render block and save for layout render
    block.push(options.fn(context));
  }

  /**
   * block helper delegates to this function to retreive content
   */

  block(name) {
    // val = block.toString
    const val = (this.blocks[name] || []).join('\n');
    // clear the block
    this.blocks[name] = [];
    return val;
  }
}

/**
 * expose default instance of `Hbs`
 */

module.exports = new Hbs();
