const express = require('express');
const router = express.Router();
const kuromoji = require('kuromoji');
const { toRomaji, isKana } = require('wanakana');
const path = require('path');

// Lazy-loaded kuromoji tokenizer
let _tokenizer = null
function getTokenizer() {
  if (_tokenizer) return Promise.resolve(_tokenizer)
  return new Promise((resolve, reject) => {
    const dicPath = path.join(path.dirname(require.resolve('kuromoji')), '..', 'dict')
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) return reject(err)
      _tokenizer = tokenizer
      resolve(tokenizer)
    })
  })
}

function hasNonLatin(str) {
  return str && /[^\u0000-\u024F\u1E00-\u1EFF\s\d.,\-/()#]/.test(str)
}

function romanizeText(str, tokenizer) {
  if (!str || !hasNonLatin(str)) return ''
  const tokens = tokenizer.tokenize(str)
  return tokens.map(t => {
    if (t.reading && isKana(t.reading)) return toRomaji(t.reading)
    if (isKana(t.surface_form)) return toRomaji(t.surface_form)
    return t.surface_form
  }).join('')
}

// POST /api/romanize — batch romanize texts
router.post('/', async (req, res) => {
  const { texts } = req.body
  if (!Array.isArray(texts) || texts.length === 0) {
    return res.json({ results: {} })
  }
  // Limit to 200 texts per request
  const batch = texts.slice(0, 200)
  try {
    const tokenizer = await getTokenizer()
    const results = {}
    for (const text of batch) {
      if (typeof text === 'string' && text.trim()) {
        const rom = romanizeText(text, tokenizer)
        if (rom) results[text] = rom
      }
    }
    res.json({ results })
  } catch (e) {
    console.error('Romanization error:', e.message)
    res.json({ results: {} })
  }
})

module.exports = router;
