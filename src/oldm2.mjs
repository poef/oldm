import JSONTag from '@muze-nl/jsontag'

const xsdTypes = {
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
	xsd$byte: '<int8>', // yes really: http://www.datypic.com/sc/xsd/t-xsd_byte.html
	xsd$nonNegativeInteger: '<uint>',
	xsd$unsignedLong: '<uint64>',
	xsd$unsignedInt: '<uint>',
	xsd$unsignedShort: '<uint16>',
	xsd$unsignedByte: '<uint8>',
	xsd$base64Binary: '<blob class="base64">',
	//TODO: check that this list is complete enough (missing types will be encoded with <object class="xsd$Type">)
}

const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'

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
		this.types = {}
		Object.entries(xsdTypes).forEach(([t,v]) => {
			const ts = t
				.split('$')
				.join(this.separator)
			this.types[ts] = v
		})
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
		if (this.types[shortType]) {
			let jsontagType = this.types[shortType]
			let typeInfo = jsontagType.substring(1, jsontagType.length-1).split(' ')
			JSONTag.setType(literal, typeInfo[0])
			if (typeInfo[1]) {
				let attributeInfo = typeInfo[1].split('=')
				let attributeValue = attributeInfo[1].trim()
				attributeValue = attributeValue.substring(1, attributeValue.length-1)
				JSONTag.setAttribute(literal, attributeInfo[0], attributeValue)
			}
		} else {
			console.log('set class ',shortType,literal)
			JSONTag.setAttribute(literal, 'class', shortType)
		}
		return literal
	}

	getType(object) {
		const xsd = 'http://www.w3.org/2001/XMLSchema#'
		if (object && typeof object == 'object') {
			const jsontagType = JSONTag.getType(object)
			const jsontagClass = JSONTag.getAttribute(object, 'class')
			let found =	Object.entries(this.types).find(([shortType, typeString]) => {
				if (typeString=='<'+jsontagType+'>') { //TODO support blob class="base64"
					return true
				}
			})
			if (found) {
//				console.log('found',found)
				return xsd+found[0].substring(4)
			} else {
				console.log('no type match for ',jsontagType)
			}
		}
		console.log('object not an object', object)
		return null
	}
}

export default function oldm(options) {
	return new Context(options)
}

oldm.rdfType = rdfType //FIXME

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
			if (separator==':') {
				console.log('prefix',prefix,this.context.prefixes[prefix])
			}
			if (fullURI.startsWith(this.context.prefixes[prefix])) {
				return prefix + separator + fullURI.substring(this.context.prefixes[prefix].length)
			}
		}
		if (this.url && fullURI.startsWith(this.url)) {
			return fullURI.substring(this.url.length)
		}
		return fullURI
	}

	setType(literal, type) {
		const shortType = this.shortURI(type)
		return this.context.setType(literal, shortType)
	}

	getType(object) {
		return this.context.getType(object)
	}

}

// TODO any property you change, must update the graph.quads...
// or when writing, the quads must be recalculated from the current subjects - without changing existing prefixes
class Subject {

	constructor(uri, graph) {
		JSONTag.setAttribute(this, 'id', uri)
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
	}

	addPredicate(predicate, object) {
		console.log('setting subject pred',predicate,object)
		if (predicate.id) {
			predicate = predicate.id
		}
		if (predicate==rdfType) {
			console.log('adding type',this.id,object.id)
			let type = this.graph.shortURI(object.id, ':')
			console.log('type',type)
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

	addType(rdfType) {
		console.log('rdfType',rdfType)
		let classNames = JSONTag.getAttribute(this, 'class')
		if (!classNames) {
			classNames = []
		}
		if (!Array.isArray(classNames)) {
			classNames = classNames.split(' ')
		}
		if (classNames.indexOf(rdfType)==-1) {
			classNames.push(rdfType)
			console.log('setAttribute',this.id,classNames)
			JSONTag.setAttribute(this, 'class', classNames)
		} else {
			console.log('skipping classname',classNames)
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