'use strict';

module.exports = function(grunt) {
  var CI = grunt.option('ci');

  var testArgs = (function() {
    var opts = ['test', 'chunk'];
    var args = {};
    opts.forEach(function(optName) {
      var opt = grunt.option(optName);
      if (opt) {
        args[optName] = '' + opt;
      }
    });
    return args;
  })();

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ''
      },
      dist: {
        src: ['node_modules/hark/hark.bundle.js', 'src/js/**/*.js'],
        dest: 'dist/awesome-collaborative-editor.all.js'
      }
    },
    html2js: {
      options: {
        module: 'op.liveconference-templates',
        singleModule: true,
        useStrict: true,
        jade: {
          doctype: 'html'
        }
      },
      main: {
        src: ['src/templates/*.jade'],
        dest: 'src/js/templates.js'
      }
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: CI && 'checkstyle',
        reporterOutput: CI && 'jshint.xml'
      },
      all: {
        src: [
          'Gruntfile.js',
          'frontend/js/**/*.js',
          'backend/**/*.js'
        ]
      },
      quick: {
        // You must run the prepare-quick-lint target before jshint:quick,
        // files are filled in dynamically.
        src: []
      }
    },
    gjslint: {
      options: {
        flags: [
          '--disable 0110',
          '--nojsdoc',
          '-e test/karma-include',
          '-x src/js/templates.js'
        ],
        reporter: {
          name: CI ? 'gjslint_xml' : 'console',
          dest: CI ? 'gjslint.xml' : undefined
        }
      },
      all: {
        src: ['<%= jshint.all.src %>']
      },
      quick: {
        src: ['<%= jshint.quick.src %>']
      }
    },
    lint_pattern: {
      options: {
        rules: [
          { pattern: /(describe|it)\.only/, message: 'Must not use .only in tests' }
        ]
      },
      all: {
        src: ['<%= jshint.all.src %>']
      },
      quick: {
        src: ['<%= jshint.quick.src %>']
      }
    },
    run_grunt: {
      all: {
        options: {
          log: true,
          stdout: function(data) {
            grunt.log.write(data);
          },
          stderr: function(data) {
            grunt.log.error(data);
          },
          args: testArgs,
          process: function(res) {
            if (res.fail) {
              grunt.config.set('esn.tests.success', false);
              grunt.log.writeln('failed');
            } else {
              grunt.config.set('esn.tests.success', true);
              grunt.log.writeln('succeeded');
            }
          }
        },
        src: ['Gruntfile-tests.js']
      },
      frontend: {
        options: {
          log: true,
          stdout: function(data) {
            grunt.log.write(data);
          },
          stderr: function(data) {
            grunt.log.error(data);
          },
          process: function(res) {
            if (res.fail) {
              grunt.config.set('esn.tests.success', false);
              grunt.log.writeln('failed');
            } else {
              grunt.config.set('esn.tests.success', true);
              grunt.log.writeln('succeeded');
            }
          },
          task: ['test-frontend']
        },
        src: ['Gruntfile-tests.js']
      }
    },
    watch: {
      files: ['src/templates/*.jade', 'src/js/*.js'],
      tasks: ['compile']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-html2js');
  grunt.loadNpmTasks('grunt-gjslint');
  grunt.loadNpmTasks('grunt-lint-pattern');
  grunt.loadNpmTasks('grunt-run-grunt');

  grunt.loadTasks('tasks');

  grunt.registerTask('test-frontend', ['run_grunt:frontend']);
  grunt.registerTask('test', ['linters', 'run_grunt:frontend']);
  grunt.registerTask('linters', 'Check code for lint', ['jshint:all', 'gjslint:all', 'lint_pattern:all']);
  grunt.registerTask('templates', ['html2js']);

  /**
   * Usage:
   *   grunt linters-dev              # Run linters against files changed in git
   *   grunt linters-dev -r 51c1b6f   # Run linters against a specific changeset
   */
  grunt.registerTask('linters-dev', 'Check changed files for lint', ['prepare-quick-lint', 'jshint:quick', 'gjslint:quick', 'lint_pattern:quick']);

  grunt.registerTask('default', ['templates', 'test', 'concat:dist']);
  grunt.registerTask('compile', ['templates', 'concat:dist']);
};
