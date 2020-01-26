export class DflowTask {
  constructor ({ body, id }) {
    this.id = id || this.generateId()

    // Task arguments.
    this.arg = []

    // Task function body.
    this.body = body || null

    // Initialize to empty function, no output and no errors.
    this.fun = Function.prototype

    this.compileError = null
    this.output = null
    this.runError = null
  }

  compile () {
    const { arg, body } = this

    // TODO handle double quote escape in body content, in order to have a JSON serialazible graph.
    if (typeof body !== 'string') return

    this.compileError = null

    try {
      this.fun = Function.apply(Function.prototype, this.arg.map(({ name }) => name).concat(body))
    } catch (error) {
      this.compileError = error

      this.fun = Function.prototype
    }
  }

  /**
   * @typedef {Object} DflowArg
   * @prop {any} data
   * @prop {String} name
   */
  createArg ({ data, name }) {
    this.arg.push({ data, name })
  }

  generateId () {
    return Math.random().toString(36).replace(/[^a-z]+/g, '').substring(0, 4)
  }

  run () {
    try {
      // 1. Try to compile body function with current args.
      this.compile()

      if (this.compileError === null) {
        // 2. Reset error.
        this.runError = null

        // 3. Try to run compiled function.
        this.output = this.fun()
      }
    } catch (error) {
      this.runError = error
    }
  }
}

export class DflowGraph extends DflowTask {
  constructor ({ id, parentGraph = null } = {}) {
    super({ id })

    Object.defineProperties(this, {
      nodes: { value: new Map() },
      pipes: { value: new Map() },
      parentGraph: { value: parentGraph }
    })
  }

  createGraph (graphJson) {
    const graph = new DflowGraph({ graphJson, parentGraph: this })

    this.nodes.set(graph.id, graph)
  }

  createPipe ({
    from: [
      sourceId,
      outputIndex
    ],
    to: [
      targetId,
      inputIndex
    ]
  }) {
    // Two pipes cannot end in the same input.
    this.pipes.set([ targetId, inputIndex ], [ sourceId, outputIndex ])
  }

  createTask ({ args = [], body, id }) {
    const task = new DflowTask({ body, id })

    args.forEach(arg => task.createArg(arg))

    this.nodes.set(task.id, task)
  }

  run () {
    // TODO if parentGraph is not null, use it to get args.

    const levelOfNode = {}

    const duplicates = ({ value, index, array }) => array.indexOf(value) === index

    const inputPipesOfNode = (nodeId) => (
      Array.from(this.pipes.keys).filter(
        ([ targetId ]) => targetId === nodeId
      ).map(
        key => this.pipes.get(key)
      )
    )

    const parentIdsOfNode = (nodeId) => (
      inputPipesOfNode(nodeId).map(({ from }) => from[0]).filter(duplicates)
    )

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

    const nodes = Array.from(this.nodes.values).sort((nodeA, nodeB) => {
      const levelA = computeLevelOfNode(nodeA.id)
      const levelB = computeLevelOfNode(nodeB.id)

      if (levelA < levelB) return -1
      if (levelA === levelB) return 0
      if (levelA > levelB) return 1
    })

    nodes.forEach((node, index) => {
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
        const sourceNode = nodes.find(({ id }) => id === sourceId)

        return sourceNode.outputs[outputIndex].value
      })

      if (node instanceof DflowGraph) {
        // TODO a graph must set its own outputs values
        // look for output type nodes
      } else if (node instanceof DflowTask) {
        try {
          const value = node.run.apply(null, args)

          this.nodes[index].outputs[0].value = value
        } catch (error) {
          // TODO every node, at least in the view, should have an output by default (other than return)
          // that is true is successfull, then maybe another optionally visible outeput should contain
          // an array of errors if something unexpected happened.

          // TODO every node should have also an input by default. Put default input and output to the right
          // Default output is called success and it is true if node executed without errors, otherwise it is false.
          // Default input is called enabled and if true it runs the node.
          // This is useful to run nodes in series or to run a node if some other node has no error.
        }
      }
    })
  }
}
