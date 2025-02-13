export default function oldm(options) {
	return new Context(options)
}

export const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'

const prefixes = {
	solid: 'http://www.w3.org/ns/solid/terms#',
	schema: 'http://schema.org/',
    vcard: 'http://www.w3.org/2006/vcard/ns#'
}

class Context {
	constructor(options) {
		this.prefixes = {...prefixes, ...options?.prefixes}
		if (!this.prefixes['xsd']) {
			this.prefixes['xsd'] = 'http://www.w3.org/2001/XMLSchema#'
		}
		this.parser = options?.parser
		this.writer = options?.writer
		this.sources = Object.create(null)
//		this.subjects = Object.create(null) // or use a proxy here? should contain all subjects from all sources, merged, readonly
		this.separator = options?.separator ?? '$'
	}

	parse(input, url, type) {
		const {quads, prefixes, factory} = this.parser(input, url, type)
		if (prefixes) {
			for (let prefix in prefixes) {
				let prefixURL = new URL(prefixes[prefix], url).href
				if (!this.prefixes[prefix]) {
					this.prefixes[prefix] = prefixURL
				}
			}
		}
		this.sources[url] = new Graph(quads, url, type, prefixes, this)
		return this.sources[url]
	}

	setType(literal, shortType) {
		if (!shortType) {
			return literal
		}
		if (typeof literal == 'string') {
			literal = new String(literal)
		} else if (typeof result == 'number') {
			literal = new Number(literal)
		}
		if (typeof literal !== 'object') {
			throw new Error('cannot set type on ',literal,shortType)
		}
		literal.type = shortType
		return literal
	}

	getType(object) {
		if (object && typeof object == 'object') {
			return object.type
		}
		console.error('getType: not an object', object)
		return null
	}
}


class Graph {
	#blankNodes = Object.create(null)

	constructor(quads, url, type, prefixes, context) {
		this.type     = type
		this.url      = url
		this.prefixes = prefixes
		this.context  = context
		this.subjects = Object.create(null)
		for (let quad of quads) {
			let subject
			if (quad.subject.termType=='BlankNode') {
				subject = this.addBlankNode(quad.subject.id)
			} else {
				subject = this.addSubject(quad.subject.id)
			}
			subject.addPredicate(quad.predicate.id, quad.object)
		}
		if (this.subjects[url]) {
			this.primary = this.subjects[url]
		} else {
			this.primary = null
		}
		Object.defineProperty(this, 'data', {
			get() {
				return Object.values(this.subjects)
			}
		})
	}

	addSubject(url) {
		// make sure any relative uri subject ids are fully qualified
		let absURI = new URL(url, this.url).href
		if (!this.subjects[absURI]) {
			this.subjects[absURI] = new Subject(absURI, this)
		}
		return this.subjects[absURI]
	}

	addBlankNode(id) {
		if (!this.#blankNodes[id]) {
			this.#blankNodes[id] = new Subject(id, this)
		}
		return this.#blankNodes[id]
	}

	write() {
		return this.context.writer(this)
	}

	get(shortID) {
		return this.subjects[this.fullURI(shortID)]
	}

	fullURI(shortURI) {
		const [prefix, path] = shortURI.split(this.context.separator)
		if (path) {
			return this.prefixes[prefix]+path 
		}
		return shortURI
	}

	shortURI(fullURI, separator=null) {
		if (!separator) {
			separator = this.context.separator
		}
		for (let prefix in this.context.prefixes) {
			if (fullURI.startsWith(this.context.prefixes[prefix])) {
				return prefix + separator + fullURI.substring(this.context.prefixes[prefix].length)
			}
		}
		if (this.url && fullURI.startsWith(this.url)) {
			return fullURI.substring(this.url.length)
		}
		return fullURI
	}

	/**
	 * This sets the type of a literal, usually one of the xsd types
	 */
	setType(literal, type) {
		const shortType = this.shortURI(type)
		return this.context.setType(literal, shortType)
	}

	/**
	 * This returns the type of a literal, or null
	 */
	getType(literal) {
		return this.context.getType(literal)
	}

}

/**
 * Represents a set of predicates on a signle subject.
 * TODO: make a separate class for blankNodes, without an id?
 */
class Subject {

	constructor(uri, graph) {
		Object.defineProperty(this, 'graph', {
			value: graph,
			writable: false,
			enumerable: false
		})
		Object.defineProperty(this, 'id', {
			value: uri,
			writable: false,
			enumerable: false
		})
		Object.defineProperty(this, 'type', {
			writable: true,
			enumerable: false
		})
	}

	addPredicate(predicate, object) {
		if (predicate.id) {
			predicate = predicate.id
		}
		if (predicate==rdfType) {
			let type = this.graph.shortURI(object.id)
			this.addType(type)
		} else {
			const value = this.getValue(object)
			predicate = this.graph.shortURI(predicate)
			if (!this[predicate]) {
				this[predicate] = value
			} else if (Array.isArray(this[predicate])) {
				this[predicate].push(value)
			} else {
				this[predicate] = [ this[predicate], value]
			}
		}
	}

	/**
	 * Adds a rdfType value, stored in this.type
	 * Subjects can have more than one type (or class), unlike literals
	 * The type value can be any URI, xsdTypes are unexpected here
	 */
	addType(extraType) {
		let type = this.type
		if (!type) {
			this.type = extraType
		} else {
			if (!Array.isArray(this.type)) {
				this.type = [ this.type ]
			}
			this.type.push(extraType)
		}
	}

	getValue(object) {
		let result
		if (object.termType=='Literal') {
			result = object.value
			let datatype = object.datatype?.id
			if (datatype) {
				result = this.graph.setType(result, datatype)
			}
			// let language = object.language()
			// if (language) {
			// 	result = this.graph.setLanguage(result, language)
			// }
		} else if (object.termType=='BlankNode') {
			result = this.graph.addBlankNode(object.id)
		} else {
			result = this.graph.addSubject(object.id)
		}
		return result
	}

}