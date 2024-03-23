import $4fVYS$muzenljsontag from "@muze-nl/jsontag";
import $4fVYS$n3 from "n3";



const $12659d5b21eed4c9$var$xsdTypes = {
    xsd$dateTime: "<datetime>",
    xsd$time: "<time>",
    xsd$date: "<date>",
    xsd$duration: "<duration>",
    xsd$string: "<string>",
    xsd$float: "<float>",
    xsd$decimal: "<decimal>",
    xsd$double: "<float64>",
    xsd$anyURI: "<url>",
    xsd$integer: "<int>",
    xsd$int: "<int>",
    xsd$long: "<int64>",
    xsd$short: "<int16>",
    xsd$byte: "<int8>",
    xsd$nonNegativeInteger: "<uint>",
    xsd$unsignedLong: "<uint64>",
    xsd$unsignedInt: "<uint>",
    xsd$unsignedShort: "<uint16>",
    xsd$unsignedByte: "<uint8>",
    xsd$base64Binary: '<blob class="base64">'
};
const $12659d5b21eed4c9$var$rdfType = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
class $12659d5b21eed4c9$export$7acfa6ed01010e37 {
    prefixes = {};
    index = new Map();
    unresolved = new Map();
    #n3 = null;
    constructor(prefixes){
        this.prefixes = prefixes;
        if (!this.prefixes["xsd"]) this.prefixes["xsd"] = "http://www.w3.org/2001/XMLSchema#";
        this.#n3 = (0, $4fVYS$n3);
    }
    parse(text, baseURI) {
        const graph = this.graph(baseURI);
        const parser = new this.#n3.Parser({
            blankNodePrefix: "",
            baseIRI: baseURI
        });
        const data = parser.parse(text);
        for (let quad of data){
            let subject;
            if (quad.subject.termType == "BlankNode") subject = graph.addBlankNode(quad.subject.id);
            else subject = graph.addSubject(quad.subject.id);
            subject.addPredicate(quad.predicate.id, quad.object);
        }
        //TODO: check if baseURI is in the graph, if so return it instead of the graph? e.g. profile/card#me
        return graph;
    }
    graph(baseURI) {
        return new $12659d5b21eed4c9$export$614db49f3febe941(this, baseURI);
    }
}
class $12659d5b21eed4c9$export$614db49f3febe941 extends Array {
    constructor(parser, baseURI){
        super();
        Object.defineProperty(this, "baseURI", {
            value: baseURI ?? "",
            writable: true,
            configurable: false,
            enumerable: false
        });
        Object.defineProperty(this, "parser", {
            value: parser,
            writable: false,
            configurable: false,
            enumerable: false
        });
        Object.defineProperty(this, "blankNodes", {
            value: new Map(),
            writable: true,
            configurable: false,
            enumerable: false
        });
        if (parser.prefixes) {
            let prefixAttr = [];
            for (let [prefix, url] of Object.entries(parser.prefixes))prefixAttr.push(prefix + ":" + url);
            (0, $4fVYS$muzenljsontag).setAttribute(this, "prefix", prefixAttr.join(" "));
        }
        if (baseURI) (0, $4fVYS$muzenljsontag).setAttribute(this, "baseURI", baseURI);
    }
    resolveLinks(subject, subjectID) {
        if (this.parser.unresolved.has(subjectID)) {
            // TODO: test this by loading two graphs with the same parser and links between them
            let u = this.parser.unresolved.get(subjectID);
            let shortID = this.short(subjectID);
            for(let parentID in u){
                let parent = this.parser.index.get(parentID);
                for (let key of u[parentID]){
                    let prop = parent[key];
                    if (Array.isArray(prop)) prop = prop.map((e)=>{
                        if (!(e instanceof (0, $4fVYS$muzenljsontag).Link)) return e;
                        else if (e.value == shortID) return subject;
                    });
                    else if (prop instanceof (0, $4fVYS$muzenljsontag).Link && prop.value == shortID) parent[key] = subject;
                }
            }
            this.parser.unresolved.remove(subjectID);
        }
    }
    addSubject(subjectID) {
        let subject;
        if (!this.parser.index.has(subjectID)) {
            subject = new $12659d5b21eed4c9$export$b6bbab5a9b109038(this, subjectID) // link back to its containing graph
            ;
            this.push(subject);
            this.resolveLinks(subject, subjectID);
        } else subject = this.parser.index.get(subjectID);
        return subject;
    }
    addBlankNode(tempID) {
        let node;
        if (this.blankNodes.has(tempID)) node = this.blankNodes.get(tempID);
        else {
            node = new $12659d5b21eed4c9$export$b6bbab5a9b109038(this);
            this.blankNodes.set(tempID, node);
        }
        return node;
    }
    short(uri) {
        if (this.baseURI && uri.startsWith(this.baseURI)) return new (0, $4fVYS$muzenljsontag).Link(uri.substring(this.baseURI.length));
        let prefixes = this.parser.prefixes;
        for(let prefix in prefixes){
            if (uri.startsWith(prefixes[prefix])) return new (0, $4fVYS$muzenljsontag).Link(prefix + "$" + uri.substring(prefixes[prefix].length));
        }
        return uri;
    }
    long(uri) {
        if (uri instanceof (0, $4fVYS$muzenljsontag).Link) {
            uri = uri.value;
            let [prefix, short] = uri.split("$");
            if (this.parser.prefixes[prefix]) uri = this.parser.prefixes[prefix] + short;
            return uri;
        }
        return uri;
    }
    setType(value, type) {
        let result;
        switch(typeof value){
            case "string":
                result = new String(value);
                (0, $4fVYS$muzenljsontag).setType(result, "string");
                break;
            case "Number":
                result = new Number(value);
                (0, $4fVYS$muzenljsontag).setType(result, "number");
                break;
            default:
                throw new Error("missing type implementation for " + typeof value);
        }
        let shortType = this.short(type);
        if (shortType instanceof (0, $4fVYS$muzenljsontag).Link && $12659d5b21eed4c9$var$xsdTypes[shortType.value]) this.#setTypeString(result, $12659d5b21eed4c9$var$xsdTypes[shortType.value]);
        else (0, $4fVYS$muzenljsontag).setAttribute(result, "class", type);
        return result;
    }
    #setTypeString(obj, typeString) {
        let type = typeString.substring(1, typeString.length - 1).split(" ").pop();
        //TODO: parse and set attributes as well
        (0, $4fVYS$muzenljsontag).setType(obj, type);
    }
    addUnresolved(linkID, key, parentID) {
        let unresolved = this.parser.unresolved;
        if (!unresolved.has(linkID)) unresolved.set(linkID, {
            parentID: [
                key
            ]
        });
        else {
            let unresolvedEntries = unresolved.get(linkID);
            if (!unresolvedEntries[parentID]) unresolvedEntries[parentID] = [
                key
            ];
            else unresolvedEntries[parentID].push(key);
        }
    }
}
class $12659d5b21eed4c9$export$b6bbab5a9b109038 {
    #graph;
    constructor(graph, id){
        this.#graph = graph;
        if (id) {
            let shortID = this.#graph.short(id);
            if (shortID instanceof (0, $4fVYS$muzenljsontag).Link) shortID = shortID.value;
            (0, $4fVYS$muzenljsontag).setAttribute(this, "id", shortID);
            this.#graph.parser.index.set(id, this);
        }
    }
    get id() {
        return (0, $4fVYS$muzenljsontag).getAttribute(this, "id");
    }
    addPredicate(predicateId, object) {
        if (predicateId == $12659d5b21eed4c9$var$rdfType) this.addType(this.#graph.short(object.id));
        else {
            let shortPred = this.#graph.short(predicateId);
            if (shortPred instanceof (0, $4fVYS$muzenljsontag).Link) shortPred = shortPred.value;
            let value = this.#getValue(object);
            if (value instanceof (0, $4fVYS$muzenljsontag).Link) this.#graph.addUnresolved(value.value, shortPred, this.id);
            if (!this[shortPred]) this[shortPred] = value;
            else if (Array.isArray(this[shortPred])) this[shortPred].push(value);
            else this[shortPred] = [
                this[shortPred],
                value
            ];
        }
    }
    addType(shortType) {
        if (shortType instanceof (0, $4fVYS$muzenljsontag).Link) shortType = shortType.value;
        let classNames = (0, $4fVYS$muzenljsontag).getAttribute(this, "class");
        if (!classNames) classNames = [];
        if (!Array.isArray(classNames)) classNames = classNames.split(" ");
        if (!classNames.indexOf(shortType)) {
            classNames.push(shortType);
            (0, $4fVYS$muzenljsontag).setAttribute(this, "class", classNames);
        }
    }
    #getValue(object) {
        if (object.termType == "Literal") object = this.#graph.setType(object.value, object.datatype.id);
        else {
            let parser = this.#graph.parser;
            if (object.id.startsWith(this.#graph.baseURI)) object = this.#graph.addSubject(object.id);
            else if (parser.index.has(object.id)) object = parser.index.get(object.id);
            else if (this.#graph.blankNodes.has(object.id)) object = this.#graph.blankNodes.get(object.id);
            else object = this.#graph.short(object.id);
        }
        return object;
    }
}
function $12659d5b21eed4c9$export$2e2bcd8739ae039(prefixes = [], n3 = null) {
    return new $12659d5b21eed4c9$export$7acfa6ed01010e37(prefixes, n3);
}


export {$12659d5b21eed4c9$export$7acfa6ed01010e37 as Parser, $12659d5b21eed4c9$export$614db49f3febe941 as Graph, $12659d5b21eed4c9$export$b6bbab5a9b109038 as Subject, $12659d5b21eed4c9$export$2e2bcd8739ae039 as default};
//# sourceMappingURL=oldm.mjs.map
