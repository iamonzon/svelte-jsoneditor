/**
 * Parse a Redis metadata script into a JSON object.
 * Handles (case-insensitive):
 *   hset <hash> <field> '<json>'   → entries[field] = parsed_json
 *   hset <hash> <field> <value>    → entries[field] = value
 *   set  <key> '<json>'            → entries[key]   = parsed_json
 *   set  <key> <value>             → entries[key]   = value
 *   sadd <key> "m1" "m2" ...       → entries[key]   = [m1, m2, ...]
 */
export function parseHsetFile(content: string): Record<string, unknown> {
  const entries: Record<string, unknown> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // HSET with single-quoted value: hset <hash> <field> '<json>'
    let match = trimmed.match(/^hset\s+\S+\s+(\S+)\s+'(.*)'$/i)
    if (match) {
      const raw = match[2].replace(/\\'/g, "'")
      try {
        entries[match[1]] = JSON.parse(raw)
      } catch {
        entries[match[1]] = raw
      }
      continue
    }

    // HSET with unquoted value: hset <hash> <field> <value>
    match = trimmed.match(/^hset\s+\S+\s+(\S+)\s+(\S+)$/i)
    if (match) {
      entries[match[1]] = parseUnquoted(match[2])
      continue
    }

    // SET with single-quoted value: set <key> '<json>'
    match = trimmed.match(/^set\s+(\S+)\s+'(.*)'$/i)
    if (match) {
      const raw = match[2].replace(/\\'/g, "'")
      try {
        entries[match[1]] = JSON.parse(raw)
      } catch {
        entries[match[1]] = raw
      }
      continue
    }

    // SET with unquoted value: set <key> <value>
    match = trimmed.match(/^set\s+(\S+)\s+(\S+)$/i)
    if (match) {
      entries[match[1]] = parseUnquoted(match[2])
      continue
    }

    // SADD: sadd <key> "member1" "member2" ... or sadd <key> member1 member2 ...
    match = trimmed.match(/^sadd\s+(\S+)\s+(.+)$/i)
    if (match) {
      const members = parseSaddMembers(match[2])
      const existing = entries[match[1]]
      if (Array.isArray(existing)) {
        existing.push(...members)
      } else {
        entries[match[1]] = members
      }
      continue
    }
  }

  return entries
}

function parseUnquoted(val: string): unknown {
  const num = Number(val)
  if (!isNaN(num)) return num
  return val
}

function parseSaddMembers(raw: string): string[] {
  const members: string[] = []
  const regex = /"([^"]*)"|(\S+)/g
  let m
  while ((m = regex.exec(raw))) {
    members.push(m[1] ?? m[2])
  }
  return members
}
