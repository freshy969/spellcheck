// required modules
const url           = require('url');
const cheerio       = require('cheerio');
const S             = require('string');
const async         = require('async');
const spellingFunc  = require('../spellcheck')

/**
* expose our function
**/
module.exports = exports = function(payload, fn) {

  // get the data
  var data  = payload.getData()

  // parse the url 
  var uri   = url.parse(data.url);

  // go get our content
  payload.getPageContent(function(err, content) {

    // did we get a error ?
    if(err) {

      // debug
      payload.error('Got a error trying to get the Page Content', err);

      // done
      return fn(null);

    }

    // did we find content ?
    if(S(content || '').isEmpty() === true) return fn(null);

    // load html
    var $ = cheerio.load(content || '');

    // get the page titles and create one content
    var lang = null

    // the language must be set
    if(S($('html').attr('lang') || '').isEmpty() === false)
      lang = $('html').attr('lang') || null;

    // get tlines
    var lines = content.split('\n')

    // loop all the titles .. ? You should actually only have one,
    // but we are being careful ...
    async.each($('head > title'), function(titleEL, cb) {

      // get the content
      spellingFunc.check({

          content:    spellingFunc.trim( $(titleEL).text() ).split('\n'),
          keywords:   [ uri.hostname ].concat(data.keywords || []),
          language:   lang,
          payload:    payload

        }, function(err, mistakes) {

          // did we have any error ?
          if(err) {

            // debug
            payload.error('Something went wrong getting mistakes from ASPELL', err);

            // try again
            return cb(null);

          }

          // add a rule if we have any
          if((mistakes || []).length === 0) return cb(null);

          // keep track of the last line
          var current_last_line = -1;

          // loop && add each
          for(var i = 0; i < mistakes.length; i++) {

            //get the local reference
            var mistake = mistakes[i];

            // get the code
            var build = payload.getSnippetManager().build(

              lines, 
              current_last_line, 
              function(line) {
              
                return line.indexOf(mistake.word) != -1 && 
                        line.toLowerCase().indexOf('<title') != -1;

              }

            );

            // sanity check
            if(!build) continue;

            // set the line
            current_last_line = build.subject;

            // build the message
            var message     =       '$ was not recognised';
            var identifiers =       [ mistake.word ];

            // check if the token is defined
            if(mistake.token) {

              message       = '$ in $ was not recognised';
              identifiers   = [ mistake.token, mistake.word ];

            }

            // add it
            payload.addRule({

                key:          'title',
                message:      'Spelling mistake in document title',
                type:         'error'

              }, {

                code:         build,
                display:      'code',
                message:      message,
                identifiers:  identifiers,
                tools:        ['dictionary.add']

              });

          }

          cb(null)

        });

    }, function() {

      fn(null);

    });

  });

};
