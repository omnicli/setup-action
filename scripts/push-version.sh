#!/usr/bin/env bash
set -euo pipefail

FORCE="$([[ "${1:-}" == "--force" ]] && echo "1" || echo "0")"

# Check that current branch is main
if [ "$(git branch --show-current)" != "main" ]; then
	echo "You must be on the main branch to push a new version"
	exit 1
fi

patch_version=$(jq -r .version package.json)
minor_version=$(echo "$patch_version" | cut -d. -f1,2)
major_version=$(echo "$patch_version" | cut -d. -f1)

# Check if the patch version already exists, and if it does,
# error out unless --force has been passed
if git tag | grep -q "v$patch_version" && [[ "$FORCE" == "0" ]]; then
	echo "Version $patch_version already exists. Use --force to overwrite"
	exit 1
fi

# Ask for confirmation
echo >&2 "This will push v$patch_version to github, and retag v$minor_version and v$major_version."
read -p "Continue? [y/N] " -n 1 -r
echo >&2
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
	echo >&2 "Aborted"
	exit 1
fi

# Push the changes to the main branch
git push

# Create the new tag, using -f if --force was passed, and push it to github

# shellcheck disable=SC2046
git tag "v$patch_version" $([[ "$FORCE" == "1" ]] && echo "-f")

# shellcheck disable=SC2046
git push origin "v$patch_version" $([[ "$FORCE" == "1" ]] && echo "-f")

# Now handle the tags for the minor and major versions
git tag "v$minor_version" -f
git tag "v$major_version" -f
git push origin "v$minor_version" -f
git push origin "v$major_version" -f

# Finally, create a release on github
gh release create "v$patch_version" --generate-notes --verify-tag
