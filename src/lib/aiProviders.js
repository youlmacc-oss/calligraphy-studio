async function blobUrlToDataUrl(url) {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  const blob = await fetch(url).then((response) => response.blob())
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(blob)
  })
}

function imageSizeForAspect(aspect) {
  if (aspect?.id === '16:9') return { width: 1920, height: 1080, fal: 'landscape_16_9' }
  if (aspect?.id === '9:16') return { width: 1080, height: 1920, fal: 'portrait_16_9' }
  return { width: 1024, height: 1024, fal: 'square_hd' }
}

export async function runRemoteAi({ provider, keys, prompt, negative, maskUrl, aspect }) {
  const maskData = await blobUrlToDataUrl(maskUrl)
  const size = imageSizeForAspect(aspect)

  if (provider === 'fal' && keys.falKey) {
    const response = await fetch('https://fal.run/fal-ai/flux-lora', {
      method: 'POST',
      headers: {
        Authorization: `Key ${keys.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: size.fal,
        num_images: 1,
        control_image: maskData || undefined,
      }),
    })
    if (!response.ok) throw new Error('Fal.ai 요청이 거절되었습니다.')
    const data = await response.json()
    return data?.images?.[0]?.url ?? data?.image?.url ?? null
  }

  if (provider === 'replicate' && keys.replicateKey) {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keys.replicateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'stability-ai/sdxl',
        input: {
          prompt,
          negative_prompt: negative,
          image: maskData || undefined,
        },
      }),
    })
    if (!response.ok) throw new Error('Replicate 요청이 거절되었습니다.')
    const data = await response.json()
    return Array.isArray(data?.output) ? data.output[0] : data?.output ?? data?.urls?.get ?? null
  }

  if ((provider === 'grok' || provider === 'custom') && (keys.grokKey || keys.customUrl)) {
    const endpoint = keys.customUrl || 'https://api.x.ai/v1/images/generations'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: keys.grokKey ? `Bearer ${keys.grokKey}` : undefined,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-image',
        prompt,
        n: 1,
        mask: maskData || undefined,
        size: `${size.width}x${size.height}`,
      }),
    })
    if (!response.ok) throw new Error('Grok / Custom API 요청이 거절되었습니다.')
    const data = await response.json()
    return data?.data?.[0]?.url ?? data?.images?.[0]?.url ?? data?.url ?? null
  }

  return null
}

export async function simulateAiResult(sourceUrl) {
  if (!sourceUrl) return null
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = sourceUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const ctx = canvas.getContext('2d')
  ctx.filter = 'contrast(1.08) saturate(1.14) brightness(1.04)'
  ctx.drawImage(image, 0, 0)
  ctx.filter = 'none'
  const glow = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.4, 20, canvas.width / 2, canvas.height / 2, canvas.width * 0.7)
  glow.addColorStop(0, 'rgba(255,255,255,0)')
  glow.addColorStop(1, 'rgba(0,0,0,0.18)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : sourceUrl), 'image/png')
  })
}
