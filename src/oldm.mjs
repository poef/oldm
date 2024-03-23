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

//TODO: build a datamapper on top of this, that can hydrate specific
//object types (classes) to specific javascript classes

class Parser {
	prefixes = {}
	index = new Map()
	unresolved = new Map()
	#n3 = null

	constructor(prefixes) {
		this.prefixes = prefixes
		if (!this.prefixes['xsd']) {
			this.prefixes['xsd'] = 'http://www.w3.org/2001/XMLSchema#'
		}
	}

	parse(text, baseURI) {
		const graph = this.graph(baseURI)
		const parser = new N3.Parser({ blankNodePrefix: '', baseIRI: baseURI})
		const data = parser.parse(text)
		for (let quad of data) {
      let subject
      if (quad.subject.termType=='BlankNode') {
        subject = graph.addBlankNode(quad.subject.id)
      } else {
        subject = graph.addSubject(quad.subject.id)
      }
      subject.addPredicate(quad.predicate.id, quad.object)
		}
		//TODO: check if baseURI is in the graph, if so return it instead of the graph? e.g. profile/card#me
    return graph
	}

	graph(baseURI) {
		return new Graph(this, baseURI,)
	}
}

class Graph extends Array {
 
  constructor(parser, baseURI) {
		super()
		Object.defineProperty(this, 'baseURI', {
			value: baseURI ?? '',
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

	resolveLinks(subject, subjectID) {
    if (this.parser.unresolved.has(subjectID)) {
	  	// TODO: test this by loading two graphs with the same parser and links between them
	  	let u = this.parser.unresolved.get(subjectID)
	  	let shortID = this.short(subjectID)
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
			//TODO: check if subject is part of this graph, if not, move it to this graph
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
  
	short(uri) {
		if (this.baseURI && uri.startsWith(this.baseURI)) {
			return new JSONTag.Link(uri.substring(this.baseURI.length))
		}
		let prefixes = this.parser.prefixes
		for (let prefix in prefixes) {
			if (uri.startsWith(prefixes[prefix])) {
				return new JSONTag.Link(prefix+'$'+uri.substring(prefixes[prefix].length))
			}
		}
		return uri
	}

	long(uri) {
		if (uri instanceof JSONTag.Link) {
			uri = uri.value
			let [prefix,short] = uri.split('$')
			if (this.parser.prefixes[prefix]) {
				uri = this.parser.prefixes[prefix]+short
			}
			return uri
		}
		return uri
	}
  
  setType(value, type) {
    let result
    switch(typeof value) {
      case 'string':
        result = new String(value)
        JSONTag.setType(result, 'string')
      break
      case 'Number':
        result = new Number(value)
        JSONTag.setType(result, 'number')
      break
      default:
        throw new Error('missing type implementation for '+(typeof value))
      break
    }
    let shortType = this.short(type)
    if (shortType instanceof JSONTag.Link && xsdTypes[shortType.value]) {
      this.#setTypeString(result, xsdTypes[shortType.value])    		
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
	#graph
	
  constructor(graph, id) {
		this.#graph = graph
    if (id) {
      let shortID = this.#graph.short(id)
      if (shortID instanceof JSONTag.Link) {
        shortID = shortID.value
      }
      JSONTag.setAttribute(this, 'id', shortID)
      this.#graph.parser.index.set(id, this)
    }
	}

	get id() {
		return JSONTag.getAttribute(this, 'id')
	}

	addPredicate(predicateId, object) {
		if (predicateId==rdfType) {
			this.addType(this.#graph.short(object.id))
		} else {
			let shortPred = this.#graph.short(predicateId)
			if (shortPred instanceof JSONTag.Link) {
				shortPred = shortPred.value
			}
			let value = this.#getValue(object)
			if (value instanceof JSONTag.Link) {
				this.#graph.addUnresolved(value.value, shortPred, this.id)
			}
			if (!this[shortPred]) {
				this[shortPred] = value
			} else if (Array.isArray(this[shortPred])) {
				this[shortPred].push(value)
			} else {
				this[shortPred] = [ this[shortPred], value]
			}
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
      object = this.#graph.setType(object.value, object.datatype.id)
		} else { // URI
			let parser = this.#graph.parser
			if (object.id.startsWith(this.#graph.baseURI)) {
				object = this.#graph.addSubject(object.id)
			} else if (parser.index.has(object.id)) {
				object = parser.index.get(object.id)
      } else if (this.#graph.blankNodes.has(object.id)) {
        object = this.#graph.blankNodes.get(object.id)
			} else {
				object = this.#graph.short(object.id)
			}
		}
		return object
	}
}

export default function parser(prefixes=[], n3=null) {
	return new Parser(prefixes, n3)
}