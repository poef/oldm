import tap from 'tap'
import parser from '../src/oldm.mjs'
import JSONTag from '@muze-nl/jsontag'

tap.test('get graph', t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.

:me 
	a schema:Person;
	vcard:fn "Auke van Slooten" .`
	let oldmParser = parser({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		}
	})
	let data = oldmParser.parse(turtle, 'https://auke.solidcommunity.net/profile/card')
	t.same(''+data[0].vcard$fn, 'Auke van Slooten')
	t.end()
})

tap.test('get subject', t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.

:me 
	a schema:Person;
	vcard:fn "Auke van Slooten" .`
	let oldmParser = parser({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		}
	})
	let data = oldmParser.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me')
	t.same(''+data.vcard$fn, 'Auke van Slooten')
	t.end()
})

tap.test('two graphs merging', t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.

:me 
	a schema:Person;
	vcard:fn "Auke van Slooten" .`
	let turtle2 = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

<https://auke.solidcommunity.net/profile/card#me>
	a foaf:Person;
	vcard:organization-name "Muze".
`
	let oldmParser = parser({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		}
	})
	let data = oldmParser.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me')
	let added = oldmParser.parse(turtle2, 'https://example.com/')
	t.same(''+data.vcard$fn, 'Auke van Slooten')
	t.same(''+data['vcard$organization-name'], 'Muze')
	t.end()
})

tap.test('separator', t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.

:me 
	a schema:Person;
	vcard:fn "Auke van Slooten" .`
	let oldmParser = parser({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		},
		separator: ':'
	})
	let data = oldmParser.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me')
	t.same(''+data['vcard:fn'], 'Auke van Slooten')
	//TODO: check xsdTypes
	t.end()	
})

// next test: data.addPredicate('prop','value','https://example.com/')
// and convert graph back to triples (toString?)

tap.test('xsdtypes', t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

:me 
	a schema:Person;
	vcard:bday "1972-09-20"^^xsd:date;
 	vcard:fn "Auke van Slooten" .`
	let oldmParser = parser({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		},
//		separator: ':'
	})
	let data = oldmParser.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me')
	t.same(''+data.vcard$bday, '1972-09-20')
	t.same(JSONTag.getType(data.vcard$bday), 'date')

	oldmParser = parser({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		},
		separator: ':'
	})
	data = oldmParser.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me')
	t.same(''+data['vcard:bday'], '1972-09-20')
	t.same(JSONTag.getType(data['vcard:bday']), 'date')
	t.end()	
})