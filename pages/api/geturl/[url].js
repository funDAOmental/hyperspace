import { hexToString } from 'viem'

// /api/geturl/0x68747470733a2f2f687970657273706163652e73746167652e66756e64616f6d656e74616c2e636f6d2f677261766974792e6a7067
// (https://hyperspace.stage.fundaomental.com/gravity.jpg)
export default async function api(req, res) {
  const { url: urlHex } = req.query

  const url = hexToString(urlHex)
  
  console.log(`GETURL:`, url)

  const response = await fetch(url, {})
    .then(r => r)
    // .then(data => data )
    .catch(e => {
      const error = `fetch(${url}): Null response`
      console.warn(error, e)
      return res.status(500).json({
        error,
        exception: e.toString(),
        query: req.query,
      })
    })

  if (!response) {
    const error = `fetch(${url}): Null response`
    console.warn(error)
    return res.status(500).json({
      error,
      query: req.query,
    })
  }

  if (response.status != 200) {
    const error = `fetch(${url}) ERROR STATUS [${response.status}]:`
    console.warn(error)
    return res.status(response.status).json({
      error,
      status: response.status,
      query: req.query,
    })
  }

  const contentType = response.headers.get("content-type")
  const buffer = await response.arrayBuffer()
  // console.log(`GETURL: contentType[${contentType}]`)

  res.setHeader('Content-Type', contentType)
  res.end(new Uint8Array(buffer))
}
