class DflowGraph {
  constructor ({ nodes = [], pipes = [] } = {}, parentGraph = null) {
    this.nodes = nodes
    this.pipes = pipes
    this.parentGraph = parentGraph

    this.id = this.generateId()

    this.type = 'graph'
  }

  createGraph (nodes, pipes) {
    const graph = new DflowGraph(nodes, pipes, this)

    this.nodes.push(graph)

    return graph.id
  }

  createInput () {
    const id = this.generateId()

    this.nodes.push({ id, type: 'input' })

    return id
  }

  createOutput () {
    const id = this.generateId()

    this.nodes.push({ id, type: 'output' })

    return id
  }

  createPipe ({ from, to }) {
    const [targetId, inputIndex] = to

    // Two pipes cannot end in the same input.
    this.pipes = this.pipes.filter((pipe) => pipe.to[0] === targetId && pipe.to[1] === inputIndex)

    this.pipes.push({ from, to })
  }

  createTask ({ inputs = [], body }) {
    // TODO handle double quote escape in body content, in order to have a JSON serialazible graph.
    const id = this.generateId()

    const run = Function.apply(Function.prototype, inputs.map(({ name }) => name).concat(body))

    this.nodes.push({
      body,
      id,
      inputs,
      outputs: [{}],
      run,
      type: 'task'
    })

    return id
  }

  generateId () {
    return Math.random().toString(36).replace(/[^a-z]+/g, '')
  }

  run () {
    // TODO if parentGraph is not null, use it to get inputs.

    const levelOfNode = {}

    const duplicates = ({ value, index, array }) => array.indexOf(value) === index

    const inputPipesOfNode = (nodeId) => this.pipes.filter(({ to }) => to[0] === nodeId)

    const parentIdsOfNode = (nodeId) => {
      const inputPipes = inputPipesOfNode(nodeId)

      return inputPipes.map(({ from }) => from[0]).filter(duplicates)
    }

    const computeLevelOfNode = (nodeId) => {
      if (levelOfNode[nodeId]) {
        return levelOfNode[nodeId]
      }

      const parentIds = parentIdsOfNode(nodeId)

      if (parentIds.length === 0) return 1

      let level = 2

      parentIds.forEach((parentId) => {
        level = Math.max(level, computeLevelOfNode(parentId))
      })

      return level
    }

    this.nodes.sort((nodeA, nodeB) => {
      const levelA = computeLevelOfNode(nodeA.id)
      const levelB = computeLevelOfNode(nodeB.id)

      if (levelA < levelB) return -1
      if (levelA === levelB) return 0
      if (levelA > levelB) return 1
    })

    this.nodes.forEach((node, index) => {
      const inputPipes = inputPipesOfNode(node.id)

      const args = inputPipes.map(
        ({ from, to }) => ({ sourceId: from[0], outputIndex: from[1], inputIndex: to[1] })
      ).sort(
        ({ inputIndex: inputIndexA }, { inputIndex: inputIndexB }) => {
          if (inputIndexA < inputIndexB) return -1
          if (inputIndexA > inputIndexB) return 1
          if (inputIndexA === inputIndexB) return 0
        }
      ).map(({ sourceId, outputIndex }) => {
        const sourceNode = this.nodes.find(({ id }) => id === sourceId)

        return sourceNode.outputs[outputIndex].value
      })

      delete this.nodes[index].errors

      if (node.type === 'task') {
        try {
          const value = node.run.apply(null, args)

          this.nodes[index].outputs[0].value = value
        } catch (error) {
          // TODO every node, at least in the view, should have an output by default (other than return)
          // that is true is successfull, then maybe another optionally visible outeput should contain
          // an array of errors if something unexpected happened.
          this.nodes[index].errors = [ error ]

          // TODO every node should have also an input by default. Put default input and output to the right
          // Default output is called success and it is true if node executed without errors, otherwise it is false.
          // Default input is called enabled and if true it runs the node.
          // This is useful to run nodes in series or to run a node if some other node has no error.
        }
      }

      if (node.type === 'graph') {
        // TODO a graph must set its own outputs values
        // look for output type nodes
      }
    })
  }
}

module.exports = exports.default = DflowGraph
