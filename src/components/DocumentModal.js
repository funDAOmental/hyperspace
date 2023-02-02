import React, { useRef } from 'react'
import {
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react'
import Textarea from '@/components/Textarea'
import Button from '@/components/Button'
import { getLocalStore, getRemoteStore } from '@/core/singleton'

const DocumentModal = ({
  finalRef,
  isOpen,
  text,
  onClose,
  onInputChange,
}) => {
  const containerRef = useRef(null)

  function onAfterOpen() {
    text = getRemoteStore().getDocument('book', getLocalStore().getDocument('documentId', 'world'))?.text || "Error!"
  }

  return (
    <Modal
      initialFocusRef={containerRef}
      finalFocusRef={finalRef}
      isOpen={isOpen}
      onAfterOpen={() => onAfterOpen()}
      onClose={onClose}
      isCentered
      size='xl'
    >
      <ModalOverlay />
      <ModalContent
        backgroundColor='#000a'
        ref={containerRef}
      >
        <ModalHeader>
          Document editor
        </ModalHeader>
        <ModalCloseButton />
          <ModalBody pb={4}>
            <VStack spacing={4}>
              <Textarea
                value={text}
                onChange={onInputChange}
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              fullWidth
              value="Close"
              onClick={onClose}
            />
          </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default DocumentModal
