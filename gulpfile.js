var fontName = 'seti',
  gulp = require('gulp'),
  iconfont = require('gulp-iconfont'),
  svgmin = require('gulp-svgmin'),
  fs = require('node:fs')

exports.font = function font() {
  return gulp
    .src(['./seti-ui/icons/*.svg'])
    .pipe(
      iconfont({
        normalize: true,
        fontHeight: 1000,
        fontName: fontName,
        formats: ['woff2']
      }).on('glyphs', glyphs => {
        const glyphsString = glyphs
          .map(
            glyph =>
              `${glyph.name}:\\${glyph.unicode[0].codePointAt(0).toString(16).toUpperCase()}\n`
          )
          .join('')
        fs.writeFileSync('./seti-ui/fonts/seti.txt', glyphsString, 'utf8')
      })
    )
    .pipe(gulp.dest('./seti-ui/fonts/seti/'))
}

exports.svg = function svg() {
  return gulp
    .src('./seti-ui/icons/*.svg')
    .pipe(svgmin())
    .pipe(gulp.dest('./seti-ui/icons'))
}

exports.icons = gulp.series([exports.svg, exports.font])
