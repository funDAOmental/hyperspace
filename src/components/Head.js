import React from 'react'
import NextHead from 'next/head'
import { useSlugs } from '@/hooks/useSlugs'

const Head = () => {
  const { slug } = useSlugs()
  const title = `Hyperspace | ${slug ?? 'funDAOmental'}`

  return (
    <NextHead>
      <title>{title}</title>
      <meta charSet='utf-8' />
      <meta name="description" content="Hyperspace, a collaborative, self-sovereign metaverse for Hyperbox Protocol, by funDAOmental" />
      <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      <link rel="icon" href="/favicon.ico" />
    </NextHead>
  )
}

export default Head
