# OLDM: Object Linked Data Mapper

OLDM has the same role as an ORM for SQL data, but for Linked Data instead. It turns triples into an object graph that you can just use
in your javascript code.

It uses [JSONTag](https://github.com/muze-nl/jsontag/) to represent the meta data needed to support all features of linked data
triples.

The parse() method returns either the full graph or the specific subject requested:

```javascript
import oldmParser from '@muze-nl/oldm'
import JSONTag from '@muze-nl/jsontag'

const parser = new oldmParser({
	prefixes: {
		'ldp':    'http://www.w3.org/ns/ldp#',
	    'rdf':    'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	    'dct':    'http://purl.org/dc/terms/',
	    'stat':   'http://www.w3.org/ns/posix/stat#',
	    'turtle': 'http://www.w3.org/ns/iana/media-types/text/turtle#',
	    'schem':  'https://schema.org/',
	    'solid':  'http://www.w3.org/ns/solid/terms#',
	    'acl':    'http://www.w3.org/ns/auth/acl#',
	    'pims':   'http://www.w3.org/ns/pim/space#',
	    'vcard':  'http://www.w3.org/2006/vcard/ns#',
	    'foaf':   'http://xmlns.com/foaf/0.1/'
	}
})
const url = 'https://auke.solidcommunity.net/profile/card#me'
const response = await fetch(url)
if (!response.ok) {
	throw new Error(response.status+':'+response.statusText)
}
const text = await response.text()
const profile = parser.parse(text, url)
```

To get the full graph (an array of subjects) from the result, use the URL without a hash (#me here):

```javascript
// ... copy the same code as above here
const url = 'https://auke.solidcommunity.net/profile/card'
const response = await fetch(url)
if (!response.ok) {
	throw new Error(response.status+':'+response.statusText)
}
const text = await response.text()
const data = parser.parse(text, url)
const profile = data.index.id.get(url+'#me')
```

In both cases the profile should look like this (JSON stringified):
```json
{
        "vcard$bday":"1972-09-20",
        "vcard$fn":"Auke van Slooten",
        "vcard$hasEmail":[
            {
                "vcard$value":"mailto:auke@muze.nl"
            },
// etc...
```

Unlike JSON-LD, the profile doesn't contain meta information like '@id' or '@context'. The '@id' part is instead available through
`JSONTag.getAttribute(profile, 'id')`. Or you can use JSONTag.stringify and get this result:

```
<object id="https://auke.solidcommunity.net/profile/card#me">{
    "vcard$bday":<date>"1972-09-20",
    "vcard$fn":"Auke van Slooten",
    "vcard$hasEmail":[
        <object id="https://auke.solidcommunity.net/profile/card#id1673612033018">{
            "vcard$value":"mailto:auke@muze.nl"
        },
// etc...
```

JSON-LD uses `@context` to translate json property names (keys) to linked data predicate URI's. OLDM instead doesn't translate predicate URI's at all, it just shortens them using the prefixes you define. So `http://www.w3.org/2006/vcard/ns#bday` becomes `vcard$bday`.

Subject and Object id's are never shortened. The graph.index.id is a map with the full subject and object id's as key.

Predicate URI's are shortened by using the prefixes you defined in the options for the OLDM parser. They appear as `prefix$part` properties in the objects. You can switch this to appear as `prefix:part`, by setting the `separator` option to `":"` in the options for the parser. The reason the default is `$` is so that you can access predicates (properties) without using the ["..."] syntax. So you can type `object.vcard$bday` instead of `object["vcard:bday"]`.

XSD types in the source are translated to JSONTag types. So `"1972-09-20"^^xsd:date` is translated to `<date>"1972-09-20"`. In javascript this value is a String() object. You can get the exact type by calling JSONTag.getType:

```javascript
	const type = JSONTag.getType(profile.vcard$bday)
	// returns 'date'
```

The full list of currently supported types (and translations) is:

```javascript
{
	xsd$dateTime: '<datetime>',
	xsd$time: '<time>',
	xsd$date: '<date>',
	xsd$duration: '<duration>',
	xsd$string: '<string>',
	xsd$float: '<float>',
	xsd$decimal: '<decimal>',
	xsd$double: '<float64>',
	xsd$anyURI: '<url>',
	xsd$integer: '<int>',
	xsd$int: '<int>',
	xsd$long: '<int64>',
	xsd$short: '<int16>',
	xsd$byte: '<int8>',
	xsd$nonNegativeInteger: '<uint>',
	xsd$unsignedLong: '<uint64>',
	xsd$unsignedInt: '<uint>',
	xsd$unsignedShort: '<uint16>',
	xsd$unsignedByte: '<uint8>',
	xsd$base64Binary: '<blob class="base64">'
}
```

You can read more [about JSONTag here on github](https://github.com/muze-nl/jsontag/)

Check out a [running demo on glitch](https://glitch.com/edit/#!/triples-to-jsontag)