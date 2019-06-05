const DflowGraph = require('./dflow-graph')

const helloGraph = new DflowGraph()

helloGraph.createTask({ body: "console.log('hello world')" })
helloGraph.run()

helloGraph.createTask({ body: "console.log('I am a copy')" })

const copyOfHelloGraph = new DflowGraph(helloGraph)
copyOfHelloGraph.run()
