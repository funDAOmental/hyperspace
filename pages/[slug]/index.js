import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Container, Box, VStack, HStack, Text, Spacer } from '@chakra-ui/react'
import Layout from 'components/layout'
import Button from 'components/button'
import TilesetSelector from 'components/tileset-selector'
import CharacterSelector from 'components/character-selector'
import DocumentModal from 'components/document-modal'
import HelpModal from 'components/help-modal'
import InteractMenu from 'components/interact-menu'
import Screens from 'components/screens'
import Markdown from 'components/markdown'
import RoomDownloadMenu from 'components/room-download-menu'
import VeridaLogin from 'components/verida-login'
import VeridaMenu from 'components/verida-menu'
import useRoom from 'hooks/use-room'
import useDocument from 'hooks/use-document'
import useLocalDocument from 'hooks/use-local-document'
import { getLocalStore, getRemoteStore } from 'core/singleton'
import { focusGameCanvas } from 'core/gamecanvas'
import { emitAction } from 'core/controller'

const RoomPage = () => {
  const { agentId } = useRoom();
  const [showHelp, setShowHelp] = useState(false)
  const document = useDocument('document', 'world')
  const is3d = useLocalDocument('show-3d', 'world') ?? false
  const isDocOpen = useLocalDocument('show-doc', 'world') ?? false
  const router = useRouter()
  const canvasRef = useRef()
  const canvas3dRef = useRef()
  const documentRef = useRef()
  const { slug } = router.query

  useEffect(() => {
    focusGameCanvas()
  }, [is3d, canvasRef, canvas3dRef])

  const handleInputChange = e => {
    const store = getRemoteStore()
    store.setDocument('document', 'world', { content: e.target.value })
  }

  const handleClose = () => {
    const store = getLocalStore()
    store.setDocument('show-doc', 'world', false)
  }

  useEffect(() => {
    if (slug && canvasRef.current && canvas3dRef.current && documentRef.current && !agentId) {
      import('core/game').then(({ default: Game }) => {
        const game = new Game()
        game.init(slug, canvasRef.current, canvas3dRef.current, documentRef.current)
      })
    }
  }, [slug, canvasRef.current, canvas3dRef.current, documentRef.current, agentId])

  return (
    <Layout>
      <Container maxW='full'>

        <VStack align='stretch' spacing={4} shouldWrapChildren >
          <HStack>
            <CharacterSelector />
            <Button size='sm' onClick={() => emitAction('toggle3d')}>
              2D/3D
            </Button>
            <Button size='sm' onClick={() => setShowHelp(!showHelp)}>
              Help
            </Button>
            <Spacer />
            <InteractMenu />
          </HStack>

          <HStack>
            <TilesetSelector />
            <Spacer />
            <VeridaLogin />
          </HStack>

          <Box
            style={{ position: 'relative' }}
            border='1px'
            borderRadius='4px'
          >
            <canvas
              id='game'
              ref={canvasRef}
              border='1px'
              borderradius={4}
              width={process.env.CANVAS_WIDTH}
              height={process.env.CANVAS_HEIGHT}
              style={{
                width: '100%',
                height: '100%',
                borderTop: '1px solid white',
                borderBottom: '1px solid white',
                display: is3d ? 'none' : 'block',
              }}
              tabIndex='1'
            >
              Canvas not supported by your browser.
            </canvas>
            <canvas
              id='game3D'
              ref={canvas3dRef}
              border='1px'
              borderradius={4}
              width={process.env.CANVAS_WIDTH}
              height={process.env.CANVAS_HEIGHT}
              style={{
                width: '100%',
                height: '100%',
                display: is3d ? 'block' : 'none',
              }}
              tabIndex='2'
            >
              Canvas not supported by your browser.
            </canvas>

            <div id='document'
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: '0',
                left: '0',
                visibility: (isDocOpen && !is3d) ? 'visible' : 'hidden',
              }}
            >
              <div ref={documentRef} className='FillParent'>
                <Markdown>{document?.content || ''}</Markdown>
              </div>
            </div>

            <Screens />
          </Box>

          <HStack>
            <RoomDownloadMenu />
            <Spacer />
            <VeridaMenu />
          </HStack>

          {process.env.ENV == 'desenv' && <div>Agent ID: {agentId}</div>}
        </VStack>

        <DocumentModal
          finalRef={is3d ? canvas3dRef : canvasRef}
          text={document?.content || ''}
          isOpen={isDocOpen}
          onClose={handleClose}
          onInputChange={handleInputChange}
        />

        <HelpModal
          isOpen={showHelp}
          handleClose={() => setShowHelp(false)}
        />

      </Container>
    </Layout>
  )
}

export default RoomPage
