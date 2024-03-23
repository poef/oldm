# Linked Data to JSONTag

This is a demo of an OLDM (Object to Linked Data Mapper). This has the same role as 
an ORM for SQL data. It turns triples into an object graph that you can just use
in your javascript code.

It uses [JSONTag](https://github.com/muze-nl/jsontag/) to represent the meta data needed to support all features of linked data
triples.

The parse() method returns the full graph. You can get a specific item by its id, using the
parsers index:

```javascript
const data = parser.parse(text, baseURI)
const item = parser.index.get(id)
```
