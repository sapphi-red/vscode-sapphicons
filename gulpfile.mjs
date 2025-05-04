import gulp from 'gulp'
import iconfont from 'gulp-iconfont'
import svgmin from 'gulp-svgmin'
import fs from 'node:fs'

var fontName = 'seti'

export async function font() {
  return iconfont('./seti-ui/icons/*.svg', {
    normalize: true,
    fontHeight: 1000,
    fontName: fontName,
    formats: ['woff2']
  })
    .on('glyphs', glyphs => {
      const glyphsString = glyphs
        .map(
          glyph =>
            `${glyph.name}:\\${glyph.unicode[0].codePointAt(0).toString(16).toUpperCase()}\n`
        )
        .join('')
      fs.writeFileSync('./seti-ui/fonts/seti.txt', glyphsString, 'utf8')
    })
    .pipe(gulp.dest('./seti-ui/fonts/seti/'))
}

export function svg() {
  return gulp
    .src('./seti-ui/icons/*.svg')
    .pipe(svgmin())
    .pipe(gulp.dest('./seti-ui/icons'))
}

export const icons = gulp.series([svg, font])
