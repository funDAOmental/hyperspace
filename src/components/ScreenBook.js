import { useEffect, useState, useMemo, useRef } from 'react'
import { getLocalStore, getRemoteStore } from '@/core/singleton'
import { useDocument } from '@/hooks/useDocument'
import { getGameCanvasElement } from '@/core/game-canvas'
import { getFilenameExtensionFromUrl } from '@/core/utils'
import * as Screen from '@/core/components/screen'


export const ScreenBook = ({
  screenId,
  url,
}) => {
  const extension = useMemo(() => getFilenameExtensionFromUrl(url), [url]);

  if (extension == 'pdf') {
    return <ScreenBookPdf screenId={screenId} url={url} />
  }

  if (extension == 'jpg' || extension == 'jpeg' || extension == 'png' || extension == 'gif' || extension == 'svg') {
    return <ScreenBookImage screenId={screenId} url={url} />
  }

  return (
    <div className='FillParent ScreenError'>
      Invalid file extension [{extension}]
    </div>
  )
}


//---------------------------------------------
// Image Books
//
export const ScreenBookImage = ({
  url,
}) => {
  const [imageSize, setImageSize] = useState(null);
  const imageRef = useRef()

  const _loaded = (loaded) => {
    if (loaded) {
      setImageSize({
        width: imageRef.current.width,
        height: imageRef.current.height,
      })
    } else {
      setImageSize(null)
    }
  }

  return (
    <ScreenCenteredContainer width={imageSize?.width ?? 100} height={imageSize?.height ?? 100}>
      <img src={url} ref={imageRef} onLoad={() => _loaded(true)} onError={() => _loaded(false)} />
    </ScreenCenteredContainer>
  )
}


//---------------------------------------------
// PDF Books
// https://github.com/wojtekmaj/react-pdf
//
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import { clamp, map } from '@/core/utils'

// fix bug!...
// https://github.com/wojtekmaj/react-pdf/issues/680
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

export const ScreenBookPdf = ({
  screenId,
  url,
}) => {
  const screen = useDocument('screen', screenId)

  const [numPages, setNumPages] = useState(1);
  const [pageSizes, setPageSizes] = useState([]);

  async function _onDocumentLoadSuccess(pdf) {
    // console.log(pdf)
    let sizes = {}
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      sizes[p] = {
        width: viewport.width,
        height: viewport.height,
      }
    }

    setNumPages(pdf.numPages);
    setPageSizes(sizes)

    const store = getLocalStore()
    store.setDocument('page-count', screenId, pdf.numPages)
    console.log(`PDF ${screenId} has ${pdf.numPages} pages`)
  }

  const pageNumber = useMemo(() => {
    const _page = Math.round(map(screen?.page ?? 0, 0, 1, 1, numPages))
    return clamp(_page, 1, numPages)
  }, [screen?.page, numPages])

  const containerSize = useMemo(() => {
    let width = 0
    let height = 0

    const page = pageSizes[pageNumber]
    if (page) {
      width = page.width
      height = page.height
    }

    return {
      width,
      height,
    }
  }, [numPages, pageSizes, pageNumber])

  return (
    <ScreenCenteredContainer width={containerSize.width} height={containerSize.height}>
      <Document
        file={url}
        onLoadSuccess={_onDocumentLoadSuccess}
        className='FillParent'
      >
        <Page
          pageNumber={pageNumber}
          className='FillParent PdfBook'
          canvasBackground='white'
        />
        {/* <p>Page {pageNumber} of {numPages}</p> */}
      </Document>
    </ScreenCenteredContainer>
  )
}


const ScreenCenteredContainer = ({
  width,
  height,
  children,
}) => {
  const containerStyle = useMemo(() => {
    let scale = 0
    let topMargin = 0
    let sideMargin = 0

    if (width > 0 && height > 0) {
      const aspect = width / height

      const gameCanvas = getGameCanvasElement()
      const gameWidth = gameCanvas.clientWidth
      const gameHeight = gameCanvas.clientHeight
      const gameAspect = gameWidth / gameHeight

      if (gameAspect > aspect) {
        scale = gameHeight / height
        sideMargin = Math.floor((gameWidth - width * scale) / 2)
      } else {
        scale = gameWidth / width
        topMargin = Math.floor((gameHeight - height * scale) / 2)
      }
      // console.log(gameWidth, gameHeight, gameAspect, width, height, aspect, '>', topMargin, sideMargin, scale)
    }

    return {
      width: '100%',
      height: '100%',
      transformOrigin: 'top left',
      transform: `translate(${sideMargin}px,${topMargin}px)scale(${scale})`,
    }
  }, [width, height])

  return (
    <div style={containerStyle}>
      {children}
    </div>
  )
}

