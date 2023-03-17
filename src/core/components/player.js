import * as THREE from 'three'
import RoomCollection from '@/core/interfaces/RoomCollection'
import { defaultSettings } from '@/core/components/settings'
import { getTextureByName, getTextureSprite } from '@/core/textures'
import { CONST, clamp, clampRadians, deepCompare, deepCopy } from '@/core/utils'
import { floors } from '@/core/components/map'
import { strokeRect } from '@/core/rendering/debug-render'
import { getOverlappingTiles, rectanglesOverlap } from '@/core/collisions'
import { spritesheets } from '@/core/texture-data'
import { hashCode } from '@/core/utils'
import Cookies from 'universal-cookie'

const SPEED = 125
const PLAYER_BOX = 16
const PLAYER_RADIUS = 8
const PLAYER_MESH = 1.4
const CAM_Z_OFFSET = 1.15
const GRAVITY = 25
const MAX_Z_SPEED = 100
const JUMP_SPEED = 7.5
let zSpeed = 0
let grounded = false

class Player extends RoomCollection {
  constructor(room) {
    super(room, 'player')

    this.actions.addActionDownListener('interact', () => {
      this.interact(this.agentId)
    })

    this.actions.addActionDownListener('delete', () => {
      const editor = this.remoteStore.getDocument('editor', this.agentId)
      if (editor === null) {
        return
      }
      this.Portal.remove(this.getPortalOverPlayer(this.agentId), true)
      this.Trigger.remove(this.getTriggerOverPlayer(this.agentId), true)
      this.Screen.remove(this.getScreenOverPlayer(this.agentId), true)
    })

    const scene = this.localStore.getDocument('scene', 'scene')

    if (scene == null) {
      return // no 3d render
    }

    this.localStore.setDocument('joined', this.agentId, false)

    this.clientRoom.on('agent-join', (agentId) => {
      if (agentId === this.agentId) {
        console.log(`[${this.slug}] agent-join:`, agentId, '(YOU)')
        this.enterRoom(agentId, this.slug)
        return
      }

      const material = this.makePlayerMaterial(agentId)
      const geometry = new THREE.PlaneGeometry(PLAYER_MESH, PLAYER_MESH);
      const playerMesh = new THREE.Mesh(geometry, material);
      scene.add(playerMesh);

      this.localStore.setDocument('player-mesh', agentId, playerMesh)
      console.log(`[${this.slug}] agent-join:`, agentId)
    })

    this.clientRoom.on('agent-leave', (agentId) => {
      const playerMesh = this.localStore.getDocument('player-mesh', agentId)

      if (scene !== null && playerMesh !== null) {
        scene.remove(playerMesh)
      }

      this.localStore.setDocument('player-mesh', agentId, null)
      console.log(`[${this.slug}] agent-leave:`, agentId)
    })

    this.remoteStore.on({ type: 'player', event: 'update' }, (agentId, player) => {
      // console.log(`[${this.slug}] agent-update:`, agentId)
      if (agentId == this.agentId) {
        // we moved: update all other players
        const playerIds = this.remoteStore.getIds('player')
        for (const id of playerIds) {
          if (id != this.agentId && this.clientRoom.hasAgentId(id)) {
            this.update3dSprite(id)
          }
        }
      } else {
        // another player moved
        this.update3dSprite(agentId)
      }
    })

    // texture swapping
    this.agentStore.on({ type: 'profile', event: 'change' }, (agentId, profile) => {
      const playerMesh = this.localStore.getDocument('player-mesh', agentId)

      if (playerMesh !== null) {
        const material = this.makePlayerMaterial(agentId)
        playerMesh.material = material;
        playerMesh.needsUpdate = true;
        // console.log(`CHANGE MATERIAL`, agentId, material)
      }
    })
  }

  makePlayerMaterial(agentId) {
    const texture = this.getPlayerTexture(agentId)
    const materialTexture = new THREE.TextureLoader().load(texture.src);
    materialTexture.minFilter = THREE.NearestFilter;
    materialTexture.magFilter = THREE.NearestFilter;
    const material = new THREE.MeshBasicMaterial({
      map: materialTexture,
      side: THREE.DoubleSide,
      transparent: true,
    });
    return material;
  }

  update3dSprite(id) {
    if (id === this.agentId) {
      return;
    }

    const playerMesh = this.localStore.getDocument('player-mesh', id)
    if (playerMesh === null) {
      return;
    }

    const player = this.remoteStore.getDocument('player', id)
    if (player === null) {
      return
    }

    // Position
    const { position: { x, y, z }, rotation } = player
    playerMesh.position.set(
      x / 32,
      - y / 32,
      z + PLAYER_MESH / 2,
    )

    // Rotation (billboard) 
    const thisPlayer = this.remoteStore.getDocument('player', this.agentId)
    const rotToThisPlayer = Math.atan2(y - thisPlayer.position.y, x - thisPlayer.position.x) - CONST.HALF_PI;
    playerMesh.rotation.set(
      CONST.HALF_PI,
      -rotToThisPlayer,
      0
    )

    // UV
    const texture = this.getPlayerTexture(id)

    const rot = -(player.rotation.y + rotToThisPlayer + CONST.PI);
    const sprite = this.getPlayerSprite(texture, x, y, rot);
    if (!sprite) return

    const { uv } = sprite

    var geometryUv = playerMesh.geometry.getAttribute('uv');

    // 2 3
    // 0 1
    geometryUv.setXY(0, uv.start[0], 1.0 - uv.start[1]);
    geometryUv.setXY(1, uv.end[0], 1.0 - uv.start[1]);
    geometryUv.setXY(2, uv.start[0], 1.0 - uv.end[1]);
    geometryUv.setXY(3, uv.end[0], 1.0 - uv.end[1]);
    geometryUv.needsUpdate = true;

    playerMesh.geometry.setAttribute('uv', geometryUv);

    // Scale
    const aspect = texture.sprites?.aspect ?? texture.aspect ?? 1.0;
    playerMesh.scale.set(
      aspect,
      1.0,
      1
    )

  }

  // We should add a delete portal button too.
  interact(id) {
    const portalId = this.getPortalOverPlayer(id)
    if (portalId) {
      this.Portal.travel(portalId)
      return
    }

    const triggerId = this.getTriggerOverPlayer(id)
    if (triggerId) {
      this.Trigger.switchState(triggerId)
      return
    }

    const screenId = this.getScreenOverPlayer(id)
    if (screenId) {
      const currentScreenId = this.localStore.getDocument('screens', 'editing')
      const newScreenId = screenId != currentScreenId ? screenId : null

      if (newScreenId && !this.canView(newScreenId)) {
        return
      }

      this.localStore.setDocument('screens', 'editing', newScreenId)
      return
    }
  }

  getPortalOverPlayer(id) {
    const portalId = this.getObjectOfTypeOverPlayer(id, 'portal')
    return portalId && this.canView(portalId) ? portalId : null
  }

  getTriggerOverPlayer(id) {
    const triggerId = this.getObjectOfTypeOverPlayer(id, 'trigger')
    return triggerId && this.canView(triggerId) ? triggerId : null
  }

  getScreenOverPlayer(id) {
    if (this.getPortalOverPlayer(id)) return null
    if (this.getTriggerOverPlayer(id)) return null

    let screenId = null

    const profile = this.agentStore.getDocument('profile', id)
    if (profile.view3d) {
      screenId = this.localStore.getDocument('screens', 'facing-3d')
    } else {
      screenId = this.getObjectOfTypeOverPlayer(id, 'screen')
    }

    return screenId && this.canView(screenId) ? screenId : null
  }

  canPlaceOverPlayer(id) {
    return (
      this.getPortalOverPlayer(id) == null &&
      this.getScreenOverPlayer(id) == null &&
      this.getTriggerOverPlayer(id) == null
    );
  }

  getObjectOfTypeOverPlayer(id, type) {
    const target = this.getObjectOverPlayer(id)
    return target?.type == type ? target.id : null
  }

  getObjectOverPlayer(id) {
    const playerRect = this.getPlayerCollisionRect(id);
    if (playerRect == null) return

    for (const type of ['portal', 'trigger', 'screen']) {
      const ids = this.remoteStore.getIds(type)
      for (const id of ids) {
        const rect = this.getCollisionRect(type, id)
        if (rect && rectanglesOverlap(playerRect, rect)) {
          return {
            type,
            id,
          }
        }
      }
    }
    return null;
  }

  getCollisionRect(type, id) {
    const data = this.remoteStore.getDocument(type, id)
    if (!data || !data.position) return null
    return {
      position: {
        x: data.position.x * 32,
        y: data.position.y * 32,
      },
      size: {
        width: 32,
        height: 32,
      },
    }
  }

  enterRoom(agentId, slug) {
    this.localStore.setDocument('joined', agentId, true)

    const cookies = new Cookies()

    // portal navigation
    let portalCookie = cookies.get('portal') ?? null
    if (portalCookie) {
      if (portalCookie.agentId == agentId) {
        // coming in from a portal
        if (portalCookie.to == slug) {
          portalCookie.to = null
          cookies.set('portal', JSON.stringify(portalCookie), { path: '/' })
          this.moveToTile(agentId, portalCookie.entry)
          return
        }
        // coming back from a portal
        if (portalCookie.from == slug) {
          cookies.remove('portal')
          this.moveToTile(agentId, portalCookie.exit)
          return
        }
      }
      cookies.remove('portal')
    }

    // go to default entry
    const settings = this.remoteStore.getDocument('settings', 'world') ?? defaultSettings
    this.moveToTile(agentId, settings.entry)
  }

  moveToTile(id, tile) {
    let player = this.remoteStore.getDocument('player', id)

    if (player === null) {
      player = {
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
        rotation: {
          x: 0,
          y: Math.PI,
          z: 0,
        }
      }
    }

    const position = this.Map.fromTileToCanvasPosition(tile?.x, tile?.y)
    player.position.x = position.x
    player.position.y = position.y
    this.remoteStore.setDocument('player', id, player)
  }

  getPlayerTileRotation(id) {
    const player = this.remoteStore.getDocument('player', id)
    if (player === null) return null

    const { x, y } = player.position
    const { y: rot } = player.rotation

    return {
      x: Math.floor(x / 32),
      y: Math.floor(y / 32),
      rot,
    }
  }

  getPlayerCollisionRect(id) {
    const player = this.remoteStore.getDocument('player', id)
    if (player === null) return null

    const { x, y } = player.position

    return this.fromPosToRect(x, y)
  }

  fromPosToRect(x, y) {
    return {
      position: {
        x: Math.round(x - PLAYER_RADIUS),
        y: Math.round(y - PLAYER_RADIUS),
      },
      size: {
        width: PLAYER_BOX,
        height: PLAYER_BOX,
      },
    }
  }

  update(id, dt) {
    const player = this.remoteStore.getDocument('player', id)
    if (player === null) {
      return
    }

    let { position: { x, y, z }, rotation } = player
    const rotationCopy = deepCopy(rotation)

    const profile = this.agentStore.getDocument('profile', id)
    const view3d = profile.view3d ?? false

    if (view3d) {
      const angle = new THREE.Euler(CONST.HALF_PI, rotation.y, rotation.z)

      const forward = new THREE.Vector3(0, 0, 1)
      const right = new THREE.Vector3(1, 0, 0)

      forward.applyEuler(angle)
      right.applyEuler(angle)

      const forwardMove = new THREE.Vector3(0, 0, 0)
      const sideMove = new THREE.Vector3(0, 0, 0)

      forwardMove.add(forward.setLength(SPEED * dt))
      sideMove.add(right.setLength(SPEED * dt))

      if (this.actions.getActionState('left')) {
        x -= sideMove.x
        y += sideMove.y
      }

      if (this.actions.getActionState('right')) {
        x += sideMove.x
        y -= sideMove.y
      }

      if (this.actions.getActionState('up')) {
        x -= forwardMove.x
        y += forwardMove.y
      }

      if (this.actions.getActionState('down')) {
        x += forwardMove.x
        y -= forwardMove.y
      }

      if (this.actions.getActionState('turnLeft')) {
        rotationCopy.y += Math.PI * dt
      }
      if (this.actions.getActionState('turnRight')) {
        rotationCopy.y -= Math.PI * dt
      }
      if (this.actions.getActionState('moveBack')) {
        rotationCopy.x -= Math.PI * dt * 0.75
        if (rotationCopy.x < -Math.PI * 0.25) {
          rotationCopy.x = -Math.PI * 0.25
        }
      }
      if (this.actions.getActionState('moveForward')) {
        rotationCopy.x += Math.PI * dt * 0.75
        if (rotationCopy.x > +Math.PI * 0.15) {
          rotationCopy.x = +Math.PI * 0.15
        }
      }

    } else {
      let speedX = 0;
      let speedY = 0;

      if (this.actions.getActionState('left') || this.actions.getActionState('turnLeft')) {
        speedX -= SPEED;
      }
      if (this.actions.getActionState('right') || this.actions.getActionState('turnRight')) {
        speedX += SPEED;
      }
      if (this.actions.getActionState('up') || this.actions.getActionState('moveForward')) {
        speedY -= SPEED;
      }
      if (this.actions.getActionState('down') || this.actions.getActionState('moveBack')) {
        speedY += SPEED;
      }

      if (speedX || speedY) {
        x += speedX * dt
        y += speedY * dt
        if (speedY) {
          rotationCopy.y = CONST.HALF_PI + (CONST.HALF_PI * Math.sign(speedY))
        } else if (speedX) {
          rotationCopy.y = Math.PI + (CONST.HALF_PI * Math.sign(speedX))
        }
      }
    }

    const overlappingTiles = getOverlappingTiles(this.fromPosToRect(x, player.position.y), 32)
    for (let i = 0; i < overlappingTiles.length; i++) {
      const tile = this.Map.getTile('world', overlappingTiles[i].x, overlappingTiles[i].y)

      if (tile !== null) {
        const currentFloorHeight = floors[tile]

        if (z < currentFloorHeight - 0.75) {
          x = player.position.x
          // y = player.position.y

          break
        }
      }
    }

    const overlappingTiles3 = getOverlappingTiles(this.fromPosToRect(player.position.x, y), 32)
    for (let i = 0; i < overlappingTiles3.length; i++) {
      const tile = this.Map.getTile('world', overlappingTiles3[i].x, overlappingTiles3[i].y)

      if (tile !== null) {
        const currentFloorHeight = floors[tile]

        if (z < currentFloorHeight - 0.75) {
          // x = player.position.x
          y = player.position.y

          break
        }
      }
    }

    x = clamp(x, PLAYER_RADIUS, process.env.BASE_WIDTH - PLAYER_RADIUS)
    y = clamp(y, PLAYER_RADIUS, process.env.BASE_HEIGHT - PLAYER_RADIUS)

    // const tile = this.Map.getTile('world', x, y)

    zSpeed += GRAVITY * dt
    zSpeed = Math.min(zSpeed, MAX_Z_SPEED)

    if (this.actions.getActionState('jump') && grounded) {
      zSpeed = -JUMP_SPEED
      grounded = false
    }

    z -= zSpeed * dt

    // const floorHeight = tile === null ? 0 : floors[tile]

    // if (z < floorHeight) {
    //   z = floorHeight
    //   zSpeed = 0
    //   grounded = true
    // }

    const overlappingTiles2 = getOverlappingTiles(this.fromPosToRect(x, y), 32)
    for (let i = 0; i < overlappingTiles2.length; i++) {
      const tile = this.Map.getTile('world', overlappingTiles2[i].x, overlappingTiles2[i].y)

      if (tile !== null) {
        const currentFloorHeight = floors[tile]

        if (z < currentFloorHeight) {
          z = currentFloorHeight
          zSpeed = 0
          grounded = true
        }
      }
    }

    if (player.position.x !== x || player.position.y !== y || player.position.z !== z || deepCompare(rotation, rotationCopy) === false) {

      rotationCopy.y = clampRadians(rotationCopy.y);

      this.remoteStore.setDocument('player', id, {
        position: {
          x,
          y,
          z,
        },
        rotation: rotationCopy,
      })
    }

    const cameraOrbit = this.localStore.getDocument('cameraOrbit', 'cameraOrbit')
    const camera = this.localStore.getDocument('camera', 'camera')

    if (cameraOrbit === null) {
      return
    }

    if (cameraOrbit !== null) {
      cameraOrbit.position.set(
        x / 32,
        - y / 32,
        CAM_Z_OFFSET + z,
      )

      cameraOrbit.rotation.set(
        CONST.HALF_PI,
        rotation.y,
        rotation.z
      )

      camera.rotation.set(
        rotation.x,
        0,
        0
      )
    }
  }

  render2d(id, context) {
    const player = this.remoteStore.getDocument('player', id)
    if (player === null) return

    const joined = this.localStore.getDocument('joined', id) ?? null
    if (joined === false) return

    const { position: { x, y }, rotation } = player

    const texture = this.getPlayerTexture(id)
    if (!texture) return // texture not loaded yet

    strokeRect(context, this.getPlayerCollisionRect(id))

    let scale = texture.scale;
    let sWidth = texture.width;
    let sHeight = texture.height;
    let sx = 0;
    let sy = 0;

    if (texture.sprites) {
      scale = texture.sprites.scale ?? scale;
      sWidth = texture.sprites.width;
      sHeight = texture.sprites.height;

      const { pixel } = this.getPlayerSprite(texture, x, y, rotation.y);

      sx = pixel.start[0];
      sy = pixel.start[1];
    }

    const dWidth = sWidth * scale;
    const dHeight = sHeight * scale;
    const dx = Math.round(x - (dWidth / 2));
    const dy = Math.round(y - dHeight + PLAYER_RADIUS);

    context.drawImage(
      texture.image,
      sx, sy,
      sWidth, sHeight,
      dx, dy,
      dWidth, dHeight,
    )

  }

  getPlayerTexture(agentId = '') {
    const profile = this.agentStore.getDocument('profile', agentId)

    let texture = getTextureByName(profile?.spritesheet)

    if (!texture) {
      texture = getTextureByName(this.getPlayerTextureName(agentId))
    }

    return texture
  }

  getPlayerTextureName(agentId = '') {
    const index = Math.abs(hashCode(agentId)) % spritesheets.length
    return spritesheets[index].src
  }


  getPlayerSprite(texture, x, y, rot) {
    let cycleName;

    rot = clampRadians(rot);
    if (Math.abs(rot - CONST.HALF_PI) <= CONST.QUATER_PI) {
      cycleName = 'walkLeft';
    } else if (Math.abs(rot - (CONST.HALF_PI + Math.PI)) <= CONST.QUATER_PI) {
      cycleName = 'walkRight';
    } else if (Math.abs(rot - Math.PI) <= CONST.QUATER_PI) {
      cycleName = 'walkDown';
    } else {
      cycleName = 'walkUp';
    }

    const stepX = x / 32.0;
    const stepY = y / 32.0;

    return getTextureSprite(texture, stepX, stepY, cycleName)
  }
}

export default Player
