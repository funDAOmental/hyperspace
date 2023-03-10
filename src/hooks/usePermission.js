import { useMemo } from 'react'
import { useRoomContext } from '@/hooks/RoomContext'
import { useDocument } from '@/hooks/useDocument'
import useVerida from '@/hooks/useVerida'

const usePermission = (id) => {
  const { veridaIsConnected, veridaProfile, did, didAddress } = useVerida()
  const { Permission } = useRoomContext()

  const docPermission = useDocument('permission', id)
  const roomPermission = useDocument('permission', id != 'world' ? 'world' : null)

  const isOwner = useMemo(() => (veridaIsConnected && docPermission?.owner == didAddress), [veridaIsConnected, docPermission])
  const canView = useMemo(() => (isOwner || Permission?.canView(id)), [id, isOwner, Permission, docPermission, roomPermission])
  const canEdit = useMemo(() => (isOwner || Permission?.canEdit(id)), [id, isOwner, Permission, docPermission, roomPermission])

  return {
    permission: docPermission,
    isOwner,
    canView,
    canEdit,
  }
}

export default usePermission