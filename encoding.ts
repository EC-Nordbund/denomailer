export { base64Decode } from './deps.ts'

export function quotedPrintableEncode(data: string, encLB = false) {
  const encodedData = data.split('').map((ch, i) => {
    // For each char check decoding
    const code = ch.charCodeAt(0)

    if(!encLB && (code === 10 || code === 13)) return ch
    if(code === 9) return ch
    if(code > 32 && code <= 126 && code !== 61) return ch

    if(code === 32) {
      // When LB after space escape it!
      if(!encLB && (data[i+1] === '\r' || data[i+1] === '\n')) {
        return '=20'
      }
      return ' '
    }

    const hex = code.toString(16)

    const bytes = hex.length / 2

    let enc = ''

    for (let i = 0; i < bytes; i++) {
      enc+= `=${hex.slice(2*i, 2*i+2)}`
    }

    return enc
  }).join('')

  let ret = ''
  const lines = Math.ceil(encodedData.length / 75) - 1

  for (let i = 0; i < lines; i++) {
    const old = encodedData.slice(i * 75, (i+1) * 75)

    if(old.endsWith('\r') || old.endsWith('\n')) {
      ret+=old
    }

    ret += `${old}=\r\n`
  }

  // Add rest with no new line
  ret+=encodedData.slice(lines * 75)

  return ret
}


export function quotedPrintableDecode(str: string) {
  const removedLB = str.replaceAll('=\r\n', '')

  const enc = removedLB.split('=').map((s, i) => {
    if(i===0) return s

    const first = s.slice(0, 2)
    const rest = s.slice(2)

    const a = new Uint8Array(parseInt(first, 16))

    const text = new TextDecoder()

    text.decode()


    return String.fromCharCode(parseInt(first, 16)) + rest
  }).join('')

  return enc
}