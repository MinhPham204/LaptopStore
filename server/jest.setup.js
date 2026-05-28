// Jest setup: format console.error to print concise, single-line messages
const origConsoleError = console.error.bind(console)

console.error = (...args) => {
  const first = args[0]

  // If an Error object, print only the first line (message) instead of full stack
  if (first && first.stack) {
    const [msgLine] = first.stack.split('\n')
    origConsoleError(msgLine.trim())
    return
  }

  // Otherwise join args into one line
  try {
    const line = args
      .map((a) => {
        if (typeof a === 'string' && a.includes('\n')) return a.split('\n')[0]
        return typeof a === 'string' ? a : a && a.message ? a.message : String(a)
      })
      .join(' ')
    origConsoleError(line)
  } catch (e) {
    origConsoleError(...args)
  }
}

// Optional: restore original console.error after tests finish (Jest worker teardown).
// Not strictly necessary, but keeps runtime clean if other tooling depends on it.
afterAll(() => {
  try {
    console.error = origConsoleError
  } catch (e) {
    // ignore
  }
})
