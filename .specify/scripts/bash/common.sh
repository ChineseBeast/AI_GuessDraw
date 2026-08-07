#!/usr/bin/env bash
# shellcheck disable=all
# Common functions and variables for all scripts

# Find repository root by searching upward for .specify directory
find_specify_root() {
    local dir="${1:-$(pwd)}"
    dir="$(cd -- "$dir" 2>/dev/null && pwd)" || return 1
    local prev_dir=""
    while true; do
        if [ -d "$dir/.specify" ]; then
            echo "$dir"
            return 0
        fi
        if [ "$dir" = "/" ] || [ "$dir" = "$prev_dir" ]; then
            break
        fi
        prev_dir="$dir"
        dir="$(dirname "$dir")"
    done
    return 1
}

resolve_specify_init_dir() {
    local init_root
    if ! init_root="$(CDPATH="" cd -- "$SPECIFY_INIT_DIR" 2>/dev/null && pwd)"; then
        echo "ERROR: SPECIFY_INIT_DIR does not point to an existing directory: $SPECIFY_INIT_DIR" >&2
        return 1
    fi
    if [[ ! -d "$init_root/.specify" ]]; then
        echo "ERROR: SPECIFY_INIT_DIR is not a Spec Kit project (no .specify/ directory): $init_root" >&2
        return 1
    fi
    printf '%s\n' "$init_root"
}

get_repo_root() {
    if [[ -n "${SPECIFY_INIT_DIR:-}" ]]; then
        resolve_specify_init_dir
        return
    fi
    local specify_root
    if specify_root=$(find_specify_root); then
        echo "$specify_root"
        return
    fi
    local script_dir="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    (cd "$script_dir/../../.." && pwd)
}

get_current_branch() {
    if [[ -n "${SPECIFY_FEATURE:-}" ]]; then
        echo "$SPECIFY_FEATURE"
        return
    fi
    echo ""
}

read_feature_json_feature_directory() {
    local repo_root="$1"
    local fj="$repo_root/.specify/feature.json"
    [[ -f "$fj" ]] || { printf '%s' ''; return 0; }
    local _fd=''
    if command -v jq >/dev/null 2>&1; then
        if ! _fd=$(jq -r '.feature_directory // empty' "$fj" 2>/dev/null); then
            _fd=''
        fi
    fi
    if [[ -z "$_fd" ]] && command -v python3 >/dev/null 2>&1; then
        if ! _fd=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); v=d.get('feature_directory'); print(v if v else '')" "$fj" 2>/dev/null); then
            _fd=''
        fi
    fi
    if [[ -z "$_fd" ]]; then
        _fd=$( { grep -E '"feature_directory"[[:space:]]*:' "$fj" 2>/dev/null || true; } \
            | head -n 1 \
            | sed -E 's/^[^:]*:[[:space:]]*"([^"]*)".*$/\1/' )
    fi
    printf '%s' "$_fd"
    return 0
}

_persist_feature_json() {
    local repo_root="$1"
    local feature_dir_value="$2"
    local fj="$repo_root/.specify/feature.json"
    if [[ "$feature_dir_value" == "$repo_root/"* ]]; then
        feature_dir_value="${feature_dir_value#"$repo_root/"}"
    fi
    local current_val
    current_val=$(read_feature_json_feature_directory "$repo_root")
    if [[ "$current_val" == "$feature_dir_value" ]]; then
        return 0
    fi
    mkdir -p "$repo_root/.specify"
    if command -v jq >/dev/null 2>&1; then
        jq -cn --arg fd "$feature_dir_value" '{feature_directory:$fd}' > "$fj"
    else
        printf '{"feature_directory":"%s"}\n' "$(json_escape "$feature_dir_value")" > "$fj"
    fi
}

get_feature_paths() {
    local no_persist=false
    if [[ "${1:-}" == "--no-persist" ]]; then
        no_persist=true
        shift
    fi
    local repo_root
    repo_root=$(get_repo_root) || return 1
    local current_branch
    current_branch=$(get_current_branch)
    local feature_dir
    if [[ -n "${SPECIFY_FEATURE_DIRECTORY:-}" ]]; then
        feature_dir="$SPECIFY_FEATURE_DIRECTORY"
        [[ "$feature_dir" != /* ]] && feature_dir="$repo_root/$feature_dir"
        if [[ "$no_persist" != true ]]; then
            _persist_feature_json "$repo_root" "$SPECIFY_FEATURE_DIRECTORY"
        fi
    elif [[ -f "$repo_root/.specify/feature.json" ]]; then
        local _fd
        _fd=$(read_feature_json_feature_directory "$repo_root")
        if [[ -n "$_fd" ]]; then
            feature_dir="$_fd"
            [[ "$feature_dir" != /* ]] && feature_dir="$repo_root/$feature_dir"
        else
            echo "ERROR: Feature directory not found. Set SPECIFY_FEATURE_DIRECTORY or ensure .specify/feature.json contains feature_directory." >&2
            return 1
        fi
    else
        echo "ERROR: Feature directory not found. Set SPECIFY_FEATURE_DIRECTORY or run the specify command to create .specify/feature.json." >&2
        return 1
    fi
    if [[ -z "$current_branch" ]]; then
        local feature_dir_trimmed="${feature_dir%/}"
        current_branch="${feature_dir_trimmed##*/}"
    fi
    printf 'REPO_ROOT=%q\n' "$repo_root"
    printf 'CURRENT_BRANCH=%q\n' "$current_branch"
    printf 'FEATURE_DIR=%q\n' "$feature_dir"
    printf 'FEATURE_SPEC=%q\n' "$feature_dir/spec.md"
    printf 'IMPL_PLAN=%q\n' "$feature_dir/plan.md"
    printf 'TASKS=%q\n' "$feature_dir/tasks.md"
    printf 'RESEARCH=%q\n' "$feature_dir/research.md"
    printf 'DATA_MODEL=%q\n' "$feature_dir/data-model.md"
    printf 'QUICKSTART=%q\n' "$feature_dir/quickstart.md"
    printf 'CONTRACTS_DIR=%q\n' "$feature_dir/contracts"
}

has_jq() {
    command -v jq >/dev/null 2>&1
}

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\b'/\\b}"
    s="${s//$'\f'/\\f}"
    local LC_ALL=C
    local i char code
    for (( i=0; i<${#s}; i++ )); do
        char="${s:$i:1}"
        printf -v code '%d' "'$char" 2>/dev/null || code=256
        if (( code >= 1 && code <= 31 )); then
            printf '\\u%04x' "$code"
        else
            printf '%s' "$char"
        fi
    done
}

check_file() { [[ -f "$1" ]] && echo "  ✓ $2" || echo "  ✗ $2"; }
check_dir() { [[ -d "$1" && -n $(ls -A "$1" 2>/dev/null) ]] && echo "  ✓ $2" || echo "  ✗ $2"; }

resolve_template() {
    local template_name="$1"
    local repo_root="$2"
    local base="$repo_root/.specify/templates"
    local override="$base/overrides/${template_name}.md"
    [ -f "$override" ] && echo "$override" && return 0
    local core="$base/${template_name}.md"
    [ -f "$core" ] && echo "$core" && return 0
    return 1
}

format_speckit_command() {
    local command_name="$1"
    command_name="${command_name#/}"
    command_name="${command_name#speckit.}"
    command_name="${command_name#speckit-}"
    printf '/speckit.%s\n' "$command_name"
}
