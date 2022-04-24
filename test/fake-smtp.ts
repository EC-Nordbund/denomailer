export function getEmails(): Promise<any[]> {
  return fetch('http://localhost:1080/api/emails', {
    method: 'get'
  }).then(v=>v.json())
}

export function clearEmails() {
  return fetch('http://localhost:1080/api/emails', {method: 'delete'})
}