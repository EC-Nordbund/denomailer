---
name: Bug report
about: Create a report to help us improve
title: ''
labels: bug, triage
assignees: mathe42

---

<!-- For security relevant bugs please contact us via mail! -->

## Describe the bug
A clear and concise description of what the bug is.

## To Reproduce
Provide a code example (without your actual password etc.) make it as minimal as you can.

## Expected behavior
A clear and concise description of what you expected to happen.

## Logs
Provide the output of `deno --version`

```
Put output here
```

Provide the output of your code snippet (with console_debug set to true see
https://github.com/EC-Nordbund/denomailer#configuring-your-client )

```
Put log here
```

If and only if you have problems with TLS or STARTTLS please provide the output
of the following commands:

```
# STARTTLS
openssl s_client -debug -starttls smtp -crlf -connect your-host.de:25

# TLS
openssl s_client -debug -crlf -connect your-host.de:25
```

## Additional context
Add any other context about the problem here. Is there a older version you know where this was working?
