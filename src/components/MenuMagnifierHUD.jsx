export function magnify(_title, desc = '') {
  const text = String(desc || _title || '').trim()
  return text ? { 'data-tooltip': text } : {}
}

export default function MenuMagnifierHUD() {
  return null
}
