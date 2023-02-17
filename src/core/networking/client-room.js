import EventEmitter from 'events'
import Kernal from '@/core/merge/kernal'
import { createOp } from '@/core/merge/tiny-merge'
import { createMessage } from '@/core/merge/messages'
import { getRemoteStore } from '@/core/singleton'
import { typeDefs } from '@/core/merge/crdt-type'
import { getAgentId, getSnapshot, setSnapshot } from './persistence'
import Client from './client'

// uri + '/' + slug
class ClientRoom extends EventEmitter {
	constructor(uri, slug) {
		super()
		this.kernal = new Kernal(this.handleOps)
		this.store = getRemoteStore()
		this.store.on(null, this.handleStoreChange)
		this.uri = uri
		this.slug = slug.toLowerCase()
		this.agentId = getAgentId()
		this.agentIds = [
			this.agentId,
		]
	}

	init () {
		const snapshot = getSnapshot(this.slug)
		if (snapshot.length !== 0) {
			this.kernal.applyOps(snapshot, 'database')
		}

		// this.client = new Client({ uri: this.uri + '/' + this.slug })
		this.client = new Client(
			{ uri: this.uri + '/api/room/' + this.slug + '/websocket' },
			this.kernal,
		)
		this.client.addListener('open', this.handleOpen)
		this.client.addListener('close', this.handleClose)
		this.client.addListener('error', this.handleError)
		this.client.addListener('message', this.handleMessage)
	}

	sendMessage (message) {
		this.client.addMessage(message)
	}

	handleOpen = () => {
		const ops = this.kernal.getSnapshotOps()
		this.client.addMessage(createMessage.connect(this.agentId, ops))
	}

	handleClose = () => {}
	handleError = () => {}
	handlePatch = () => {}

	getSnapshotOps = () => {
		return this.kernal.getSnapshotOps()
	}

	applySnapshotOps = (ops) => {
		this.kernal.applyOps(ops, 'database')
	}

	handleStoreChange = (source, type, id, path, value) => {
		if (source === 'local') {
			const op = createOp(
				this.kernal.versions[type],
				type,
				id,
				path,
				[this.kernal.latestSeq + 1, this.agentId],
				value,
			)

			this.kernal.applyOps([op], source)
		}
	}

	handleOps = (ops, source) => {
		if (source === 'remote') {
			// Ideally we'd be pushing ops somewhere and then periodically squashing them.
			setSnapshot(this.slug, this.kernal.getSnapshotOps())
		} else if (source === 'local') {
			// this.client.addMessage(createMessage.patch(ops))
			// Add changes...
			this.client.addOps(ops)

			// Ideally we'd be pushing ops somewhere and then periodically squashing them.
			setSnapshot(this.slug, this.kernal.getSnapshotOps())
		}

		if (source !== 'local') {
			for (const { type, key, pathIndex, value } of ops) {
				const typeDef = typeDefs[type]
				const pathArr = typeDef.paths[pathIndex]
				const path = `/${pathArr.join('.')}`
				this.store.setValueAtPath(type, key, path, value, source)
			}
		}
	}

	addAgentId = (agentId) => {
		if (!this.hasAgentId(agentId)) {
      this.agentIds.push(agentId)
		}
		this.emit('agent-join', agentId)
	}

	removeAgentId = (agentId) => {
		if (!this.hasAgentId(agentId)) {
			return
		}
		this.agentIds = this.agentIds.filter((id) => id !== agentId)
		this.emit('agent-leave', agentId)
	}

	hasAgentId = (agentId) => {
		return this.agentIds.some((id) => id === agentId)
	}

	handleMessage = (message) => {
		switch (message.type) {
			case 'connect': {
				this.kernal.applyOps(message.ops, 'remote')
				break
			}
			case 'patch': {
				this.kernal.applyOps(message.ops, 'remote')
				break
			}
			case 'connected': {
				this.addAgentId(message.agentId)
				break
			}
			case 'disconnected': {
				this.removeAgentId(message.agentId)
				break
			}
		}
	}
}

export default ClientRoom
