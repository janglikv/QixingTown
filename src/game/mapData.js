import DEFAULT_MAP_JSON from './mapData/defaultMap.json'

export const MAP_STORAGE_KEY = 'qixing-town:map'

const normalizePoint = (point) => (
  Array.isArray(point)
  && Number.isFinite(point[0])
  && Number.isFinite(point[1])
    ? [point[0], point[1]]
    : null
)

const normalizeWall = (wall, index) => {
  const path = Array.isArray(wall?.path)
    ? wall.path.map(normalizePoint).filter(Boolean)
    : []
  if (path.length < 2) return null

  const position = Array.isArray(wall.position)
    && wall.position.length >= 3
    && wall.position.every(Number.isFinite)
    ? [wall.position[0], wall.position[1], wall.position[2]]
    : [0, 0, 0]

  return {
    id: typeof wall.id === 'string' && wall.id.trim() ? wall.id : `wall-${index + 1}`,
    label: typeof wall.label === 'string' && wall.label.trim() ? wall.label : `墙体 ${index + 1}`,
    path,
    width: Number.isFinite(wall.width) && wall.width > 0 ? wall.width : 0.5,
    height: Number.isFinite(wall.height) && wall.height > 0 ? wall.height : 1,
    position,
    color: typeof wall.color === 'string' && wall.color.trim() ? wall.color : '#5b625b',
  }
}

export const normalizeMapData = (data) => ({
  type: 'qixing-town:map',
  version: 1,
  walls: (Array.isArray(data?.walls) ? data.walls : [])
    .map(normalizeWall)
    .filter(Boolean),
})

export const DEFAULT_MAP_DATA = normalizeMapData(DEFAULT_MAP_JSON)

export const readMapData = () => {
  if (typeof window === 'undefined') return DEFAULT_MAP_DATA

  try {
    const stored = window.localStorage.getItem(MAP_STORAGE_KEY)
    if (!stored) return DEFAULT_MAP_DATA

    const data = normalizeMapData(JSON.parse(stored))
    return data.walls.length > 0 ? data : DEFAULT_MAP_DATA
  } catch {
    return DEFAULT_MAP_DATA
  }
}

export const writeMapData = (data) => {
  try {
    window.localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(normalizeMapData(data)))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}
