var fontName = 'seti',
  gulp = require('gulp'),
  iconfont = require('gulp-iconfont'),
  iconfontCss = require('gulp-iconfont-css'),
  svgmin = require('gulp-svgmin');

exports.font = function font () {
  return gulp.src(['./seti-ui/icons/*.svg'])
    .pipe(iconfontCss({
      fontName: fontName,
      path: './seti-ui/styles/_fonts/_template.txt',
      targetPath: '../seti.txt',
      fontPath: './seti-ui/styles/_fonts/seti/'
    }))
    .pipe(iconfont({
      normalize: true,
      fontHeight: 1000,
      fontName: fontName,
      formats: ['woff']
    }))
    .pipe(gulp.dest('./seti-ui/styles/_fonts/seti/'));
};

exports.svg = function svg () {
  return gulp.src('./seti-ui/icons/*.svg')
    .pipe(svgmin())
    .pipe(gulp.dest('./seti-ui/icons'));
};

exports.icons = gulp.series([exports.svg, exports.font]);
