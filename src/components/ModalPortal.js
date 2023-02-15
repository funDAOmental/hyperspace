import React, { useState, useRef } from 'react'
import {
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Input,
} from '@chakra-ui/react'
import Button from '@/components/Button'

const ModalPortal = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [roomName, setRoomName] = useState('');
  const roomNameRef = useRef()

  return (
    <Modal
      isOpen={isOpen}
      // onAfterOpen={() => onAfterOpen()}
      onClose={() => onClose()}
      initialFocusRef={roomNameRef}
      isCentered
    >
      <ModalOverlay
        bg='none'
        backdropFilter='auto'
        backdropBlur='6px'
      />
      <ModalContent
        backgroundColor='#000a'
        boxShadow='hyperShadow'
      >
        <ModalHeader>
          Room Name
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={4}>
          <VStack spacing={4}>
            <Input
              w='100%'
              focusBorderColor='teal.500'
              placeholder=''
              ref={roomNameRef}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => { if (e.code == 'Enter') onSubmit(roomName) }}
            />
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button
            variant='outline'
            fullWidth
            value={roomName.length > 0 ? 'Create / Enter Room' : 'Create Casual Room'}
            onClick={() => onSubmit(roomName)}
            type='submit'
          />
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ModalPortal
