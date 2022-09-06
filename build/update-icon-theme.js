'use strict'

const fs = require('fs')
const minimatch = require('minimatch')
const fetch = require('node-fetch-native')
const { execSync } = require('child_process')
const PQueue = require('p-queue').default

const vscodeVersion = '1.71.0'

// list of languagesId not shipped with VSCode. The information is used to associate an icon with a language association
// Please try and keep this list in alphabetical order! Thank you.
const nonBuiltInLanguages = {
  // { fileNames, extensions  }
  argdown: { extensions: ['ad', 'adown', 'argdown', 'argdn'] },
  bicep: { extensions: ['bicep'] },
  elixir: { extensions: ['ex'] },
  elm: { extensions: ['elm'] },
  erb: { extensions: ['erb', 'rhtml', 'html.erb'] },
  'github-issues': { extensions: ['github-issues'] },
  gradle: { extensions: ['gradle'] },
  godot: { extensions: ['gd', 'godot', 'tres', 'tscn'] },
  haml: { extensions: ['haml'] },
  haskell: { extensions: ['hs'] },
  haxe: { extensions: ['hx'] },
  jinja: { extensions: ['jinja'] },
  kotlin: { extensions: ['kt'] },
  mustache: { extensions: ['mustache', 'mst', 'mu', 'stache'] },
  nunjucks: {
    extensions: ['nunjucks', 'nunjs', 'nunj', 'nj', 'njk', 'tmpl', 'tpl']
  },
  ocaml: { extensions: ['ml', 'mli', 'mll', 'mly', 'eliom', 'eliomi'] },
  puppet: { extensions: ['puppet'] },
  r: { extensions: ['r', 'rhistory', 'rprofile', 'rt'] },
  rescript: { extensions: ['res', 'resi'] },
  sass: { extensions: ['sass'] },
  stylus: { extensions: ['styl'] },
  terraform: { extensions: ['tf', 'tfvars', 'hcl'] },
  todo: { fileNames: ['todo'] },
  vala: { extensions: ['vala'] },
  vue: { extensions: ['vue'] }
}

// list of languagesId that inherit the icon from another language
const inheritIconFromLanguage = {
  json5: 'json',
  jsonc: 'json',
  postcss: 'css',
  'django-html': 'html',
  blade: 'php',
  gitignore: 'git-commit',
  'git-commit': 'git-commit',
  'git-rebase': 'git-commit'
}

const font = './seti-ui/fonts/seti/seti.woff2'
const fontMappingsFile = './seti-ui/fonts/seti.txt'
const fileAssociationFile = './seti-ui/mapping.txt'
const colorsFile = './seti-ui/colors.txt'

function getCommitSha() {
  return execSync('git rev-parse HEAD').toString().trim()
}

async function download(source) {
  const res = await fetch(source)
  return await res.text()
}

function darkenColor(color) {
  let res = '#'
  for (let i = 1; i < 7; i += 2) {
    const newVal = Math.round(parseInt('0x' + color.slice(i, i + 2), 16) * 0.9)
    const hex = newVal.toString(16)
    if (hex.length === 1) {
      res += '0'
    }
    res += hex
  }
  return res
}

function mergeMapping(to, from, property) {
  if (from[property]) {
    if (to[property]) {
      to[property].push(...from[property])
    } else {
      to[property] = from[property]
    }
  }
}

async function getLanguageMappings() {
  try {
    const content = fs.readFileSync(
      `./.lang-mapping.${vscodeVersion}.json`,
      'utf-8'
    )
    return JSON.parse(content)
  } catch {}

  const res = JSON.parse(
    await download(
      `https://api.github.com/repos/microsoft/vscode/contents/extensions?ref=${vscodeVersion}`
    )
  )

  const queue = new PQueue({ concurrency: 4, interval: 20 })
  const allContent = await Promise.all(
    res
      .filter(r => r.type === 'dir')
      .map(async r => {
        const dirPath = `https://raw.githubusercontent.com/microsoft/vscode/${vscodeVersion}/extensions/${r.name}/package.json`
        const content = await queue.add(() => download(dirPath))
        console.log('fetching:', r.name)
        return content
      })
  )

  const langMappings = {}
  for (let i = 0; i < allContent.length; i++) {
    const content = allContent[i]
    if (content === '404: Not Found') continue

    const jsonContent = JSON.parse(content)
    const languages =
      jsonContent.contributes && jsonContent.contributes.languages
    if (Array.isArray(languages)) {
      for (let k = 0; k < languages.length; k++) {
        const languageId = languages[k].id
        if (languageId) {
          const extensions = languages[k].extensions
          const mapping = {}
          if (Array.isArray(extensions)) {
            mapping.extensions = extensions.map(function (e) {
              return e.slice(1).toLowerCase()
            })
          }
          const filenames = languages[k].filenames
          if (Array.isArray(filenames)) {
            mapping.fileNames = filenames.map(function (f) {
              return f.toLowerCase()
            })
          }
          const filenamePatterns = languages[k].filenamePatterns
          if (Array.isArray(filenamePatterns)) {
            mapping.filenamePatterns = filenamePatterns.map(function (f) {
              return f.toLowerCase()
            })
          }
          const existing = langMappings[languageId]

          if (existing) {
            // multiple contributions to the same language
            // give preference to the contribution wth the configuration
            if (languages[k].configuration) {
              mergeMapping(mapping, existing, 'extensions')
              mergeMapping(mapping, existing, 'fileNames')
              mergeMapping(mapping, existing, 'filenamePatterns')
              langMappings[languageId] = mapping
            } else {
              mergeMapping(existing, mapping, 'extensions')
              mergeMapping(existing, mapping, 'fileNames')
              mergeMapping(existing, mapping, 'filenamePatterns')
            }
          } else {
            langMappings[languageId] = mapping
          }
        }
      }
    }
  }
  for (const languageId in nonBuiltInLanguages) {
    langMappings[languageId] = nonBuiltInLanguages[languageId]
  }
  fs.writeFileSync(
    `.lang-mapping.${vscodeVersion}.json`,
    JSON.stringify(langMappings),
    'utf-8'
  )
  return langMappings
}

async function update() {
  console.log('Reading from ' + fontMappingsFile)
  const def2Content = {}
  const ext2Def = {}
  const fileName2Def = {}
  const def2ColorId = {}
  const colorId2Value = {}
  const lang2Def = {}

  function writeFileIconContent(commitSha) {
    const iconDefinitions = {}
    const allDefs = Object.keys(def2Content).sort()

    for (let i = 0; i < allDefs.length; i++) {
      const def = allDefs[i]
      const entry = { fontCharacter: def2Content[def] }
      const colorId = def2ColorId[def]
      if (colorId) {
        const colorValue = colorId2Value[colorId]
        if (colorValue) {
          entry.fontColor = colorValue

          const entryInverse = {
            fontCharacter: entry.fontCharacter,
            fontColor: darkenColor(colorValue)
          }
          iconDefinitions[def + '_light'] = entryInverse
        }
      }
      iconDefinitions[def] = entry
    }

    function getInvertSet(input) {
      const result = {}
      for (const assoc in input) {
        const invertDef = input[assoc] + '_light'
        if (iconDefinitions[invertDef]) {
          result[assoc] = invertDef
        }
      }
      return result
    }

    const res = {
      information_for_contributors: [
        'This file is auto generated. See build/update-icon-theme.js'
      ],
      fonts: [
        {
          id: 'seti',
          src: [{ path: './seti.woff2', format: 'woff2' }],
          weight: 'normal',
          style: 'normal',
          size: '150%'
        }
      ],
      iconDefinitions: iconDefinitions,
      //	folder: "_folder",
      file: '_default',
      fileExtensions: ext2Def,
      fileNames: fileName2Def,
      languageIds: lang2Def,
      light: {
        file: '_default_light',
        fileExtensions: getInvertSet(ext2Def),
        languageIds: getInvertSet(lang2Def),
        fileNames: getInvertSet(fileName2Def)
      },
      version: commitSha
    }

    const path = './icons/sapphicon-theme.json'
    fs.writeFileSync(path, JSON.stringify(res, null, '\t'))
    console.log('written ' + path)
  }

  let match

  const fontMappingsContent = fs.readFileSync(fontMappingsFile, 'utf8')
  const contents = {}
  for (const line of fontMappingsContent.trim().split('\n')) {
    const [match1, match2] = line.split(':')
    contents[match1] = match2
  }

  const fileAssociationContent = fs.readFileSync(fileAssociationFile, 'utf8')
  const regex2 = /^\(['"]([-\w\.+]+)['"],\s*['"]([-\w]+)['"],\s*(@[-\w]+)\)$/
  for (const line of fileAssociationContent.split('\n')) {
    const match = line.match(regex2)
    if (!match) continue

    const pattern = match[1]
    let def = '_' + match[2]
    const colorId = match[3]
    let storedColorId = def2ColorId[def]
    let i = 1
    while (storedColorId && colorId !== storedColorId) {
      // different colors for the same def?
      def = `_${match[2]}_${i}`
      storedColorId = def2ColorId[def]
      i++
    }
    if (!def2ColorId[def]) {
      def2ColorId[def] = colorId
      def2Content[def] = contents[match[2]]
    }

    if (def === '_default') {
      continue // no need to assign default color.
    }
    if (pattern[0] === '.') {
      ext2Def[pattern.slice(1).toLowerCase()] = def
    } else {
      fileName2Def[pattern.toLowerCase()] = def
    }
  }

  const langMappings = await getLanguageMappings()
  // replace extensions for languageId
  for (let lang in langMappings) {
    const mappings = langMappings[lang]
    const exts = mappings.extensions || []
    const fileNames = mappings.fileNames || []
    const filenamePatterns = mappings.filenamePatterns || []
    let preferredDef = null
    // use the first file extension association for the preferred definition
    for (let i1 = 0; i1 < exts.length && !preferredDef; i1++) {
      preferredDef = ext2Def[exts[i1]]
    }
    // use the first file name association for the preferred definition, if not availbale
    for (let i1 = 0; i1 < fileNames.length && !preferredDef; i1++) {
      preferredDef = fileName2Def[fileNames[i1]]
    }
    for (let i1 = 0; i1 < filenamePatterns.length && !preferredDef; i1++) {
      let pattern = filenamePatterns[i1]
      for (const name in fileName2Def) {
        if (minimatch(name, pattern)) {
          preferredDef = fileName2Def[name]
          break
        }
      }
    }
    if (preferredDef) {
      lang2Def[lang] = preferredDef
      if (!nonBuiltInLanguages[lang] && !inheritIconFromLanguage[lang]) {
        for (let i2 = 0; i2 < exts.length; i2++) {
          // remove the extension association, unless it is different from the preferred
          if (ext2Def[exts[i2]] === preferredDef) {
            delete ext2Def[exts[i2]]
          }
        }
        for (let i2 = 0; i2 < fileNames.length; i2++) {
          // remove the fileName association, unless it is different from the preferred
          if (fileName2Def[fileNames[i2]] === preferredDef) {
            delete fileName2Def[fileNames[i2]]
          }
        }
        for (let i2 = 0; i2 < filenamePatterns.length; i2++) {
          let pattern = filenamePatterns[i2]
          // remove the filenamePatterns association, unless it is different from the preferred
          for (const name in fileName2Def) {
            if (
              minimatch(name, pattern) &&
              fileName2Def[name] === preferredDef
            ) {
              delete fileName2Def[name]
            }
          }
        }
      }
    }
  }
  for (const lang in inheritIconFromLanguage) {
    const superLang = inheritIconFromLanguage[lang]
    const def = lang2Def[superLang]
    if (def) {
      lang2Def[lang] = def
    } else {
      console.log(
        'skipping icon def for ' +
          lang +
          ': no icon for ' +
          superLang +
          ' defined'
      )
    }
  }

  const colorsContent = fs.readFileSync(colorsFile, 'utf8')
  for (const line of colorsContent.split('\n')) {
    if (line.startsWith('//') || line.trim() === '') continue
    const [name, value] = line.trim().split(':')
    colorId2Value['@' + name.trim()] = value.trim()
  }

  const commitSha = getCommitSha()
  try {
    writeFileIconContent(commitSha)

    console.log('Updated')
  } catch (e) {
    console.error(e)
  }
}

fs.copyFileSync(font, './icons/seti.woff2')
update()
