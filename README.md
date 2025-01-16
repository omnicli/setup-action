# Setup Omni Action

[![GitHub Super-Linter](https://github.com/omnicli/setup-action/actions/workflows/linter.yml/badge.svg)](https://github.com/omnicli/setup-action/actions/workflows/linter.yml)
![CI](https://github.com/omnicli/setup-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/omnicli/setup-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/omnicli/setup-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/omnicli/setup-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/omnicli/setup-action/actions/workflows/codeql-analysis.yml)

This GitHub Action installs [omni](https://omnicli.dev) on a GitHub Actions
runner, and optionally runs `omni up` to setup dependencies.

## Usage

### Workflow

To use this action, add the following step to your GitHub Actions workflow:

```yaml
steps:
  - name: Install omni
    uses: omnicli/setup-action@v0
    with:
      up: true

  - name: Show omni status
    shell: bash
    run: omni status
```

By default, the action installs the latest version of omni. You can specify the
version of omni to install using the version input:

```yaml
steps:
  - name: Install omni
    uses: omncli/setup-action@v0
    with:
      version: 0.0.23
```

### Inputs

| Parameter          | Description                                                                                                                     | Default  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `version`          | The version of omni to install                                                                                                  | `latest` |
| `up`               | Whether or not to run `omni up` after installing omni                                                                           | `false`  |
| `up_args`          | Additional arguments to pass to `omni up`                                                                                       | `null`   |
| `check`            | Whether or not to run `omni config check` after installing omni                                                                 | `false`  |
| `check_patterns`   | Additional patterns to check for when running `omni config check`; must provide one pattern per line                            | `null`   |
| `check_ignore`     | Error codes to ignore when running `omni config check`; must provide one error code per line                                    | `null`   |
| `check_select`     | Error codes to select when running `omni config check`; must provide one error code per line                                    | `null`   |
| `cache`            | Cache omni's environment using GitHub's cache                                                                                   | `true`   |
| `cache_write`      | Whether or not to disable the cache write, while still allowing cache reads                                                     | `true`   |
| `cache_check_hash` | Whether or not to check the hash of the cache contents before saving the cache, to save on transfer times if the cache is large | `true`   |
| `cache_key_prefix` | The cache key prefix to use; if changed, will invalidate any pre-existing cache                                                 | `omni`   |

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for details.
