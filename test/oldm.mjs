import tap from 'tap'
import parser from '../src/oldm.mjs'

tap.test('start', t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.

:me 
	a schema:Person;
	vcard:fn "Auke van Slooten" .`
	let oldmParser = parser({
		'schema':'https://schema.org/',
		'vcard':'http://www.w3.org/2006/vcard/ns#'
	})
	let data = oldmParser.parse(turtle, 'https://auke.solidcommunity.net/profile/card')
	t.same(''+data[0].vcard$fn, 'Auke van Slooten')
	t.end()
})

