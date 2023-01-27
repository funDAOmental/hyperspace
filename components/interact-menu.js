import { useEffect, useState, useMemo } from 'react'
import { HStack } from '@chakra-ui/react'
import Button from 'components/button'
import useRoom from 'hooks/use-room'
import usePlayer from 'hooks/use-player'
import useDocument from 'hooks/use-document'
import { emitAction } from 'core/controller'

const InteractMenu = ({
  customTileset,
  onSelect,
}) => {
  const { agentId } = useRoom();
  const {
    canPlace,
    overPortal, portalId, portalName,
    overBook, bookId,
    overDocument, documentId,
    tileX, tileY,
  } = usePlayer(agentId)

  const editor = useDocument('editor', agentId)

  return (
    <HStack>
      {canPlace &&
        <>
          {editor?.interacting
            ? <>Edit@[{editor.position.x},{editor.position.y}]&nbsp;</>
            : <>Player@[{tileX},{tileY}]&nbsp;</>
          }
          <Button size='sm' onClick={() => emitAction('createPortal')}>
            Create [P]ortal
          </Button>
          <Button size='sm' onClick={() => emitAction('createBook')}>
            Create [B]ook
          </Button>
        </>
      }

      {overPortal &&
        <>
          Portal [<b>{portalName}</b>]
          <Button size='sm' onClick={() => emitAction('interact')}>
            [E]nter
          </Button>
          <Button size='sm' onClick={() => emitAction('delete')}>
            [Del]ete
          </Button>
        </>
      }

      {overBook &&
        <>
          Book [<b>{bookId}</b>]
          <Button size='sm' onClick={() => emitAction('interact')}>
            r[E]ad
          </Button>
          <Button size='sm' onClick={() => emitAction('delete')}>
            [Del]ete
          </Button>
        </>
      }

      {overDocument &&
        <>
          Document [<b>{documentId}</b>]
          <Button size='sm' onClick={async () => await lastTweet()}>
            Last Tweet
          </Button>
          <Button size='sm' onClick={() => emitAction('interact')}>
            Edit Document
          </Button>
        </>
      }

    </HStack>
  )
}

export default InteractMenu
