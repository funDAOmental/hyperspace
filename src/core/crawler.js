import * as Crawler from '@rsodre/crawler-data'
import { MAX_MAP_SIZE } from '@/core/components/map'
import { TilesetPaths } from './texture-data'
import { nanoid } from 'nanoid'
import { TYPE } from './components/screen'

export const crawlerSlugToChamberData = (slug) => {
  if (!Crawler.validateSlug(slug)) {
    console.log(`crawlerSlugToChamberData() Invalid slug:`, slug)
    return null
  }
  const coord = Crawler.slugToCoord(slug)
  const chamberData = Crawler.getChamberData(coord)
  return chamberData
}

export const crawlerSlugToRoom = (slug, agentId = null) => {
  const chamberData = crawlerSlugToChamberData(slug)
  if (!chamberData) return null

  let result = {
    // ...chamberData,
    settings: {
      world: {}
    },
    tileset: {
      world: null
    },
    map2: {
      world: []
    },
    portal: {},
    screen: {},
  }

  const PATH = 4
  const DOOR = 0
  const GEM = 1
  const PERIM = 5
  const WALL = 6

  // initialize map
  for (let y = 0; y < MAX_MAP_SIZE.height; ++y) {
    result.map2.world.push(new Array(MAX_MAP_SIZE.width).fill(null))
  }

  // perimeter
  let start = {
    x: (MAX_MAP_SIZE.width - 20) / 2,
    y: (MAX_MAP_SIZE.height - 20) / 2,
  }
  for (let y = 0; y < 20; ++y) {
    for (let x = 0; x < 20; ++x) {
      result.map2.world[start.y + y][start.x + x] = PERIM
    }
  }

  start = {
    x: (MAX_MAP_SIZE.width - 16) / 2,
    y: (MAX_MAP_SIZE.height - 16) / 2,
  }

  for (let i = 0; i < 256; ++i) {
    const chamberTile = chamberData.tilemap[i]
    const isDoor = chamberData.doors.includes(i)
    const isGem = (i == chamberData.gemPos)
    const x = start.x + (i % 16)
    const y = start.y + Math.floor(i / 16)
    const tile = isDoor ? DOOR : isGem ? GEM : chamberTile == 0 ? WALL : PATH
    result.map2.world[y][x] = tile
    // door corridors
    if (i == chamberData.doors[Crawler.Dir.North]) {
      result.map2.world[y - 1][x] = tile
      result.map2.world[y - 2][x] = tile
      // result.portal[nanoid()] = {
      //   slug: slug,
      //   position: {},
      //   tile: { x, y: y - 2 }, // entry
      // }
    }
    if (i == chamberData.doors[Crawler.Dir.East]) {
      result.map2.world[y][x + 1] = tile
      result.map2.world[y][x + 2] = tile
      // result.portal[nanoid()] = {
      //   slug: slug,
      //   position: {},
      //   tile: { x: x + 2, y }, // entry
      // }
    }
    if (i == chamberData.doors[Crawler.Dir.West]) {
      result.map2.world[y][x - 1] = tile
      result.map2.world[y][x - 2] = tile
      // result.portal[nanoid()] = {
      //   slug: slug,
      //   position: {},
      //   tile: { x: x - 2, y }, // entry
      // }
    }
    if (i == chamberData.doors[Crawler.Dir.South]) {
      result.map2.world[y + 1][x] = tile
      result.map2.world[y + 2][x] = tile
      // result.portal[nanoid()] = {
      //   slug: slug,
      //   position: {},
      //   tile: { x, y: y + 2 }, // entry
      // }
    }
    // Entry door
    if (i == chamberData.doors[chamberData.entryDir]) {
      result.settings.world.entry = { x, y }
    }
    // Grm / Agent
    if (i == chamberData.gemPos) {
      result.screen[nanoid()] = {
        type: TYPE.METADATA,
        name: 'Agent',
        content: '',
        page: 0,
        position: { x, y, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      }
    }
  }

  result.tileset.world =
    chamberData.terrain == Crawler.Terrain.Earth ? TilesetPaths.Library :
      chamberData.terrain == Crawler.Terrain.Water ? TilesetPaths.Warehouse :
        chamberData.terrain == Crawler.Terrain.Air ? TilesetPaths.Castle :
          chamberData.terrain == Crawler.Terrain.Fire ? TilesetPaths.Dungeon :
            null

  // console.log(`crawlerSlugToRoom()`, result)
  return result
}

