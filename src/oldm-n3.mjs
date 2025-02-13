import oldm, {rdfType} from './oldm.mjs'
import n3 from 'n3'

export const n3Parser = (input, uri, type) => {
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

export const n3Writer = (source) => {
	return new Promise((resolve, reject) => {
		const writer = new n3.Writer({
			format: source.type,
			prefixes: {...source.prefixes}
		})
		const {quad, namedNode, literal, blankNode} = n3.DataFactory
		Object.entries(source.subjects).forEach(([id,subject]) => {
			id = source.shortURI(id, ':')
			
			let classNames = subject.type
			if (!Array.isArray(classNames)) {
				classNames = [ classNames ]
			}
			if (classNames?.length) {
				for(let name of classNames) {
					name = source.fullURI(name)
					writer.addQuad(quad(
						namedNode(id),
						namedNode(source.fullURI(rdfType)),
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
								if (type) {
									type = source.fullURI(type)
								}
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
					if (type) {
						type = source.fullURI(type)
					}
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
