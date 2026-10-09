/**
 * Command-output extraction from a PTY buffer.
 *
 * A command's output is everything the shell printed between the command's
 * echo and the exit-code marker. Anything AFTER the marker (the next prompt,
 * bracketed-paste mode toggles) belongs to the shell, not the command.
 *
 * The previous implementation regex-stripped the marker *and its newline*
 * from the whole buffer, which glued the following prompt onto the last line
 * of command output whenever both arrived in the same PTY read. For output
 * with no trailing newline (curl -s returning JSON is the everyday case), the
 * glued line then looked like `\r{json}...$ \x1b[?2004l\r\x1b[?2004h...$ ` —
 * and the ANSI cleaner's carriage-return handling, which keeps only the text
 * after the last `\r`, discarded the JSON. The call had run; the reply was
 * silently blank. Measured at 10–25% of calls on a fast localhost API.
 */

/** Regex matching the resolved marker, e.g. `<<<EXIT:0>>>`. */
export function exitMarkerRegex(marker: string, end: string): RegExp {
  return new RegExp(`${escapeRegex(marker)}\\d+${escapeRegex(end)}`);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Return the command's own output from `buffer`: cut at the first resolved
 * exit marker (everything after it is the shell's), then drop the echoed
 * marker command line (`echo "<<<EXIT:$?>>>"`) and trim.
 */
export function commandOutputFromBuffer(buffer: string, marker: string, end: string): string {
  const m = buffer.match(exitMarkerRegex(marker, end));
  const body = m && m.index !== undefined ? buffer.slice(0, m.index) : buffer;
  const echoedMarkerCommand = new RegExp(
    `echo "${escapeRegex(marker)}\\$\\?${escapeRegex(end)}"\\r?\\n?`,
    'g'
  );
  return body.replace(echoedMarkerCommand, '').trim();
}
