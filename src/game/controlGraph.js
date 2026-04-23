export const solveControlGraph = ({ points, constraints }) => {
  const solvedPoints = Object.fromEntries(
    Object.entries(points).map(([key, point]) => [key, point.clone()]),
  )

  constraints.forEach((constraint) => {
    if (constraint.type !== 'offset') {
      throw new Error(`Unsupported control graph constraint: ${constraint.type}`)
    }

    const fromPoint = solvedPoints[constraint.from]
    if (!fromPoint) {
      throw new Error(`Missing control point: ${constraint.from}`)
    }

    solvedPoints[constraint.to] = fromPoint.clone().add(constraint.offset)
  })

  return solvedPoints
}
