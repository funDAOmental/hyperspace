import React, { useState, useEffect, useRef } from 'react'
import {
  HStack,
  Spacer,
  Text,
  Input,
  Box,
  VStack,
} from '@chakra-ui/react'
import { useRoomContext } from '@/hooks/RoomContext'
import { SettingsActions, useSettingsContext } from '@/hooks/SettingsContext'
import { useRemoteDocument, useLocalDocument } from '@/hooks/useDocument'
import { useVeridaContext } from '@/hooks/VeridaContext'
import { useMetadata } from '@/hooks/useMetadata'
import usePermission from '@/hooks/usePermission'
import { Button } from '@/components/Button'
import Textarea from '@/components/Textarea'
import { SliderPage, SliderProgress } from '@/components/Sliders'
import { getFilenameFromUrl, getScrollProg } from '@/core/utils/utils'
import { TYPE } from '@/core/components/screen'
import CodeEditor from '@/components/CodeEditor'
import MonacoEditor from '@/components/MonacoEditor'

//----------------------
// Generic Screen Editor
//
const ScreenEditor = ({
  screenId,
  initialFocusRef,
  options = {},
}) => {
  const screen = useRemoteDocument('screen', screenId)
  const { canEdit } = usePermission(screenId)

  const _disabled = !screen || !canEdit

  if (screen?.type == TYPE.DOCUMENT) {
    return <ScreenEditorDocument language='markdown' screen={screen} screenId={screenId} initialFocusRef={initialFocusRef} options={options} disabled={_disabled} />
  }

  if (screen?.type == TYPE.METADATA) {
    return <ScreenEditorMetadata screen={screen} screenId={screenId} />
  }

  if (screen?.type == TYPE.PDF_BOOK) {
    return <ScreenEditorPdfBook screen={screen} screenId={screenId} initialFocusRef={initialFocusRef} options={options} disabled={_disabled} />
  }

  return (
    <div className='FillParent ScreenError'>
      Invalid screen type [{screen?.type}]
    </div>
  )
}

export default ScreenEditor


//---------------------------
// Specialized Screen Editors
//

const ScreenEditorMetadata = ({
  screen,
  screenId,
}) => {
  useMetadata(screenId)
  
  return (
    <ScreenEditorDocument language='json' screen={screen} screenId={screenId} readOnly={true} />
  )
}


const ScreenEditorDocument = ({
  language = null,
  screen,
  screenId,
  disabled = false,
  initialFocusRef,
  readOnly = false,
  options = {},
}) => {
  const { Screen } = useRoomContext()
  const { veridaIsConnected, retrieveLastTweet } = useVeridaContext()
  const outerDiv = useRef()
  const innerDiv = useRef()

  const [content, setContent] = useState('')
  useEffect(() => {
    setContent(screen?.content ?? `Screen [${screenId}] not found`)
  }, [screen?.content])

  const _onContentChange = (value) => {
    if (readOnly) return
    Screen.updateScreen(screenId, {
      content: value,
    })
  }

  const _onProgressChange = (value) => {
    Screen.updateScreen(screenId, {
      page: value,
    })
  }

  const _handleScroll = (e) => {
    const scrollProg = getScrollProg(outerDiv.current)
    // _onProgressChange(scrollProg) // it deselects the CodeEditor text!!!!
    // console.log(initialFocusRef.current.selectionStart, initialFocusRef.current.selectionEnd) // not working!!
    // console.log(initialFocusRef)
  }

  useEffect(() => {
    outerDiv.current?.addEventListener('scroll', _handleScroll, false)
    return () => {
      outerDiv.current?.removeEventListener('scroll', _handleScroll, false)
    }
  }, [outerDiv.current])

  const [isFetchingTweet, setIsFetchingTweet] = useState(false)
  const _lastTweet = async () => {
    setIsFetchingTweet(true)
    const tweet = await retrieveLastTweet()
    setIsFetchingTweet(false)
    console.warn(`USE THIS TWEET:`, tweet)
  }

  // editor options
  const {
    editorPreview,
    editorLineNumbers,
    editorWordWrap,
    editorMiniMap,
    dispatchSettings,
  } = useSettingsContext()

  return (
    <div className='FillParent'>
      <VStack align='stretch'>
        <HStack>
          <Button size='sm' toggleState={editorLineNumbers} onClick={() => dispatchSettings(SettingsActions.SET_EDITOR_LINE_NUMBERS, !editorLineNumbers)}>
            #Lines
          </Button>
          <Button size='sm' toggleState={editorWordWrap} onClick={() => dispatchSettings(SettingsActions.SET_EDITOR_WORD_WRAP, !editorWordWrap)}>
            Wrap
          </Button>
          <Button size='sm' toggleState={editorMiniMap} onClick={() => dispatchSettings(SettingsActions.SET_EDITOR_MINI_MAP, !editorMiniMap)}>
            MiniMap
          </Button>

          <Spacer />

          {veridaIsConnected &&
            <>
              <Button size='sm' onClick={async () => await _lastTweet()} disabled={!veridaIsConnected || isFetchingTweet}>
                Append Last Tweet
              </Button>
              <Spacer />
            </>
          }

          <Button size='sm' toggleState={editorPreview} onClick={() => dispatchSettings(SettingsActions.SET_EDITOR_PREVIEW, !editorPreview)}>
            Preview
          </Button>
        </HStack>

        <div className='CodeEditor ScrollContainer' ref={outerDiv}>
          <div className='ScrollContent ' ref={innerDiv}>
            {!language &&
              <Textarea
                ref={initialFocusRef}
                content={content}
                onChange={(value) => _onContentChange(value)}
                disabled={disabled}
                minRows={options.minRows}
                maxRows={options.maxRows}
                readOnly={readOnly}
              />}
            {language &&
              <MonacoEditor
                language={language}
                content={content}
                onChange={(value) => _onContentChange(value)}
                disabled={disabled}
                readOnly={readOnly}
                lineNumbers={editorLineNumbers}
                wordWrap={editorWordWrap}
                miniMap={editorMiniMap}
              />
              // <CodeEditor
              //   language={language}
              //   ref={initialFocusRef}
              //   content={content}
              //   onChange={(value) => _onContentChange(value)}
              //   disabled={disabled}
              //   minRows={options.minRows}
              //   maxRows={options.maxRows}
              //   readOnly={readOnly}
              // />
            }
          </div>
        </div>

        <Spacer />
        <SliderProgress value={screen?.page ?? 0} onChange={(value) => _onProgressChange(value)} />
      </VStack>
    </div>
  )
}



//-------------------------------------
// PDF Editor
//
const ScreenEditorPdfBook = ({
  screen,
  screenId,
  disabled = true,
  initialFocusRef,
  options = {},
}) => {
  const { Screen } = useRoomContext()
  const pageCount = useLocalDocument('page-count', screenId) ?? 1

  const _onContentChange = (e) => {
    const url = e.target.value
    const name = getFilenameFromUrl(url) ?? undefined
    Screen.updateScreen(screenId, {
      content: url,
      name,
    })
  }

  const _onProgressChange = (value) => {
    Screen.updateScreen(screenId, {
      page: value,
    })
  }

  return (
    <VStack align='stretch'>
      <HStack>
        <Text>URL:</Text>
        <Input
          ref={initialFocusRef}
          value={screen?.content ?? `Screen [${screenId}] not found`}
          onChange={(e) => _onContentChange(e)}
          disabled={disabled}
        />
      </HStack>
      <SliderPage defaultValue={screen?.page ?? 1} pageCount={pageCount} onChange={(value) => _onProgressChange(value)} disabled={disabled} />
    </VStack>
  )
}

