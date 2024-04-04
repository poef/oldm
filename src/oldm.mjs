import JSONTag from '@muze-nl/jsontag'
import N3 from 'n3'

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

const source = Symbol('source')

//TODO: build a datamapper on top of this, that can hydrate specific
//object types (classes) to specific javascript classes

class Parser {
	prefixes = {}
	index = new Map()
	unresolved = new Map()
	types = {}

	constructor(options = {}) {
		this.prefixes = options?.prefixes ?? {}
		this.separator = options?.separator ?? '$' //TODO: do I really want to allow different separators? least surprise etc.
		if (!this.prefixes['xsd']) {
			this.prefixes['xsd'] = 'http://www.w3.org/2001/XMLSchema#'
		}
		this.types = {}
		Object.entries(xsdTypes).forEach(([t,v]) => {
			const ts = t
				.split('$')
				.join(this.separator)
			this.types[ts] = v
		})
	}

	parse(text, baseURI) {
		const graph = this.graph(baseURI)
		const parser = new N3.Parser({ blankNodePrefix: '', baseIRI: baseURI})
		const data = parser.parse(text)
		graph[source] = data
		for (let quad of data) {
      let subject
      if (quad.subject.termType=='BlankNode') {
        subject = graph.addBlankNode(quad.subject.id)
      } else {
        subject = graph.addSubject(quad.subject.id)
      }
      subject.addPredicate(quad.predicate.id, quad.object, graph)
		}
		if (this.index.has(baseURI)) {
			return this.index.get(baseURI)
		}
    return graph
	}

  
	short(uri, baseURI) {
		//TODO: why handle baseURI different from prefixes?
		if (baseURI && uri.startsWith(baseURI)) {
			return new JSONTag.Link(uri.substring(baseURI.length))
		}
		let prefixes = this.prefixes
		for (let prefix in prefixes) {
			if (uri.startsWith(prefixes[prefix])) {
				return new JSONTag.Link(prefix+this.separator+uri.substring(prefixes[prefix].length))
			}
		}
		return uri
	}

	long(uri) {
		if (uri instanceof JSONTag.Link) {
			uri = uri.value
			let [prefix,short] = uri.split(this.separator)
			if (this.prefixes[prefix]) {
				uri = this.prefixes[prefix]+short
			}
			return uri
		}
		return uri
	}

	graph(baseURI) {
		return new Graph(this, baseURI,)
	}
}

//TODO: add method/property to return the N3 source data of a specific graph
//with all updates to the data
class Graph extends Array {
 
  constructor(parser, baseURI) {
		super()
		let uri = new URL(baseURI)
		uri.hash = ''
		Object.defineProperty(this, 'baseURI', {
			value: uri.href,
			writable: true,
			configurable: false,
			enumerable: false
		})
		Object.defineProperty(this, 'parser', {
			value: parser,
			writable: false,
			configurable: false,
			enumerable: false
		})
    Object.defineProperty(this, 'blankNodes', {
      value: new Map(),
      writable: true,
      configurable: false,
      enumerable: false
    })
    if (parser.prefixes) {
      let prefixAttr = []
      for (let [prefix,url] of Object.entries(parser.prefixes)) {
        prefixAttr.push(prefix+':'+url)
      }
      JSONTag.setAttribute(this, 'prefix', prefixAttr.join(' '))
    }
    if (baseURI) {
  		JSONTag.setAttribute(this, 'baseURI', baseURI)
    }
	}

	static get [Symbol.species]() {
		return Array
	}

	resolveLinks(subject, subjectID) {
    if (this.parser.unresolved.has(subjectID)) {
	  	let u = this.parser.unresolved.get(subjectID)
	  	let shortID = this.parser.short(subjectID, this.baseURI)
	  	for (let parentID in u) {
	  		let parent = this.parser.index.get(parentID)
	  		for (let key of u[parentID]) {
	  			let prop = parent[key]
	  			if (Array.isArray(prop)) {
	  				prop = prop.map(e => {
	  					if (!(e instanceof JSONTag.Link)) {
	  						return e
	  					} else if (e.value==shortID) {
	  						return subject
	  					}
	  				})
	  			} else {
	  				if (prop instanceof JSONTag.Link && prop.value==shortID) {
	  					parent[key] = subject
	  				}
	  			}
	  		}
	  	}
	  	this.parser.unresolved.remove(subjectID)
	  }
	}

	addSubject(subjectID) {
		let subject
		if (!this.parser.index.has(subjectID)) {
			subject = new Subject(this, subjectID) // link back to its containing graph
      this.push(subject)
      this.resolveLinks(subject, subjectID)
		} else {
			subject = this.parser.index.get(subjectID)
			if (!this.includes(subject)) {
				this.push(subject)
			}
		}
		return subject
	}

  addBlankNode(tempID) {
    let node
    if (this.blankNodes.has(tempID)) {
      node = this.blankNodes.get(tempID)
    } else {
      node = new Subject(this)
      this.blankNodes.set(tempID, node)
    }
    return node
  }
  
  setType(value, type) {
    let result
    switch(typeof value) {
      case 'string':
        result = new String(value)
        JSONTag.setType(result, 'string')
      break
      case 'number':
        result = new Number(value)
        JSONTag.setType(result, 'number')
      break
      default:
        throw new Error('missing type implementation for '+(typeof value))
      break
    }
    let shortType = this.parser.short(type, this.baseURI)
    if (shortType instanceof JSONTag.Link && this.parser.types[shortType.value]) {
      this.#setTypeString(result, this.parser.types[shortType.value])    		
  	} else {
      JSONTag.setAttribute(result, 'class', type)    
    }
    return result
  }
  
  #setTypeString(obj, typeString) {
    let type = typeString.substring(1, typeString.length-1).split(' ').pop()
    //TODO: parse and set attributes as well
    JSONTag.setType(obj, type)
  }

  addUnresolved(linkID, key, parentID) {
  	let unresolved = this.parser.unresolved
		if (!unresolved.has(linkID)) {
			unresolved.set(linkID, {
				parentID: [key]
			})
	  } else {
	  	let unresolvedEntries = unresolved.get(linkID)
	  	if (!unresolvedEntries[parentID]) {
	  		unresolvedEntries[parentID]=[key]
	  	} else {
	  		unresolvedEntries[parentID].push(key)
	  	}
	  }
  }
}

class Subject {
	#graphs
	
  constructor(graph, id) {
		this.#graphs = [graph]
    if (id) {
      JSONTag.setAttribute(this, 'id', id)
      graph.parser.index.set(id, this)
    }
	}

	get id() {
		return JSONTag.getAttribute(this, 'id')
	}

	addPredicate(predicateId, object, graph) {
		if (!this.#graphs.includes(graph)) {
			this.#graphs.push(graph)
		}
		if (predicateId==rdfType) {
			this.addType(graph.parser.short(object.id, graph.baseURI), graph)
		} else {
			let shortPred = graph.parser.short(predicateId, graph.baseURI)
			if (shortPred instanceof JSONTag.Link) {
				shortPred = shortPred.value
			}
			let value = this.#getValue(object)
			if (value instanceof JSONTag.Link) {
				graph.addUnresolved(value.value, shortPred, this.id)
			}
			if (!this[shortPred]) {
				this[shortPred] = value
			} else if (Array.isArray(this[shortPred])) {
				this[shortPred].push(value)
			} else {
				this[shortPred] = [ this[shortPred], value]
			}
			//TODO: also update source when deleting properties
			//FIXME: make this work:
//			if (!graph[source].has(this.id, predicateId, object)) {
//				graph[source].set(this.id, predicateId, object)
//			}
		}
	}

	addType(shortType) {
		if (shortType instanceof JSONTag.Link) {
			shortType = shortType.value
		}
		let classNames = JSONTag.getAttribute(this, 'class')
		if (!classNames) {
			classNames = []
		}
		if (!Array.isArray(classNames)) {
			classNames = classNames.split(' ')
		}
		if (!classNames.indexOf(shortType)) {
			classNames.push(shortType)
			JSONTag.setAttribute(this, 'class', classNames)
		}
	}

	#getValue(object) {
		if (object.termType=='Literal') {
			let graph = this.#graphs[this.#graphs.length-1]
      object = graph.setType(object.value, object.datatype.id)
		} else { // URI
			let parser, graph
			let found = (() => {
				for (graph of this.#graphs) {
					parser = graph.parser
					if (object.id.startsWith(graph.baseURI)) {
						object = graph.addSubject(object.id)
						return true
					} else if (parser.index.has(object.id)) {
						object = parser.index.get(object.id)
						return true
		      } else if (graph.blankNodes.has(object.id)) {
		        object = graph.blankNodes.get(object.id)
		        return true
		      }
				}
			})()
			if (!found) {
				object = parser.short(object.id, graph.baseURI)
			}
		}
		return object
	}
}

export default function parser(prefixes=[], n3=null) {
	return new Parser(prefixes, n3)
}