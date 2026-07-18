/** Returns the new message portion of a reply, without its quoted thread. */
export function currentEmailBody(value: string) {
  const body = value.replace(/\r\n?/g, "\n").trim();
  if (!body) return body;

  const lines = body.split("\n");
  let end = lines.findIndex((line) => {
    const trimmed = line.trim();
    return /^On .+wrote:\s*$/i.test(trimmed)
      || /^[-_]{3,}\s*(original|forwarded) message\s*[-_]{3,}$/i.test(trimmed)
      || /^>/.test(trimmed);
  });

  // Outlook commonly inserts a small From/Sent/To/Subject header block instead
  // of Gmail's "On … wrote:" delimiter.
  if (end < 0) {
    end = lines.findIndex((line, index) => {
      if (!/^From:/i.test(line.trim())) return false;
      return lines.slice(index + 1, index + 6).some((next) => /^(Sent|Date|To|Subject):/i.test(next.trim()));
    });
  }

  return (end >= 0 ? lines.slice(0, end) : lines).join("\n").trim() || body;
}
