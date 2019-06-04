const DflowGraph = require('./dflow-graph')

const graph = new DflowGraph()

graph.createTask({ body: "console.log('hello world')" })
graph.run()
