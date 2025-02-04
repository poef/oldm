import tap from 'tap'
import oldm from '../src/oldm2.mjs'
import JSONTag from '@muze-nl/jsontag'
import n3 from 'n3'

const defaultParser = (input, uri, type) => {
	const parser = new n3.Parser({
        blankNodePrefix: '',
        format: type
    })
    let prefixes = Object.create(null) // clean object without prototype
    const quads = parser.parse(input, null, (prefix,url) => {
        prefixes[prefix] = url.id
    })
    return { quads, prefixes, factory: n3.DataFactory }
}

const defaultWriter = (source) => {
	return new Promise((resolve, reject) => {
		const writer = new n3.Writer({
			format: source.type,
			prefixes: {...source.prefixes}
		})
		const {quad, namedNode, literal, blankNode} = n3.DataFactory
		Object.entries(source.subjects).forEach(([id,subject]) => {
			id = source.shortURI(id, ':')
			const className = JSONTag.getAttribute(subject, 'class')
			console.log(id,className)
			if (className) {
				const classNames = className.split(' ')
				for(let name of classNames) {
					name = source.fullURI(name)
					writer.addQuad(quad(
						namedNode(id),
						namedNode(oldm.rdfType),
						namedNode(name)
					))
				}
			}
			Object.entries(subject).forEach(entry => {
				const predicate = entry[0]
				let object = entry[1]
				const fullPred = source.fullURI(predicate)
				if (Array.isArray(object)) {
					for (const o of object) {
						if (o && typeof o == 'object') {
							if (o.id) { //FIXME: handle blankNodes
								writer.addQuad(quad(
									namedNode(id),
									namedNode(fullPred),
									namedNode(o.id)
								))
							} else {
								let type = source.getType(o) || null
								if (object instanceof String) {
									object = ''+object
								} else if (object instanceof Number) {
									object = +object
								}
								writer.addQuad(quad(
									namedNode(id),
									namedNode(fullPred),
									literal(object, type ? namedNode(type) : null)
								))
							}
						}
					}
				} else if (object && typeof object == 'object' && object.id) {
					writer.addQuad(quad(
						namedNode(id),
						namedNode(fullPred),
						namedNode(object.id)
					))
				} else if (object) {
					let type = source.getType(object) || null
					if (object instanceof String) {
						object = ''+object
					} else if (object instanceof Number) {
						object = +object
					}
					writer.addQuad(quad(
						namedNode(id),
						namedNode(fullPred),
						literal(object, type ? namedNode(type) : null)
					))
				} else {
					console.log('weird object',object, id, predicate)
				}
			})
		})
		writer.end((error, result) => {
			if (result) {
				resolve(result)
			} else {
				reject(error)
			}
		})
	})
}

/*
tap.test('get graph', t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.

:me 
	a schema:Person;
	vcard:fn "Auke van Slooten" .`
	const context = oldm({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		},
		parser: defaultParser
	})
	let source = context.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me', 'text/turtle')
	t.same(''+source.data[0].vcard$fn, 'Auke van Slooten')
	t.same(''+source.primary.vcard$fn, 'Auke van Slooten')
	t.end()
})

/*
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
		},
		parser: new N3Parser()
	})
	let data = oldmParser.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me')
	let added = oldmParser.parse(turtle2, 'https://example.com/')
	t.same(''+data.vcard$fn, 'Auke van Slooten')
	t.same(''+data['vcard$organization-name'], 'Muze')
	t.end()
})
*/
/*
tap.test('separator', t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.

:me 
	a schema:Person;
	vcard:fn "Auke van Slooten" .`
	const context = oldm({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		},
		separator: ':',
		parser: defaultParser
	})
	let source = context.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me', 'text/turtle')
	t.same(''+source.primary['vcard:fn'], 'Auke van Slooten')
	t.end()	
})

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
	const context = oldm({
		prefixes: {
			'schema':'https://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		},
		parser: defaultParser
	})
	let source = context.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me', 'text/turtle')

	t.same(''+source.primary.vcard$bday, '1972-09-20')
	t.same(JSONTag.getType(source.primary.vcard$bday), 'date')
	t.end()	
})
*/
/**
 * TODO
 * - test object values
 * - test blank nodes
 * - test context.subjects as merged subjects
 * - test writing back changes
 **/
tap.test('write changes', async t => {
	let turtle = `
@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

:me 
	a schema:Person;
	vcard:bday "1972-09-20"^^xsd:date;
 	vcard:fn "Auke van Slooten" .`

	let expectTurtle = `@prefix : <#>.
@prefix schema: <http://schema.org/>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

:me a schema:Person;
    vcard:bday "1972-09-20"^^xsd:date;
    vcard:fn "Auke Cornelis van Slooten".
`
	
	const context = oldm({
		prefixes: {
			'schema':'http://schema.org/',
			'vcard':'http://www.w3.org/2006/vcard/ns#'
		},
		parser: defaultParser,
		writer: defaultWriter
	})
	let source = context.parse(turtle, 'https://auke.solidcommunity.net/profile/card#me', 'text/turtle')
//	console.log('source',source)
    source.primary.vcard$fn = 'Auke Cornelis van Slooten'
//	const df = n3.DataFactory
//	const { namedNode, literal } = df
//	source.store.removeMatches(namedNode('https://auke.solidcommunity.net/profile/card#me'),namedNode('http://www.w3.org/2006/vcard/ns#fn'))
//	source.store.addQuad('#me', 'http://www.w3.org/2006/vcard/ns#fn', 'Auke Cornelis van Slooten')
	let output = await source.write()
	console.log('output', output)
	t.same(output, expectTurtle)
	t.end()	
})
