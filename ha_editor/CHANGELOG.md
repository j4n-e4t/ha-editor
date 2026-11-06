# Changelog

## 0.1.1

- Fix installation on x86 CPUs without AVX (for example Celeron and Atom mini PCs): the image build no longer runs the TypeScript type check, which crashed Bun and needed several GB of memory.
- Pin the Bun base image to 1.3.14.

## 0.1.0

- Initial release: file tree, Monaco editor, YAML checks, workspace search, Home Assistant and ESPHome file icons.
