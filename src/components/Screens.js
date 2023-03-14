import { useEffect, useMemo } from 'react'
import { useRoomContext } from '@/hooks/RoomContext'
import { emitAction } from '@/core/controller'
import { useDocument, useLocalDocument } from '@/hooks/useDocument'
import { useRemoteDocumentIds } from '@/hooks/useDocumentIds'
import usePermission from '@/hooks/usePermission'
import ModalScreenEdit from '@/components/ModalScreenEdit'
import { ScreenBook } from '@/components/ScreenBook'
import { TYPE } from '@/core/components/screen'

const Screens = ({ }) => {
  const { localStore, Screen } = useRoomContext()
  const screenIds = useRemoteDocumentIds('screen')
  const is3d = useLocalDocument('show-3d', 'world') ?? false
  const editingScreenId = useLocalDocument('screens', 'editing')
  const facingScreenId = useLocalDocument('screens', 'facing-3d')
  const { permission, isOwner, canEdit, canView } = usePermission(editingScreenId)

  const screensComponents = useMemo(() => {
    let result = []
    for (const screenId of screenIds) {
      const overlayScreen = (screenId == editingScreenId && !is3d)
      const selectedScreen = (screenId == editingScreenId || screenId == facingScreenId)
      result.push(
        <div key={screenId}
          className='FillParent Absolute'
          style={{
            zIndex: overlayScreen ? '100' : '-100',
          }}
        >
          <div id={screenId}
            className={`FillParent Clickable ${selectedScreen ? 'ScreenBackground' : 'ClearBackground'}`}
            onClick={() => localStore.setDocument('screens', 'editing', null)}
          >
            <ScreenComponent screenId={screenId} />
            {selectedScreen &&
              <div className='ScreenBorder' />
            }
          </div>
        </div>
      )
    }

    return result
  }, [screenIds.length, editingScreenId, facingScreenId, is3d, canEdit, canView])

  useEffect(() => {
    emitAction('syncScreens')
  }, [screensComponents])

  return (
    <div className='FillParent'>
      {screensComponents}
      <ModalScreenEdit screenId={editingScreenId} />
    </div>
  )
}

export default Screens

//-------------------------
// Generic Screen component
//
const ScreenComponent = ({
  screenId,
}) => {
  const screen = useDocument('screen', screenId)

  if (screen?.type == TYPE.DOCUMENT) {
    return <DocumentScreen screenId={screenId} content={screen.content || `# Screen [${screenId}] has no content`} />
  }

  if (screen?.type == TYPE.PDF_BOOK) {
    return <ScreenBook screenId={screenId} url={screen.content} page={screen.page} />
  }

  return (
    <div className='FillParent ScreenError'>
      Invalid screen type [{screen?.type}]
    </div>
  )
}

//------------------------------
// Specialized Screen components
//

//
// Markdown document
import Markdown from '@/components/Markdown'
const DocumentScreen = ({
  screenId,
  content,
}) => {
  return (
    <Markdown>{content}</Markdown>
  )
}
