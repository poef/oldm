import oldm from './oldm.js'
import JSONTag from 'https://cdn.jsdelivr.net/npm/@muze-nl/jsontag@0.9.3/src/JSONTag.mjs'
import * as metro from 'https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.3.3/src/metro.mjs'

const output = document.getElementById('output')
const form = document.getElementById('load')
form.addEventListener('submit', (e) => {
  e.preventDefault()
  load(form.url.value)
})

const parser = oldm.parser({
    'ldp': 'http://www.w3.org/ns/ldp#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'dct': 'http://purl.org/dc/terms/',
    'stat': 'http://www.w3.org/ns/posix/stat#',
    'turtle': 'http://www.w3.org/ns/iana/media-types/text/turtle#',
    'schem':'https://schema.org/',
    'solid': 'http://www.w3.org/ns/solid/terms#',
    'acl': 'http://www.w3.org/ns/auth/acl#',
    'pims': 'http://www.w3.org/ns/pim/space#',
    'vcard':'http://www.w3.org/2006/vcard/ns#',
    'foaf': 'http://xmlns.com/foaf/0.1/'
  },window.N3)

const client = metro.client({
    headers: {
      'Accept':'text/turtle'
    }
  })
  .with(async (req, next) => {
    let res = await next(req)
    if (!res.ok) {
      throw new Error(res.status+': '+res.statusMessage)
    }
    let text = await res.text()
    //TODO: check if format is supported by N3
    return parser.parse(text, req.url)
  })

async function load(url) {
  form.url.value = url
  let data
  try {
    data = await client.get(url)
  } catch(e) {
    data = e.message
    console.error(e)
  }
  output.innerText = JSONTag.stringify(data, null, 4)
  console.log(data)
}

load('https://auke.solidcommunity.net/profile/card')