<ripgrep_instructions>

Prefer using ripgrep over grep / Select-String / Get-ChildItem.
If `rg` is unavailable, you use the next best tool.
搜索时注意约束输出大小上限。

INVOCATION AND EXIT STATUS
Forms: rg [OPTS] PATTERN [PATH...]; rg [OPTS] (--regexp=PAT|--file=FILE)... [PATH...]; rg [OPTS] --files [PATH...]; rg [OPTS] --type-list; rg [OPTS] --generate=KIND; cmd | rg [OPTS] PATTERN.
Use -- to end flags (e.g. rg -- -pat). With --regexp or --file, all positional args are PATHs. With --files, positional args are not parsed as regexes. Empty pattern set matches nothing. Default PATH is ./ unless stdin is a pipe/file/FIFO (not /dev/null) and no PATH is given. Explicit PATH overrides ignore rules, globs, hidden skipping, symlink skipping, and default binary skipping (uses binary mode).
Exit codes: 0 if matched (with --quiet, 0 if match occurs even alongside non-fatal errors), 1 if no match, 2 on fatal or non-fatal search error.

CONVENTIONS AND CONFIGURATION
Flags shown as --[no-]X accept both --X and --no-X (similarly --[no-]ignore*, --[no-]require-git, --[no-]unicode, --[no-]messages). For competing flags, the last flag wins unless noted.
RIPGREP_CONFIG_PATH: path to config file (no default lookup). Format: whitespace-trimmed lines, blank and #-prefixed lines ignored, no escaping, one verbatim arg per line (--flag=val or --flag then val on next line). Prepended to CLI args so CLI flags override config. --no-config disables config loading.
Env vars: RIPGREP_THREADS sets default threads (0=heuristic; overridden by --threads); GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM, GIT_DIR affect gitignore/excludes; WSL_DISTRO_NAME supplies {wslprefix} in hyperlinks.

INPUT AND PREPROCESSING
--regexp=PAT: repeatable; line matches if any pattern matches.
--file=FILE: repeatable; one pattern per line (trailing newline stripped; empty line matches all lines; empty file with --invert-match matches everything; - reads stdin).
--in=FILE / --in0=FILE: read PATHs (LF/CRLF vs NUL-delimited; - reads stdin; raw bytes on Unix, UTF-8 on Windows) and inject in order as positional PATHs.
--[no-]pre=CMD: pipe PATH to stdin of CMD PATH and search stdout (not run on stdin; empty CMD disables). Overrides --search-zip.
--pre-glob=GLOB: repeatable gitignore-style glob (! negates); restricts --pre to matching paths.
--[no-]search-zip: decompress gzip, bzip2, xz, LZ4, LZMA, Brotli, Zstd, .Z via PATH binaries (missing-binary errors silent); detects by magic number or extension; searches stream, not archive trees (tar not skipped). Overridden by --pre.

REGEX AND SEARCH SEMANTICS
--engine=(default|pcre2|auto): default uses finite-automata Rust regex (no look-around/backreferences; supports POSIX [[:class:]], \u{..}, inline (?i), (?s), (?R) CRLF). pcre2 adds look-around/backreferences (optional build feature; errors if absent; \n without --multiline silently fails to match). auto statically chooses engine across all patterns. --[no-]pcre2 aliases --engine=pcre2 (mutually overriding with --engine).
--[no-]fixed-strings: literal pattern matching.
--case-sensitive / --ignore-case / --smart-case: mutually overriding. Smart-case is insensitive iff pattern has >=1 literal and all literals are Unicode-lowercase. Inline (?i)/(?-i) override per subpattern.
--[no-]unicode (default on): . matches valid UTF-8 scalar; \w,\s,\d,\b,\B, case folding, \p{...} are Unicode-aware. Disabled (or inline (?-u:...)): byte/ASCII semantics.
--word-regexp / --line-regexp: mutually overriding. Word wraps pattern in \b{start-half}...\b{end-half} (\W|\A and \W|\z). Line wraps in ^...$.
--[no-]invert-match: print non-matching lines (line-oriented; e.g. with --files-with-matches, emits files having >=1 non-matching line).
--[no-]multiline: allow matches across \n (\n permitted; \p{any} includes \n); buffers/mmaps files contiguously when pattern can match \n. Overrides --stop-on-nonmatch.
--[no-]multiline-dotall: . matches line terminators when --multiline is active (also (?s)/(?-s)).
--[no-]crlf: ^/$ treat \r\n, \r, \n as line terminators (never between \r and \n); also inline (?R). Overrides --null-data.
--null-data: use NUL as line terminator instead of \n; implies --text; overrides --crlf.
--stop-on-nonmatch: stop reading file on first non-matching line after a match. Overrides --multiline.
--max-count=N: max matching lines per file (0=search nothing; multiline match or multi-match line counts once; context lines may show further matches).
--max-bytes=N: cap bytes read/searched per file/stream (0=search nothing).
--dfa-size-limit=N[K|M|G] / --regex-size-limit=N[K|M|G]: regex DFA / compiled matcher limits (default unit bytes).
--threads=N: worker threads (0=heuristic).
--[no-]mmap: memory-map when faster/possible (not stdin, virtual/zero-size files, non-64-bit, macOS auto; concurrent file truncation may abort).

ENCODING AND BINARY DATA
--[no-]encoding=ENC (--no-encoding = auto): auto assumes ASCII-compatible bytes, sniffs UTF-8/UTF-16 BOM in first 3 bytes, strips BOM, transcodes UTF-16 to UTF-8 (invalid units -> U+FFFD). Raw non-UTF-8 bytes remain searchable (Unicode constructs do not match invalid UTF-8). none disables all encoding logic and BOM sniffing. Any WHATWG Encoding Standard label transcodes all non-BOM files to UTF-8.
Binary heuristic: presence of NUL byte (mmap scans first few KB + matching lines; --no-mmap scans all bytes).
Default (recursive traversal): stops on NUL; if a match preceded NUL, suppresses match and warns.
--[no-]binary (default for explicit PATH and stdin; enabled by 3rd --unrestricted): continues past NUL until EOF or first match; on match, prints premature-stop warning with offset instead of binary data. Overrides --text.
--[no-]text: disables binary detection; treats all files as text (may emit terminal escapes or use high memory). Overrides --binary.

TRAVERSAL AND FILTERING
Default recursive traversal skips:

1. Ignore files, precedence highest-to-lowest: .rgignore > .ignore > .gitignore (incl. parent dirs; active in git or .jj repos) > $GIT_DIR/info/exclude > global core.excludesFile (default $XDG_CONFIG_HOME/git/ignore or $HOME/.config/git/ignore) > --ignore-file (later > earlier). Uses gitignore glob rules plus nested {a,b} alternates (no empty {,a}), [^...] = [!...], lone ! as no-op, gitignore trailing-space parsing.
2. Hidden files/dirs (leading . or Windows hidden attribute), unless whitelisted in an ignore file.
3. Binary files.
4. Symlinks.
   Ignore toggles: --[no-]ignore (disables dot, exclude, global, parent, vcs; not --ignore-file); --[no-]ignore-dot (.ignore/.rgignore); --[no-]ignore-exclude (info/exclude); --[no-]ignore-global; --[no-]ignore-parent (parent-dir ignore lookup); --[no-]ignore-vcs (.gitignore and its parents); --[no-]ignore-files (disables all --ignore-file flags, even later ones); --ignore-file=PATH (repeatable, matched relative to CWD); --[no-]ignore-file-case-insensitive; --[no-]require-git (--no-require-git applies .gitignore outside repos).
   Other filters: --[no-]hidden (includes .git regardless of --no-ignore-vcs); --[no-]follow (follow symlinks, checks loops and broken links; ignores broken links excluded by ignore rules); --unrestricted (repeatable: 1x=--no-ignore, 2x=+--hidden, 3x=+--binary).
   --glob=GLOB / --glob-not=GLOB (--glob=!GLOB) / --iglob=GLOB (case-insensitive) / --[no-]glob-case-insensitive: repeatable CLI globs overriding all ignore files; last matching glob wins; any positive glob requires matching >=1 positive glob; directory contents need dir/**.
   --type=TYPE / --type-not=TYPE: repeatable whitelist/blacklist of built-in or custom types (all = union of all types); lower precedence than --glob and ignore files.
   --type-add=NAME:SPEC: add glob or include:T1,T2,... to Unicode-alphanumeric NAME (non-persistent). --type-clear=TYPE clears globs (non-persistent). --type-list prints types and globs, then exits.
   --max-depth=N: max directory recursion depth (0=explicit paths only, 1=direct children).
   --max-filesize=N[K|M|G]: skip files larger than N (not dirs).
   --[no-]one-file-system: do not cross filesystem boundaries per PATH root.

OUTPUT, FORMATTING, SORTING, AND GENERATION
--replace=TEXT: replace matched text in output (preserves line endings; never edits files).
--before-context=N, --after-context=N, --context=N (-A/-B partially override -C regardless of order); --passthru / --passthrough (print non-matching lines too; exit status unaffected; overrides context).
--[no-]context-separator=SEP (default --; supports \t, \x7F escapes; empty prints blank line; --no-context-separator omits line).
--field-context-separator=SEP (default -), --field-match-separator=SEP (default :).
--[no-]line-number (1-based; tty default on unless stdin-only, non-tty off), --[no-]column (1-based byte offset of 1st match on line or each match with --only-matching; implies --line-number), --[no-]byte-offset (0-based post-transform byte offset of line or match with --only-matching).
--[no-]heading (path above cluster, tty default, vs prefix per line), --with-filename / --no-filename (auto on for >1 file), --path-separator=BYTE (single byte; empty resets to OS default).
--only-matching: print each non-empty match on its own line.
--[no-]trim: strip leading ASCII whitespace before --max-columns.
--max-columns=N (0=off): omit lines >N bytes, printing match count. --[no-]max-columns-preview shows N-byte prefix instead.
--null: append NUL byte after every printed file path.
--pretty: enables --heading, --line-number, and ANSI output (--color=always).
--vimgrep: every match on its own line with path, line, col (first line only in multiline; enables --with-filename).
--hyperlink-format=FMT: OSC-8 hyperlinks; aliases default, none (or empty), cursor, file, grep+, kitty, macvim, textmate, vscode, vscode-insiders, vscodium, zed; vars {path} (required, absolute percent-encoded), {host} (OS or --hostname-bin=CMD trimmed stdout), {line} (default 1), {column} (requires {line}, default 1), {wslprefix}. Requires path in output and tty (or --color=always).
--[no-]line-buffered / --[no-]block-buffered: mutually overriding (tty defaults line, pipe/file defaults block).
Output modes: --count (matching lines per file; equals --count-matches with --only-matching or \n-matching --multiline; single file omits path unless --with-filename; may differ from --files-with-matches on binary files without --binary); --count-matches (total matches; overrides --count); --[no-]include-zero (print 0 counts); --files-with-matches / --files-without-match (mutually overriding path lists); --files (list searchable paths; overrides --type-list); --[no-]json (JSON Lines: begin, end, match, context, summary; data as text [UTF-8] or bytes [base64]; supports --replace and multiple multiline matches; implies --stats; incompatible with --files*/--count*; ignores standard formatting flags); --[no-]stats (summary stats; no-op with --files*); --quiet (suppress stdout; stop on 1st match or unignored file with --files).
Sorting: --sort=KEY / --sortr=KEY (none [default, parallel], path [per-directory traversal order], modified, accessed, created [errors if unsupported by FS]); mutually overriding; non-none forces single-threaded.
Messages and generation: --[no-]messages (suppress file open/read errors); --[no-]ignore-messages (suppress ignore parse errors); --generate=(man|complete-bash|complete-zsh|complete-fish|complete-powershell|complete-nushell) writes to stdout and exits.

</ripgrep_instructions>
